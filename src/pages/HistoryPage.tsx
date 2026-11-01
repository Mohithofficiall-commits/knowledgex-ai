import { useEffect, useMemo, useState } from 'react';
import { History, Search, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { clearHistory, deleteHistoryEntry, listHistory } from '@/services/historyService';
import { cn } from '@/lib/cn';
import type { TranslationKey } from '@/i18n/translations';
import type { HistoryEntry, HistoryKind } from '@/types/knowledge';
import { Button, EmptyState, Modal, Notice } from '@/components/ui';
import { HistoryEntryCard } from '@/components/history/HistoryEntryCard';

type KindFilter = 'all' | HistoryKind;

const KIND_FILTERS: { value: KindFilter; labelKey: TranslationKey }[] = [
  { value: 'all', labelKey: 'history.kindAll' },
  { value: 'ask', labelKey: 'history.kindAsk' },
  { value: 'summary', labelKey: 'history.kindSummary' },
  { value: 'compare', labelKey: 'history.kindCompare' },
];

export function HistoryPage() {
  const { t } = useTranslation();
  const { documents } = useLibrary();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [textFilter, setTextFilter] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);

  const loadEntries = async () => {
    setLoadFailed(false);
    try {
      setEntries(await listHistory());
    } catch {
      setLoadFailed(true);
    }
  };

  useEffect(() => {
    let active = true;
    listHistory()
      .then((rows) => {
        if (active) setEntries(rows);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = textFilter.trim().toLowerCase();
    return (entries ?? []).filter(
      (entry) =>
        (kindFilter === 'all' || entry.kind === kindFilter) &&
        (needle === '' || entry.query.toLowerCase().includes(needle)),
    );
  }, [entries, kindFilter, textFilter]);

  const handleDelete = async (entryId: string) => {
    setActionError(false);
    try {
      await deleteHistoryEntry(entryId);
      setEntries((current) => current?.filter((entry) => entry.id !== entryId) ?? null);
    } catch {
      setActionError(true);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setActionError(false);
    try {
      await clearHistory();
      setEntries([]);
      setConfirmingClear(false);
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight text-ink-900">{t('history.title')}</h2>
          <p className="max-w-2xl text-ink-500">{t('history.subtitle')}</p>
        </div>
        {entries && entries.length > 0 && (
          <Button variant="danger" onClick={() => setConfirmingClear(true)}>
            {t('history.clearAll')}
          </Button>
        )}
      </div>

      {loadFailed && (
        <Notice
          tone="error"
          icon={<TriangleAlert className="h-5 w-5" />}
          action={
            <Button size="sm" variant="secondary" onClick={() => void loadEntries()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('common.connectionError')}
        </Notice>
      )}

      {actionError && (
        <Notice tone="error" icon={<TriangleAlert className="h-5 w-5" />}>
          {t('common.connectionError')}
        </Notice>
      )}

      {entries === null && !loadFailed && <p className="text-sm text-ink-500">{t('common.loading')}</p>}

      {entries && entries.length === 0 && (
        <EmptyState icon={<History className="h-6 w-6" />} title={t('history.emptyTitle')} description={t('history.emptyDesc')} />
      )}

      {entries && entries.length > 0 && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                value={textFilter}
                onChange={(event) => setTextFilter(event.target.value)}
                placeholder={t('history.searchPlaceholder')}
                aria-label={t('history.searchPlaceholder')}
                className="h-11 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-4 text-sm text-ink-900 placeholder:text-ink-400 outline-none transition focus:border-secondary-500 focus:ring-4 focus:ring-secondary-100"
              />
            </div>
            <div className="inline-flex flex-wrap gap-1 rounded-full bg-ink-100 p-1 ring-1 ring-ink-200">
              {KIND_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setKindFilter(filter.value)}
                  aria-pressed={kindFilter === filter.value}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-semibold transition',
                    kindFilter === filter.value ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-600 hover:text-ink-900',
                  )}
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-300 bg-white/60 p-8 text-center text-sm text-ink-500">
              {t('history.noResults')}
            </p>
          ) : (
            <div className="space-y-4">
              {visible.map((entry) => (
                <HistoryEntryCard
                  key={entry.id}
                  entry={entry}
                  documents={documents}
                  onDelete={() => void handleDelete(entry.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {confirmingClear && (
        <Modal
          title={t('history.clearAll')}
          onClose={() => !busy && setConfirmingClear(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmingClear(false)} disabled={busy}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={handleClear} loading={busy}>
                {t('history.clearAll')}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-ink-600">{t('history.confirmClear')}</p>
        </Modal>
      )}
    </div>
  );
}
