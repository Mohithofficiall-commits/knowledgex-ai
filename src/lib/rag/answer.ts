import { rankChunks } from '@/lib/rag/retrieval';
import { splitUnits, tokenize } from '@/lib/text/text-utils';
import type { AskResult, ChunkWithDocument, Citation, Confidence } from '@/types/knowledge';

const CHUNK_LIMIT = 6;
const MAX_SENTENCES = 4;

interface CandidateSentence {
  sentence: string;
  chunk: ChunkWithDocument;
  hits: string[];
  score: number;
}

function toConfidence(coverage: number): Confidence {
  if (coverage >= 0.66) return 'high';
  if (coverage >= 0.34) return 'medium';
  return 'low';
}

export function answerQuestion(query: string, chunks: ChunkWithDocument[]): AskResult {
  const empty: AskResult = { answer: '', confidence: 'low', citations: [] };
  const queryTerms = [...new Set(tokenize(query))];
  const ranked = rankChunks(query, chunks, CHUNK_LIMIT);
  if (queryTerms.length === 0 || ranked.length === 0) return empty;

  const maxScore = ranked[0].score || 1;
  const candidates: CandidateSentence[] = ranked
    .flatMap(({ chunk, score }) =>
      splitUnits(chunk.content).map((sentence) => {
        const sentenceTerms = new Set(tokenize(sentence));
        const hits = queryTerms.filter((term) => sentenceTerms.has(term));
        return { sentence, chunk, hits, score: hits.length + (0.5 * score) / maxScore };
      }),
    )
    .filter((candidate) => candidate.hits.length > 0)
    .sort((a, b) => b.score - a.score);

  const selected: CandidateSentence[] = [];
  const covered = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= MAX_SENTENCES) break;
    if (selected.some((item) => item.sentence === candidate.sentence)) continue;
    const addsNewTerm = candidate.hits.some((term) => !covered.has(term));
    if (!addsNewTerm && selected.length > 0) continue;
    selected.push(candidate);
    candidate.hits.forEach((term) => covered.add(term));
  }

  if (selected.length === 0) return empty;

  const citations: Citation[] = [];
  const markerByChunk = new Map<string, number>();
  for (const item of selected) {
    if (markerByChunk.has(item.chunk.id)) continue;
    const marker = citations.length + 1;
    markerByChunk.set(item.chunk.id, marker);
    citations.push({
      marker,
      documentId: item.chunk.document_id,
      documentTitle: item.chunk.documentTitle,
      chunkId: item.chunk.id,
      page: item.chunk.page_hint,
      excerpt: '',
    });
  }

  for (const citation of citations) {
    citation.excerpt = selected
      .filter((item) => item.chunk.id === citation.chunkId)
      .map((item) => item.sentence)
      .join(' ');
  }

  const answer = selected
    .map((item) => `${item.sentence} [${markerByChunk.get(item.chunk.id)}]`)
    .join(' ');

  const coveredRatio = covered.size / queryTerms.length;
  return { answer, confidence: toConfidence(coveredRatio), citations };
}
