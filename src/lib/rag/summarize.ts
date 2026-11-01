import { countWords, splitUnits, tokenize } from '@/lib/text/text-utils';

export interface KeyPointResult {
  points: string[];
  coverage: number;
  wordCount: number;
}

interface TextSource {
  content: string;
}

export function extractKeyPoints(sources: TextSource[], count: number): KeyPointResult {
  const units = sources.flatMap((source) => splitUnits(source.content));
  const allTokens = units.flatMap((unit) => tokenize(unit));
  const frequency = new Map<string, number>();
  for (const token of allTokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  const scored = units
    .map((unit, index) => {
      const tokens = tokenize(unit);
      if (tokens.length < 3) return null;
      const unique = [...new Set(tokens)];
      const weight = unique.reduce((sum, token) => sum + (frequency.get(token) ?? 0), 0);
      const leadBonus = index < units.length * 0.15 ? 1.1 : 1;
      return { unit, index, score: (leadBonus * weight) / Math.sqrt(tokens.length) };
    })
    .filter((item): item is { unit: string; index: number; score: number } => item !== null && item.score > 0);

  const picked = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.index - b.index);

  const points = [...new Set(picked.map((item) => item.unit))];
  const totalWords = countWords(units.join(' '));
  const selectedWords = countWords(points.join(' '));

  return {
    points,
    coverage: totalWords === 0 ? 0 : selectedWords / totalWords,
    wordCount: totalWords,
  };
}
