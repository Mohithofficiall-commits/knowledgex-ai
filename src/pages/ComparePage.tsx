import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSearch,
  FileText,
  GitCompare,
  History,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { compareDocuments } from '@/lib/rag/compare';
import { routeHref } from '@/lib/router';
import { fetchChunks } from '@/services/documentService';
import { addHistoryEntry } from '@/services/historyService';
import { apiCompare, apiCompareVersions, type VersionCompareResponse } from '@/lib/api/rag';
import { checkBackendHealth } from '@/lib/api/client';
import { Badge, Button, Card, EmptyState, Notice } from '@/components/ui';
import { CompareResultView } from '@/components/results/SummaryAndCompareViews';
import { DocumentSelect } from '@/components/documents/DocumentSelect';
import { LoadDemoButton } from '@/components/documents/LoadDemoButton';
import { cn } from '@/lib/cn';
import type { CompareResult } from '@/types/knowledge';

type CompareMode = 'documents' | 'versions';

export function ComparePage() {
  const { t, language } = useTranslation();
  const { documents, status } = useLibrary();

  // Mode: cross-document vs historical versions
  const [mode, setMode] = useState<CompareMode>('documents');

  // Cross-document state
  const [chosenA, setChosenA] = useState('');
  const [chosenB, setChosenB] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);

  // Version comparison state
  const [versionDocId, setVersionDocId] = useState<string>('');
  const [versionA, setVersionA] = useState<number>(1);
  const [versionB, setVersionB] = useState<number>(2);
  const [versionResult, setVersionResult] = useState<VersionCompareResponse | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle');

  const idA = documents.some((doc) => doc.id === chosenA) ? chosenA : (documents[0]?.id ?? '');
  const idB = documents.some((doc) => doc.id === chosenB) ? chosenB : (documents[1]?.id ?? '');
  const docA = documents.find((doc) => doc.id === idA);
  const docB = documents.find((doc) => doc.id === idB);

  const activeVersionDoc = documents.find(
    (d) => d.id === (versionDocId || documents[0]?.id),
  );

  const handleCompare = async () => {
    if (!docA || !docB || docA.id === docB.id) return;
    setRunning(true);
    setError(null);
    setSaveState('idle');
    try {
      let comparison: CompareResult;
      const health = await checkBackendHealth();
      if (health.reachable) {
        try {
          const resp = await apiCompare(docA.id, docB.id, language as 'en' | 'ta');
          comparison = {
            similarity: resp.similarity,
            documentA: resp.document_a,
            documentB: resp.document_b,
            shared: resp.shared,
            uniqueA: resp.unique_a,
            uniqueB: resp.unique_b,
            keyPointsA: resp.key_points_a,
            keyPointsB: resp.key_points_b,
          };
        } catch {
          const [chunksA, chunksB] = await Promise.all([fetchChunks([docA]), fetchChunks([docB])]);
          comparison = compareDocuments(
            { title: docA.title, content: chunksA.map((chunk) => chunk.content) },
            { title: docB.title, content: chunksB.map((chunk) => chunk.content) },
          );
        }
      } else {
        const [chunksA, chunksB] = await Promise.all([fetchChunks([docA]), fetchChunks([docB])]);
        comparison = compareDocuments(
          { title: docA.title, content: chunksA.map((chunk) => chunk.content) },
          { title: docB.title, content: chunksB.map((chunk) => chunk.content) },
        );
      }
      setResult(comparison);
      try {
        await addHistoryEntry({
          kind: 'compare',
          query: `${docA.title} / ${docB.title}`,
          language,
          document_ids: [docA.id, docB.id],
          result: comparison,
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

  const handleCompareVersions = async () => {
    if (!activeVersionDoc) return;
    setRunning(true);
    setError(null);
    setVersionResult(null);
    try {
      const resp = await apiCompareVersions(activeVersionDoc.id, versionA, versionB);
      setVersionResult(resp);
    } catch (err: any) {
      setError(err?.message || 'Could not compare versions on backend. Ensure both versions exist for this document.');
    } finally {
      setRunning(false);
    }
  };

  if (status === 'ready' && documents.length === 0) {
    return (
      <EmptyState
        icon={<FileSearch className="h-6 w-6" />}
        title={t('library.emptyTitle')}
        description={t('compare.needTwo')}
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

  const sameDocument = docA !== undefined && docB !== undefined && docA.id === docB.id;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
            <GitCompare className="h-4 w-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-secondary-700">
            Comparative Reasoning Engine
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">{t('compare.title')}</h2>
            <p className="max-w-2xl text-sm text-ink-500 mt-0.5">
              Compare semantic divergence across multiple documents or track clause-level historical version evolution.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex rounded-xl bg-ink-100 p-1 ring-1 ring-ink-200">
            <button
              type="button"
              onClick={() => {
                setMode('documents');
                setError(null);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition',
                mode === 'documents'
                  ? 'bg-white text-ink-900 shadow-soft'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <GitCompare className="h-3.5 w-3.5" />
              Two Documents
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('versions');
                setError(null);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition',
                mode === 'versions'
                  ? 'bg-white text-ink-900 shadow-soft'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <History className="h-3.5 w-3.5 text-brand-purple" />
              Historical Version Diff
            </button>
          </div>
        </div>
      </div>

      {mode === 'documents' ? (
        <>
          {status === 'ready' && documents.length < 2 && (
            <Notice tone="info" icon={<GitCompare className="h-5 w-5" />}>
              {t('compare.needTwo')}
            </Notice>
          )}

          {/* ── Document Picker Card ── */}
          <Card className="p-6 sm:p-8 shadow-soft border-ink-200 space-y-6">
            <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-2xl border border-accent-200/80 bg-accent-50/20 p-5">
                <DocumentSelect
                  id="compare-first"
                  label={t('compare.docA')}
                  value={idA}
                  documents={documents}
                  onChange={setChosenA}
                  disabledId={idB}
                />
              </div>

              <div className="flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-900 text-xs font-black text-white shadow-soft">
                  VS
                </span>
              </div>

              <div className="rounded-2xl border border-warm-200/80 bg-warm-50/20 p-5">
                <DocumentSelect
                  id="compare-second"
                  label={t('compare.docB')}
                  value={idB}
                  documents={documents}
                  onChange={setChosenB}
                  disabledId={idA}
                />
              </div>
            </div>

            {sameDocument && (
              <Notice tone="warning" icon={<TriangleAlert className="h-5 w-5" />}>
                {t('compare.sameDoc')}
              </Notice>
            )}

            <div className="flex items-center justify-between border-t border-ink-100 pt-5">
              <span className="text-xs text-ink-500">
                Computes Jaccard lexical overlap, isolates unique concepts, and flags conflicting assertions.
              </span>
              <Button
                size="lg"
                variant="cyan"
                onClick={handleCompare}
                loading={running}
                disabled={!docA || !docB || sameDocument}
                className="shadow-glow"
              >
                <GitCompare className="h-4 w-4" />
                {t('compare.run')}
              </Button>
            </div>
          </Card>

          {error && (
            <Notice tone="error" icon={<TriangleAlert className="h-5 w-5" />}>
              {error}
            </Notice>
          )}

          {saveState === 'saved' && <p className="text-xs font-semibold text-primary-700">✓ {t('compare.saved')}</p>}

          {result && <CompareResultView result={result} />}
        </>
      ) : (
        /* ── Historical Version Evolution Mode ── */
        <div className="space-y-6">
          <Card className="p-6 sm:p-8 shadow-soft border-ink-200 space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">
                Target Knowledge Document
              </label>
              <select
                value={activeVersionDoc?.id || ''}
                onChange={(e) => setVersionDocId(e.target.value)}
                className="h-11 w-full rounded-xl border border-ink-200 px-3.5 text-xs sm:text-sm text-ink-900 outline-none focus:border-secondary-500 focus:ring-2 focus:ring-secondary-100 bg-white font-medium"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} (Current v{d.current_version || 1})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 p-4 rounded-xl border border-ink-200 bg-ink-50/50">
                <label className="text-xs font-bold text-ink-700">Baseline Version (A)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={versionA}
                  onChange={(e) => setVersionA(parseInt(e.target.value, 10) || 1)}
                  className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-xl border border-ink-200 bg-ink-50/50">
                <label className="text-xs font-bold text-ink-700">Target Revision (B)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={versionB}
                  onChange={(e) => setVersionB(parseInt(e.target.value, 10) || 2)}
                  className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-ink-100 pt-5">
              <span className="text-xs text-ink-500">
                Analyzes clause additions, deletions, contract edits, and assesses regulatory risk delta.
              </span>
              <Button
                size="lg"
                variant="primary"
                onClick={handleCompareVersions}
                loading={running}
                disabled={!activeVersionDoc || versionA === versionB}
              >
                <History className="h-4 w-4 mr-1.5" />
                Analyze Version Evolution
              </Button>
            </div>
          </Card>

          {error && (
            <Notice tone="error" icon={<TriangleAlert className="h-5 w-5" />}>
              {error}
            </Notice>
          )}

          {versionResult && (
            <div className="space-y-6 animate-fade-up">
              {/* Overview Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-5 border-ink-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-ink-500">Semantic Retention</span>
                    <p className="text-2xl font-black text-ink-900 mt-1">
                      {(versionResult.similarity_score * 100).toFixed(1)}%
                    </p>
                  </div>
                  <Badge tone="cyan">v{versionResult.version_a} &rarr; v{versionResult.version_b}</Badge>
                </Card>

                <Card className="p-5 border-ink-200 sm:col-span-2">
                  <span className="text-xs font-semibold text-ink-500">Risk Assessment Delta</span>
                  <div className="flex items-center gap-2 mt-1">
                    <ShieldAlert className="h-5 w-5 text-brand-orange" />
                    <p className="text-sm font-bold text-ink-900">{versionResult.risk_delta}</p>
                  </div>
                </Card>
              </div>

              {/* Clause Changes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Added Clauses */}
                <Card className="p-5 border-ink-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-primary-700 uppercase tracking-wider">
                      <PlusCircle className="h-4 w-4" /> Added Provisions ({versionResult.added_clauses.length})
                    </span>
                  </div>
                  {versionResult.added_clauses.length === 0 ? (
                    <p className="text-xs text-ink-400 italic">No new clauses added.</p>
                  ) : (
                    <ul className="space-y-2">
                      {versionResult.added_clauses.map((clause, idx) => (
                        <li key={idx} className="rounded-lg bg-primary-50 p-3 text-xs text-primary-900 border border-primary-200 leading-relaxed">
                          + {clause}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                {/* Removed Clauses */}
                <Card className="p-5 border-ink-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-wider">
                      <MinusCircle className="h-4 w-4" /> Removed Provisions ({versionResult.removed_clauses.length})
                    </span>
                  </div>
                  {versionResult.removed_clauses.length === 0 ? (
                    <p className="text-xs text-ink-400 italic">No clauses deleted.</p>
                  ) : (
                    <ul className="space-y-2">
                      {versionResult.removed_clauses.map((clause, idx) => (
                        <li key={idx} className="rounded-lg bg-red-50 p-3 text-xs text-red-900 border border-red-200 leading-relaxed">
                          - {clause}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {/* Modified Clauses */}
              {versionResult.modified_clauses && versionResult.modified_clauses.length > 0 && (
                <Card className="p-5 border-ink-200 space-y-3">
                  <span className="text-xs font-bold text-ink-700 uppercase tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="h-4 w-4 text-brand-purple" />
                    Modified Clause Alignments ({versionResult.modified_clauses.length})
                  </span>
                  <div className="space-y-3">
                    {versionResult.modified_clauses.map((mod, i) => (
                      <div key={i} className="rounded-xl border border-ink-200 p-3 text-xs space-y-2 bg-ink-50/40">
                        <div className="text-red-700 bg-red-50 p-2 rounded border border-red-100">
                          <span className="font-bold">v{versionResult.version_a}: </span>{mod.old}
                        </div>
                        <div className="text-primary-800 bg-primary-50 p-2 rounded border border-primary-100">
                          <span className="font-bold">v{versionResult.version_b}: </span>{mod.new}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
