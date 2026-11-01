import type { FileType } from '@/types/knowledge';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string, language: 'en' | 'ta'): string {
  return new Date(iso).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string, language: 'en' | 'ta'): string {
  return new Date(iso).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const FILE_TYPE_LABEL: Record<FileType, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  txt: 'TXT',
  html: 'HTML',
};
