import { extractKeyPoints } from '@/lib/rag/summarize';
import { tokenize } from '@/lib/text/text-utils';
import type { CompareResult } from '@/types/knowledge';

interface ComparableDocument {
  title: string;
  content: string[];
}

const TOP_TERMS = 10;
const KEY_POINTS = 3;

function termFrequencies(texts: string[]) {
  const frequency = new Map<string, number>();
  for (const text of texts) {
    for (const token of tokenize(text)) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  const total = [...frequency.values()].reduce((sum, value) => sum + value, 0) || 1;
  return { frequency, total };
}

export function compareDocuments(first: ComparableDocument, second: ComparableDocument): CompareResult {
  const a = termFrequencies(first.content);
  const b = termFrequencies(second.content);
  const vocabulary = new Set([...a.frequency.keys(), ...b.frequency.keys()]);

  let dot = 0;
  let normA = 0;
  let normB = 0;
  const shared: { term: string; strength: number }[] = [];
  const uniqueA: { term: string; strength: number }[] = [];
  const uniqueB: { term: string; strength: number }[] = [];

  for (const term of vocabulary) {
    const countA = a.frequency.get(term) ?? 0;
    const countB = b.frequency.get(term) ?? 0;
    const weightA = Math.log1p(countA);
    const weightB = Math.log1p(countB);
    dot += weightA * weightB;
    normA += weightA * weightA;
    normB += weightB * weightB;

    const relA = countA / a.total;
    const relB = countB / b.total;
    if (countA > 0 && countB > 0) {
      shared.push({ term, strength: Math.min(relA, relB) });
    } else if (countA >= 2 && relA > 0) {
      uniqueA.push({ term, strength: relA });
    } else if (countB >= 2 && relB > 0) {
      uniqueB.push({ term, strength: relB });
    }
  }

  const similarity = normA && normB ? Math.round((dot / Math.sqrt(normA * normB)) * 100) : 0;
  const byStrength = (list: { term: string; strength: number }[]) =>
    [...list].sort((x, y) => y.strength - x.strength).slice(0, TOP_TERMS).map((item) => item.term);

  const keyA = extractKeyPoints(first.content.map((content) => ({ content })), KEY_POINTS).points;
  const keyB = extractKeyPoints(second.content.map((content) => ({ content })), KEY_POINTS).points;

  return {
    similarity,
    documentA: first.title,
    documentB: second.title,
    shared: byStrength(shared),
    uniqueA: byStrength(uniqueA),
    uniqueB: byStrength(uniqueB),
    keyPointsA: keyA,
    keyPointsB: keyB,
  };
}
