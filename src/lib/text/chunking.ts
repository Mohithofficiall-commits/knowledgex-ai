import { splitUnits } from '@/lib/text/text-utils';

export interface TextSection {
  text: string;
  page: number | null;
}

export interface TextChunk {
  content: string;
  page: number | null;
}

const TARGET_CHUNK_CHARS = 700;

export function chunkSections(sections: TextSection[]): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    let buffer: string[] = [];
    let bufferLength = 0;

    const flush = () => {
      if (buffer.length === 0) return;
      chunks.push({ content: buffer.join(' '), page: section.page });
      buffer = [];
      bufferLength = 0;
    };

    for (const unit of splitUnits(section.text)) {
      if (bufferLength > 0 && bufferLength + unit.length > TARGET_CHUNK_CHARS) {
        flush();
      }
      buffer.push(unit);
      bufferLength += unit.length + 1;
    }
    flush();
  }

  return chunks;
}
