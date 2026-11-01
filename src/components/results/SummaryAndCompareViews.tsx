import { CheckCircle2, GitCompare, Sparkles } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { Badge, Card } from '@/components/ui';
import { ScoreBar } from '@/components/results/AskResultView';
import type { CompareResult, SummaryResult } from '@/types/knowledge';

export function SummaryResultView({ result }: { result: SummaryResult }) {
  const { t } = useTranslation();
  const coveragePercent = Math.round(result.coverage * 100);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 border-ink-200">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-400">{t('summarize.wordCount')}</p>
          <p className="mt-2 text-2xl font-black text-ink-900">{result.wordCount.toLocaleString()}</p>
        </Card>
        <Card className="p-5 sm:col-span-2 border-ink-200">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400">{t('summarize.coverage')}</p>
            <span className="text-sm font-bold text-primary-700">{coveragePercent}% Scanned</span>
          </div>
          <ScoreBar value={coveragePercent} className="mt-4" />
        </Card>
      </div>

      <Card className="border-ink-200 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Sparkles className="h-4 w-4" />
          </span>
          <h3 className="text-lg font-bold text-ink-900 tracking-tight">{t('summarize.result')}</h3>
        </div>
        <ol className="space-y-4">
          {result.points.map((point, index) => (
            <li key={`${index}-${point.slice(0, 16)}`} className="flex items-start gap-4 p-3 rounded-2xl bg-ink-50/70 border border-ink-100 transition hover:bg-white hover:shadow-soft">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-xs font-bold text-white shadow-soft">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-ink-800 pt-0.5">{point}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function TermGroup({
  title,
  terms,
  tone,
  description,
}: {
  title: string;
  terms: string[];
  tone: 'cyan' | 'purple' | 'orange' | 'green' | 'lavender';
  description?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-bold text-ink-900">{title}</h4>
        {description && <p className="text-xs text-ink-400 mt-0.5">{description}</p>}
      </div>
      {terms.length === 0 ? (
        <p className="text-xs text-ink-400 rounded-xl bg-ink-50 p-3">{t('compare.noShared')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {terms.map((term) => (
            <Badge key={term} tone={tone}>
              {term}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function KeyPoints({ title, points, accent }: { title: string; points: string[]; accent: string }) {
  return (
    <Card className="space-y-4 border-ink-200">
      <h4 className="text-sm font-bold text-ink-900 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        {title}
      </h4>
      <ul className="space-y-2.5">
        {points.map((point, index) => (
          <li key={`${index}-${point.slice(0, 16)}`} className="flex gap-2.5 text-xs sm:text-sm leading-relaxed text-ink-700 bg-ink-50/60 p-3 rounded-xl border border-ink-100">
            <span className="font-bold text-ink-400">{index + 1}.</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CompareResultView({ result }: { result: CompareResult }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-fade-up">
      {/* ── Similarity Score Banner ── */}
      <Card className="border-ink-200 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GitCompare className="h-4 w-4 text-secondary-600" />
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">{t('compare.similarity')}</p>
            </div>
            <p className="text-4xl font-black text-ink-900">{result.similarity}%</p>
          </div>
          <div className="rounded-2xl bg-ink-50 px-4 py-2 text-xs text-ink-600 border border-ink-200">
            <span className="font-bold text-ink-900">{result.documentA}</span>
            <span className="mx-2 text-ink-400">vs</span>
            <span className="font-bold text-ink-900">{result.documentB}</span>
          </div>
        </div>
        <ScoreBar value={result.similarity} className="mt-5" />
      </Card>

      {/* ── Terms Breakdown ── */}
      <Card className="space-y-6 border-ink-200 p-6 sm:p-8">
        <div className="rounded-2xl border border-secondary-200 bg-secondary-50/30 p-5">
          <TermGroup
            title={t('compare.shared')}
            description="Concepts and keywords present in both source documents"
            terms={result.shared}
            tone="cyan"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-accent-200 bg-accent-50/30 p-5">
            <TermGroup
              title={t('compare.uniqueA')}
              description={`Distinct to ${result.documentA}`}
              terms={result.uniqueA}
              tone="purple"
            />
          </div>
          <div className="rounded-2xl border border-warm-200 bg-warm-50/30 p-5">
            <TermGroup
              title={t('compare.uniqueB')}
              description={`Distinct to ${result.documentB}`}
              terms={result.uniqueB}
              tone="orange"
            />
          </div>
        </div>
      </Card>

      {/* ── Excerpt Contrasts ── */}
      <div className="grid gap-6 md:grid-cols-2">
        <KeyPoints title={`${t('compare.keyPointsA')} (${result.documentA})`} points={result.keyPointsA} accent="bg-accent-500" />
        <KeyPoints title={`${t('compare.keyPointsB')} (${result.documentB})`} points={result.keyPointsB} accent="bg-warm-500" />
      </div>
    </div>
  );
}
