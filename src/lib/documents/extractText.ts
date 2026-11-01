import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import type { FileType } from '@/types/knowledge';
import type { TextSection } from '@/lib/text/chunking';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const EXTENSION_TYPES: Record<string, FileType> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
  html: 'html',
  htm: 'html',
};

export type UploadProblem = 'unsupported' | 'tooLarge' | 'noText' | 'failed' | 'duplicate';

export function detectFileType(file: File): FileType | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? null;
}

async function extractPdf(buffer: ArrayBuffer): Promise<TextSection[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const sections: TextSection[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    sections.push({ text, page: pageNumber });
  }
  return sections;
}

async function extractDocx(buffer: ArrayBuffer): Promise<TextSection[]> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return [{ text: result.value, page: null }];
}

async function extractTxt(file: File): Promise<TextSection[]> {
  return [{ text: await file.text(), page: null }];
}

async function extractHtml(file: File): Promise<TextSection[]> {
  const html = await file.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Remove script and style elements
  doc.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
  const bodyText = doc.body?.innerText || doc.body?.textContent || '';
  return [{ text: bodyText.trim(), page: null }];
}

export async function extractSections(file: File, fileType: FileType): Promise<TextSection[]> {
  if (fileType === 'txt') return extractTxt(file);
  if (fileType === 'html') return extractHtml(file);
  const buffer = await file.arrayBuffer();
  return fileType === 'pdf' ? extractPdf(buffer) : extractDocx(buffer);
}
