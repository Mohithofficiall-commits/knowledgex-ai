import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Badge, Button } from '@/components/ui';
import { AskResultView } from '@/components/results/AskResultView';
import { CompareResultView, SummaryResultView } from '@/components/results/SummaryAndCompareViews';
import type { AskResult, CompareResult, HistoryEntry, KnowledgeDocument, SummaryResult } from '@/types/knowledge';

const KIND_LABEL: Record<HistoryEntry['kind'], TranslationKey> = {
  ask: 'history.kindAsk',
  summary: 'history.kindSummary',
  compare: 'history.kindCompare',
};

const KIND_TONE: Record<HistoryEntry['kind'], 'green' | 'cyan' | 'purple'> = {
  ask: 'green',
  summary: 'cyan',
  compare: 'purple',
};

interface HistoryEntryCardProps {
  entry: HistoryEntry;
  documents: KnowledgeDocument[];
  onDelete: () => void;
}

function EntryResult({ entry }: { entry: HistoryEntry }) {
  switch (entry.kind) {
    case 'ask':
      return <AskResultView result={entry.result as AskResult} />;
    case 'summary':
      return <SummaryResultView result={entry.result as SummaryResult} />;
    case 'compare':
      return <CompareResultView result={entry.result as CompareResult} />;
  }
}

export function HistoryEntryCard({ entry, documents, onDelete }: HistoryEntryCardProps) {
  const { t, language } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const usedTitles = documents.filter((doc) => entry.document_ids.includes(doc.id)).map((doc) => doc.title);
  const documentLabel =
    entry.document_ids.length === 0
      ? t('history.allDocuments')
      : usedTitles.length > 0
        ? usedTitles.join(', ')
        : `${entry.document_ids.length} ${t('common.documents')}`;

  return (
    <article className="overflow-hidden rounded-3xl border border-ink-200/90 bg-white shadow-soft transition-all duration-300 hover:shadow-lift">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={KIND_TONE[entry.kind]}>{t(KIND_LABEL[entry.kind])}</Badge>
            <span className="text-xs text-ink-400 font-medium">{formatDateTime(entry.created_at, language)}</span>
          </div>
          <p className="text-base font-bold text-ink-900 leading-snug">{entry.query}</p>
          <p className="text-xs text-ink-500">
            <span className="font-semibold text-ink-600">{t('history.documents')}: </span>
            {documentLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
          <Button variant="secondary" size="sm" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
            {expanded ? t('history.collapse') : t('history.expand')}
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', expanded && 'rotate-180')} />
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete} aria-label={t('history.deleteEntry')}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-ink-100 bg-ink-50/50 p-6 sm:p-8 animate-fade-in">
          <EntryResult entry={entry} />
        </div>
      )}
    </article>
  );
}
