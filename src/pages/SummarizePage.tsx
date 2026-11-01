import { useState } from 'react';
import { FileSearch, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { extractKeyPoints } from '@/lib/rag/summarize';
import { routeHref } from '@/lib/router';
import { fetchChunks } from '@/services/documentService';
import { addHistoryEntry } from '@/services/historyService';
import { cn } from '@/lib/cn';
import { Button, Card, EmptyState, Notice } from '@/components/ui';
import { SummaryResultView } from '@/components/results/SummaryAndCompareViews';
import { DocumentSelect } from '@/components/documents/DocumentSelect';
import { LoadDemoButton } from '@/components/documents/LoadDemoButton';
import type { SummaryResult } from '@/types/knowledge';
import type { TranslationKey } from '@/i18n/translations';

type SummaryLength = 'short' | 'medium' | 'detailed';

const LENGTH_POINTS: Record<SummaryLength, number> = { short: 3, medium: 6, detailed: 10 };

const LENGTH_OPTIONS: { value: SummaryLength; labelKey: TranslationKey }[] = [
  { value: 'short', labelKey: 'summarize.short' },
  { value: 'medium', labelKey: 'summarize.medium' },
  { value: 'detailed', labelKey: 'summarize.detailed' },
];

export function SummarizePage() {
  const { t, language } = useTranslation();
  const { documents, status } = useLibrary();
  const [chosenId, setChosenId] = useState('');
  const [length, setLength] = useState<SummaryLength>('medium');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle');

  const selectedId = documents.some((doc) => doc.id === chosenId) ? chosenId : (documents[0]?.id ?? '');
  const selectedDocument = documents.find((doc) => doc.id === selectedId);

  const handleGenerate = async () => {
    if (!selectedDocument) return;
    setRunning(true);
    setError(null);
    setSaveState('idle');
    try {
      const chunks = await fetchChunks([selectedDocument]);
      const summary = extractKeyPoints(chunks, LENGTH_POINTS[length]);
      const next: SummaryResult = {
        points: summary.points,
        documentTitle: selectedDocument.title,
        coverage: summary.coverage,
        wordCount: summary.wordCount,
      };
      setResult(next);
      try {
        await addHistoryEntry({
          kind: 'summary',
          query: selectedDocument.title,
          language,
          document_ids: [selectedDocument.id],
          result: next,
        });
        setSaveState('saved');
      } catch {
        setSaveState('failed');
      }
    } catch {
      setError(t('common.connectionError'));
    } finally {
      setRunning(false);
    }
  };

  if (status === 'ready' && documents.length === 0) {
    return (
      <EmptyState
        icon={<FileSearch className="h-6 w-6" />}
        title={t('library.emptyTitle')}
        description={t('summarize.needDoc')}
        action={
          <div className="flex flex-col items-center gap-4">
            <a href={routeHref('/library')}>
              <Button variant="primary">{t('assistant.noDocsCta')}</Button>
            </a>
            <LoadDemoButton />
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-primary-700">
            Key Insight Synthesis
          </span>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">{t('summarize.title')}</h2>
        <p className="max-w-2xl text-sm text-ink-500">{t('summarize.subtitle')}</p>
      </div>

      <Card className="space-y-6 p-6 sm:p-8 shadow-soft border-ink-200">
        <div className="grid gap-6 md:grid-cols-2">
          <DocumentSelect
            id="summary-document"
            label={t('summarize.chooseDoc')}
            value={selectedId}
            documents={documents}
            onChange={setChosenId}
          />
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-ink-500">{t('summarize.length')}</span>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-ink-100 p-1 ring-1 ring-ink-200">
              {LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLength(option.value)}
                  aria-pressed={length === option.value}
                  className={cn(
                    'h-10 rounded-xl text-xs sm:text-sm font-semibold transition',
                    length === option.value ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-600 hover:text-ink-900',
                  )}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 pt-5">
          <span className="text-xs text-ink-400">
            Extracts {LENGTH_POINTS[length]} non-redundant core takeaways
          </span>
          <Button size="lg" variant="primary" onClick={handleGenerate} loading={running} disabled={!selectedDocument} className="shadow-glow-green">
            <Sparkles className="h-4 w-4" />
            {t('summarize.generate')}
          </Button>
        </div>
      </Card>

      {error && (
        <Notice tone="error" icon={<TriangleAlert className="h-5 w-5" />}>
          {error}
        </Notice>
      )}

      {saveState === 'saved' && <p className="text-xs font-semibold text-primary-700">✓ {t('summarize.saved')}</p>}

      {result && <SummaryResultView result={result} />}
    </div>
  );
}
