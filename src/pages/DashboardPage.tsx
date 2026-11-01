import { useEffect, useState, type ReactNode } from 'react';
import {
  Database,
  FileText,
  MessageSquareText,
  Sparkles,
  Upload,
  GitCompare,
  FlaskConical,
  Network,
  Settings,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { listHistory } from '@/services/historyService';
import { routeHref, type AppRoute } from '@/lib/router';
import { formatDate, formatDateTime } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Notice } from '@/components/ui';
import { LoadDemoButton } from '@/components/documents/LoadDemoButton';
import type { HistoryEntry } from '@/types/knowledge';
import type { TranslationKey } from '@/i18n/translations';

interface FeatureNavCard {
  route: Exclude<AppRoute, '/'>;
  title: string;
  description: string;
  icon: typeof Upload;
  accent: 'green' | 'cyan' | 'purple' | 'orange' | 'neutral';
  badge?: string;
}

const DASHBOARD_MODULES: FeatureNavCard[] = [
  {
    route: '/assistant',
    title: 'AI Assistant',
    description: 'Query documents with multi-passage citation & evidence attribution',
    icon: MessageSquareText,
    accent: 'cyan',
    badge: 'Core RAG',
  },
  {
    route: '/library',
    title: 'Document Library',
    description: 'Browse, inspect, and organize all ingested documents and chunks',
    icon: BookOpen,
    accent: 'green',
  },
  {
    route: '/library',
    title: 'Upload Documents',
    description: 'Ingest PDF, DOCX, and TXT files with automatic text chunking',
    icon: Upload,
    accent: 'orange',
  },
  {
    route: '/research',
    title: 'Research Workspace',
    description: 'Deep-dive sessions with cross-document analysis & evidence chains',
    icon: FlaskConical,
    accent: 'purple',
    badge: 'New',
  },
  {
    route: '/compare',
    title: 'Document Comparison',
    description: 'Side-by-side contrast of concepts, overlapping themes & unique points',
    icon: GitCompare,
    accent: 'cyan',
  },
  {
    route: '/knowledge-graph',
    title: 'Knowledge Graph',
    description: 'Interactive concept map and entity relations across documents',
    icon: Network,
    accent: 'purple',
    badge: 'Graph',
  },
  {
    route: '/summarize',
    title: 'Summarize',
    description: 'Extract concise, multi-level key takeaways from any document',
    icon: Sparkles,
    accent: 'green',
  },
  {
    route: '/settings',
    title: 'Platform Settings',
    description: 'Configure PostgreSQL, Qdrant, FastAPI backend and LLM provider',
    icon: Settings,
    accent: 'neutral',
  },
];

const ACCENT_STYLES = {
  green: {
    bg: 'bg-primary-50',
    text: 'text-primary-700',
    border: 'hover:border-primary-300',
    badge: 'green' as const,
  },
  cyan: {
    bg: 'bg-secondary-50',
    text: 'text-secondary-700',
    border: 'hover:border-secondary-300',
    badge: 'cyan' as const,
  },
  purple: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'hover:border-accent-300',
    badge: 'purple' as const,
  },
  orange: {
    bg: 'bg-warm-50',
    text: 'text-warm-700',
    border: 'hover:border-warm-300',
    badge: 'orange' as const,
  },
  neutral: {
    bg: 'bg-ink-100',
    text: 'text-ink-700',
    border: 'hover:border-ink-400',
    badge: 'neutral' as const,
  },
};

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

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: ReactNode; accent: 'green' | 'cyan' | 'purple' | 'orange' }) {
  const styles = ACCENT_STYLES[accent];
  return (
    <Card className="flex items-center gap-4 p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${styles.bg} ${styles.text}`}>
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p>
        <p className="text-2xl font-bold text-ink-900">{value.toLocaleString()}</p>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { t, language } = useTranslation();
  const { documents, status, reload } = useLibrary();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);

  useEffect(() => {
    let active = true;
    listHistory()
      .then((entries) => {
        if (active) setHistory(entries);
      })
      .catch(() => {
        if (active) setHistoryFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const totalPassages = documents.reduce((sum, doc) => sum + doc.chunk_count, 0);
  const questionCount = history?.filter((entry) => entry.kind === 'ask').length ?? 0;
  const analysisCount = history?.filter((entry) => entry.kind !== 'ask').length ?? 0;
  const recentDocuments = documents.slice(0, 4);
  const recentActivity = (history ?? []).slice(0, 5);

  return (
    <div className="space-y-10">
      {/* ── Greeting & System Status ── */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800 ring-1 ring-primary-200">
            <span className="h-2 w-2 rounded-full bg-primary-500" />
            KnowledgeX AI Platform v1.0
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-ink-900">{t('dashboard.greeting')}</h2>
          <p className="text-ink-500">{t('dashboard.subtitle')}</p>
        </div>

        {/* System Architecture Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 font-medium text-ink-700 shadow-soft">
            <Database className="h-3.5 w-3.5 text-secondary-600" />
            PostgreSQL / pgvector
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 font-medium text-ink-700 shadow-soft">
            <Cpu className="h-3.5 w-3.5 text-accent-600" />
            Qdrant Vector DB
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 font-medium text-ink-700 shadow-soft">
            <Activity className="h-3.5 w-3.5 text-primary-600" />
            FastAPI Backend
          </span>
        </div>
      </div>

      {status === 'error' && (
        <Notice
          tone="error"
          icon={<Database className="h-5 w-5" />}
          action={
            <Button size="sm" variant="secondary" onClick={() => void reload()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('common.connectionError')}
        </Notice>
      )}

      {/* ── Stat Counters ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('dashboard.statDocuments')} value={documents.length} icon={<FileText className="h-6 w-6" />} accent="green" />
        <StatCard label={t('dashboard.statChunks')} value={totalPassages} icon={<Database className="h-6 w-6" />} accent="cyan" />
        <StatCard label={t('dashboard.statQuestions')} value={questionCount} icon={<MessageSquareText className="h-6 w-6" />} accent="purple" />
        <StatCard label={t('dashboard.statSummaries')} value={analysisCount} icon={<Sparkles className="h-6 w-6" />} accent="orange" />
      </section>

      {/* ── All Navigation Modules ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink-900">Platform Navigation & Workspace</h3>
          <span className="text-xs font-semibold text-ink-400">8 Modules Ready</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DASHBOARD_MODULES.map(({ route, title, description, icon: Icon, accent, badge }) => {
            const styles = ACCENT_STYLES[accent];
            return (
              <a
                key={title}
                href={routeHref(route)}
                className={`group flex flex-col justify-between rounded-2xl border border-ink-200 bg-white p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift ${styles.border}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${styles.bg} ${styles.text} transition duration-200 group-hover:scale-105`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    {badge && <Badge tone={styles.badge}>{badge}</Badge>}
                  </div>
                  <h4 className="mt-4 font-bold text-ink-900 group-hover:text-ink-950">{title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">{description}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-secondary-700 transition group-hover:translate-x-1">
                  Open module
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── Recent Documents & Activity ── */}
      <div className="grid gap-8 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-ink-900">{t('dashboard.recentDocuments')}</h3>
            <a href={routeHref('/library')} className="text-sm font-semibold text-secondary-700 hover:text-secondary-900">
              {t('dashboard.viewAll')}
            </a>
          </div>
          {status === 'loading' && <p className="text-sm text-ink-500">{t('common.loading')}</p>}
          {status !== 'loading' && recentDocuments.length === 0 && (
            <EmptyState
              icon={<Upload className="h-6 w-6" />}
              title={t('library.emptyTitle')}
              description={t('dashboard.noDocuments')}
              action={<LoadDemoButton variant="primary" />}
            />
          )}
          {recentDocuments.length > 0 && (
            <ul className="divide-y divide-ink-200 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
              {recentDocuments.map((doc) => (
                <li key={doc.id} className="flex items-center gap-4 px-5 py-4 transition hover:bg-ink-50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900">{doc.title}</p>
                    <p className="text-xs text-ink-500">{formatDate(doc.created_at, language)} · {doc.chunk_count} passages</p>
                  </div>
                  {doc.is_demo && <Badge tone="orange">{t('common.demo')}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-ink-900">{t('dashboard.recentActivity')}</h3>
            <a href={routeHref('/history')} className="text-sm font-semibold text-secondary-700 hover:text-secondary-900">
              {t('dashboard.viewAll')}
            </a>
          </div>
          {historyFailed && (
            <Notice tone="error" icon={<Database className="h-5 w-5" />}>
              {t('common.connectionError')}
            </Notice>
          )}
          {!historyFailed && history !== null && recentActivity.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink-300 bg-white/60 p-6 text-sm text-ink-500">
              {t('dashboard.noActivity')}
            </p>
          )}
          <ul className="space-y-3">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Badge tone={KIND_TONE[entry.kind]}>{t(KIND_LABEL[entry.kind])}</Badge>
                  <span className="text-xs text-ink-500">{formatDateTime(entry.created_at, language)}</span>
                </div>
                <p className="line-clamp-2 text-sm font-medium text-ink-800">{entry.query}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
