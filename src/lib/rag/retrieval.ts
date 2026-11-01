import { tokenize } from '@/lib/text/text-utils';
import type { ChunkWithDocument } from '@/types/knowledge';

export interface RankedChunk {
  chunk: ChunkWithDocument;
  score: number;
  terms: string[];
}

const K1 = 1.2;
const B = 0.75;

export function rankChunks(query: string, chunks: ChunkWithDocument[], limit: number): RankedChunk[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0 || chunks.length === 0) return [];

  const tokenized = chunks.map((chunk) => ({ chunk, tokens: tokenize(chunk.content) }));
  const averageLength = tokenized.reduce((sum, item) => sum + item.tokens.length, 0) / tokenized.length || 1;
  const documentCount = tokenized.length;

  const idf = new Map<string, number>();
  for (const term of queryTerms) {
    const documentFrequency = tokenized.filter((item) => item.tokens.includes(term)).length;
    idf.set(term, Math.log(1 + (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5)));
  }

  return tokenized
    .map(({ chunk, tokens }) => {
      let score = 0;
      const matched: string[] = [];
      for (const term of queryTerms) {
        const frequency = tokens.filter((token) => token === term).length;
        if (frequency === 0) continue;
        matched.push(term);
        const lengthNorm = K1 * (1 - B + (B * tokens.length) / averageLength);
        score += (idf.get(term) ?? 0) * ((frequency * (K1 + 1)) / (frequency + lengthNorm));
      }
      return { chunk, score, terms: matched };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
