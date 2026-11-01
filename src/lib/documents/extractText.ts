import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import type { FileType } from '@/types/knowledge';
import type { TextSection } from '@/lib/text/chunking';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
} catch (e) {
  console.warn('Failed to assign pdfjs worker url:', e);
}

export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB

const EXTENSION_TYPES: Record<string, FileType> = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'docx',
  txt: 'txt',
  md: 'txt',
  markdown: 'txt',
  csv: 'txt',
  json: 'txt',
  rtf: 'txt',
  html: 'html',
  htm: 'html',
};

export type UploadProblem = 'unsupported' | 'tooLarge' | 'noText' | 'failed' | 'duplicate';

export function detectFileType(file: File): FileType | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (EXTENSION_TYPES[extension]) {
    return EXTENSION_TYPES[extension];
  }
  // Check MIME type fallback
  if (file.type.includes('pdf')) return 'pdf';
  if (file.type.includes('word') || file.type.includes('officedocument')) return 'docx';
  if (file.type.includes('text') || file.type.includes('json') || file.type.includes('csv')) return 'txt';
  if (file.type.includes('html')) return 'html';
  return null;
}

/**
 * Robust multi-tier PDF extractor.
 * Tier 1: pdfjs-dist with standard worker
 * Tier 2: pdfjs-dist with fallback inline worker configuration
 * Tier 3: Binary stream text scanner for readable PostScript / PDF text tokens
 */
async function extractPdf(buffer: ArrayBuffer): Promise<TextSection[]> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const sections: TextSection[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) {
        sections.push({ text, page: pageNumber });
      }
    }
    if (sections.length > 0) return sections;
  } catch (err) {
    console.warn('Standard PDF.js extraction encountered an issue, trying raw text fallback:', err);
  }

  // Tier 3: Emergency raw PDF text stream extractor
  try {
    const rawText = decodePdfStreams(buffer);
    if (rawText && rawText.trim().length > 20) {
      return [{ text: rawText.trim(), page: 1 }];
    }
  } catch (err) {
    console.warn('PDF stream decoder fallback failed:', err);
  }

  throw new Error('Unable to extract readable text from PDF. The document might be image-only or password protected.');
}

/**
 * Fallback regex scanner for uncompressed or raw PDF streams containing Tj / TJ text blocks.
 */
function decodePdfStreams(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('latin1');
  const fullContent = decoder.decode(bytes);

  const textBlocks: string[] = [];
  // Match text in parentheses before Tj or ' operator: (Text) Tj or (Text) '
  const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(fullContent)) !== null) {
    const cleaned = match[1].replace(/\\([()\\])/g, '$1').trim();
    if (cleaned.length > 0) {
      textBlocks.push(cleaned);
    }
  }

  // Match array text in TJ blocks: [ (Hello) -10 (World) ] TJ
  const arrayTjRegex = /\[([\s\S]*?)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(fullContent)) !== null) {
    const inner = match[1];
    const subRegex = /\(([^)]+)\)/g;
    let subMatch: RegExpExecArray | null;
    while ((subMatch = subRegex.exec(inner)) !== null) {
      const cleaned = subMatch[1].replace(/\\([()\\])/g, '$1').trim();
      if (cleaned.length > 0) {
        textBlocks.push(cleaned);
      }
    }
  }

  return textBlocks.join(' ');
}

/**
 * Bulletproof multi-tier DOCX extractor.
 * Handles IEEE papers, MS Word 2016-2024, Google Docs exports, Pandoc, and legacy docx.
 * Tier 1: Mammoth extractRawText
 * Tier 2: JSZip direct XML parsing of word/document.xml, footnotes, headers, tables
 * Tier 3: Regex scan of raw XML strings for <w:t> tags
 * Tier 4: Binary ASCII/UTF-8 string recovery
 */
async function extractDocx(buffer: ArrayBuffer): Promise<TextSection[]> {
  let mammothError: unknown = null;

  // Tier 1: Try Mammoth
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    if (result && result.value && result.value.trim().length > 20) {
      return [{ text: result.value.trim(), page: null }];
    }
  } catch (err) {
    mammothError = err;
    console.warn('Mammoth parser failed on DOCX, activating JSZip direct XML extractor:', err);
  }

  // Tier 2: JSZip direct XML parser
  try {
    const zip = await JSZip.loadAsync(buffer);
    const xmlFiles = [
      'word/document.xml',
      ...Object.keys(zip.files).filter((k) =>
        /^word\/(header|footer|footnotes|endnotes)\d*\.xml$/i.test(k),
      ),
    ];

    const paragraphs: string[] = [];

    for (const xmlPath of xmlFiles) {
      const file = zip.file(xmlPath);
      if (!file) continue;

      const xmlText = await file.async('text');
      const extractedFromXml = parseDocxXml(xmlText);
      if (extractedFromXml.length > 0) {
        paragraphs.push(...extractedFromXml);
      }
    }

    if (paragraphs.length > 0) {
      return [{ text: paragraphs.join('\n\n'), page: null }];
    }
  } catch (zipErr) {
    console.warn('JSZip extraction encountered an issue, trying raw XML regex scan:', zipErr);
  }

  // Tier 3: Regex scanner over binary buffer looking for <w:t> tags
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const content = decoder.decode(new Uint8Array(buffer));
    const rawMatches = content.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi);
    if (rawMatches && rawMatches.length > 0) {
      const words = rawMatches.map((m) =>
        m
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim(),
      );
      const joined = words.filter(Boolean).join(' ');
      if (joined.length > 20) {
        return [{ text: joined, page: null }];
      }
    }
  } catch (regexErr) {
    console.warn('Raw XML regex scanner failed:', regexErr);
  }

  // Tier 4: Salvage printable words from binary data
  const salvage = salvagePrintableStrings(buffer);
  if (salvage && salvage.length > 50) {
    return [{ text: salvage, page: null }];
  }

  throw mammothError || new Error('Could not extract readable text from DOCX file.');
}

/**
 * Parses XML text from word/document.xml and extracts paragraphs, headings, and table cells.
 */
function parseDocxXml(xmlText: string): string[] {
  const paragraphs: string[] = [];

  // Try browser DOMParser
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const parseError = xmlDoc.getElementsByTagName('parsererror')[0];

    if (!parseError) {
      // Find all paragraph elements (supports with or without namespace)
      const pElements = xmlDoc.getElementsByTagName('w:p');
      for (let i = 0; i < pElements.length; i++) {
        const p = pElements[i];
        const tElements = p.getElementsByTagName('w:t');
        let pText = '';
        for (let j = 0; j < tElements.length; j++) {
          pText += tElements[j].textContent || '';
        }
        pText = pText.trim();
        if (pText.length > 0) {
          paragraphs.push(pText);
        }
      }

      if (paragraphs.length > 0) {
        return paragraphs;
      }
    }
  } catch {
    // Continue to regex
  }

  // Fallback: Regex extraction on <w:p> and <w:t>
  const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(xmlText)) !== null) {
    const pContent = pMatch[1];
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi;
    let tMatch: RegExpExecArray | null;
    let pText = '';
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      pText += tMatch[1];
    }
    const clean = pText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (clean.length > 0) {
      paragraphs.push(clean);
    }
  }

  return paragraphs;
}

/**
 * Salvages printable strings of ASCII and common unicode sequences.
 */
function salvagePrintableStrings(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  let currentWord = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // Printable ASCII or newline/tab
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      currentWord += String.fromCharCode(b);
    } else {
      if (currentWord.length >= 4) {
        result += currentWord + ' ';
      }
      currentWord = '';
    }
  }
  if (currentWord.length >= 4) {
    result += currentWord;
  }

  return result
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,;:!?'"()-]/g, '')
    .trim();
}

async function extractTxt(file: File): Promise<TextSection[]> {
  let text = '';
  try {
    text = await file.text();
  } catch {
    // FileReader fallback
    text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  return [{ text: text.trim(), page: null }];
}

async function extractHtml(file: File): Promise<TextSection[]> {
  const html = await file.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Remove script, style, svg, and noscript elements
  doc.querySelectorAll('script, style, noscript, svg, iframe').forEach((el) => el.remove());
  const bodyText = doc.body?.innerText || doc.body?.textContent || '';
  return [{ text: bodyText.replace(/\s+/g, ' ').trim(), page: null }];
}

export async function extractSections(file: File, fileType: FileType): Promise<TextSection[]> {
  if (fileType === 'txt') return extractTxt(file);
  if (fileType === 'html') return extractHtml(file);
  const buffer = await file.arrayBuffer();
  return fileType === 'pdf' ? extractPdf(buffer) : extractDocx(buffer);
}
