import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Network,
  Quote,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { cn } from '@/lib/cn';
import { Badge, Button, Notice } from '@/components/ui';
import type { AskResult, Citation, Confidence } from '@/types/knowledge';

const CONFIDENCE_TONE: Record<Confidence, 'green' | 'cyan' | 'orange'> = {
  high: 'green',
  medium: 'cyan',
  low: 'orange',
};

export function AskResultView({ result }: { result: AskResult }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

  if (result.citations.length === 0 && !result.answer) {
    return (
      <Notice tone="info" icon={<CircleAlert className="h-5 w-5" />}>
        {t('assistant.noEvidence')}
      </Notice>
    );
  }

  const confidenceKey =
    result.confidence === 'high'
      ? 'assistant.high'
      : result.confidence === 'medium'
      ? 'assistant.medium'
      : 'assistant.low';

  const handleCopy = () => {
    void navigator.clipboard.writeText(result.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* ── Strict Abstention Notice ── */}
      {result.abstain && (
        <Notice
          tone="warning"
          icon={<ShieldAlert className="h-5 w-5 text-brand-orange" />}
        >
          <div className="space-y-1">
            <span className="font-bold text-ink-900">Hallucination Defense — Strict Abstention:</span>
            <p className="text-xs text-ink-700 leading-relaxed">
              KnowledgeX AI detected insufficient or unverified evidence in the indexed document corpus for this specific query. To prevent factual hallucination, the engine refrained from fabricating an ungrounded answer.
            </p>
          </div>
        </Notice>
      )}

      {/* ── Conflicting Claims / Contradiction Alert ── */}
      {result.contradictions && result.contradictions.length > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50/70 p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <span className="font-bold text-sm">
              Cross-Document Contradiction Detected ({result.contradictions.length})
            </span>
          </div>
          <div className="space-y-2.5">
            {result.contradictions.map((c, i) => (
              <div key={i} className="rounded-xl border border-red-200 bg-white p-3 text-xs space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-red-700">
                  <span>Entity: {c.entity}</span>
                  <span className="uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-red-100">
                    {c.issueType}
                  </span>
                </div>
                <p className="text-ink-800 font-medium">{c.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-ink-600">
                  <div className="p-2 rounded bg-ink-50 border border-ink-100 italic">
                    "{c.passageA}"
                  </div>
                  <div className="p-2 rounded bg-ink-50 border border-ink-100 italic">
                    "{c.passageB}"
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Synthesised Answer Card ── */}
      <section className="relative overflow-hidden rounded-3xl border border-ink-200/90 bg-white p-6 sm:p-8 shadow-soft">
        <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-bl from-brand-cyan/15 via-brand-green/10 to-transparent blur-2xl pointer-events-none" />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="text-base font-bold text-ink-900 tracking-tight">
              {t('assistant.answerTitle')}
            </h3>

            {/* Model Provenance Badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border',
                result.isMockLlm !== false
                  ? 'bg-ink-100 text-ink-700 border-ink-200'
                  : 'bg-brand-lavender/40 text-brand-purple border-brand-purple/30',
              )}
            >
              {result.isMockLlm !== false ? (
                <>
                  <Zap className="h-3 w-3 text-secondary-600" />
                  Offline Heuristic Extractive Mode
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 text-brand-purple" />
                  Live LLM: {result.llmModel || result.llmProvider}
                </>
              )}
            </span>

            {/* RAG Mode */}
            {result.ragModeUsed && (
              <Badge tone="cyan" className="uppercase text-[10px]">
                {result.ragModeUsed.replace('_', ' ')}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Support Score */}
            {typeof result.supportScore === 'number' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg border border-primary-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{(result.supportScore * 100).toFixed(0)}% Supported</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-ink-500 font-medium">
              <span>{t('assistant.confidence')}:</span>
              <Badge tone={CONFIDENCE_TONE[result.confidence]}>{t(confidenceKey)}</Badge>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
              title="Copy to clipboard"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Answer Text with Interactive Citation Markers */}
        <p className="text-base leading-[1.85] text-ink-800 font-normal">
          {result.answer.split(/(\[\d+\])/).map((part, index) => {
            const match = part.match(/^\[(\d+)\]$/);
            if (!match) return <span key={index}>{part}</span>;
            const markerNum = Number(match[1]);
            const isSelected = activeCitation === markerNum;
            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setActiveCitation(markerNum);
                  const el = document.getElementById(`citation-${markerNum}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className={cn(
                  'mx-1 inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-md px-1.5 text-xs font-extrabold align-middle transition shadow-xs',
                  isSelected
                    ? 'bg-secondary-600 text-white ring-2 ring-secondary-300'
                    : 'bg-secondary-100 text-secondary-900 hover:bg-secondary-500 hover:text-white',
                )}
                title={`Jump to citation #${markerNum}`}
              >
                {markerNum}
              </button>
            );
          })}
        </p>

        {/* Graph Context Tags (if available) */}
        {result.graphContext && result.graphContext.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-ink-100">
            <span className="flex items-center gap-1 text-[11px] font-bold text-ink-500 uppercase tracking-wider">
              <Network className="h-3.5 w-3.5 text-accent-600" />
              Graph RAG Entities:
            </span>
            {result.graphContext.map((entity, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-accent-50 border border-accent-200 text-accent-800 text-xs font-medium"
              >
                {entity}
              </span>
            ))}
          </div>
        )}

        {/* Helpfulness Feedback Bar */}
        <div className="mt-6 flex items-center justify-between border-t border-ink-100 pt-4 text-xs text-ink-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary-600" />
              Verified against {result.citations.length} cited document passages
            </span>
            {result.processingTimeMs && (
              <span className="flex items-center gap-1 text-ink-400">
                <Clock className="h-3.5 w-3.5" />
                {result.processingTimeMs.toFixed(0)}ms
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-ink-500">Was this accurate?</span>
            <button
              type="button"
              onClick={() => setFeedback('up')}
              className={cn(
                'rounded-lg p-1.5 transition',
                feedback === 'up' ? 'bg-primary-100 text-primary-800' : 'hover:bg-ink-100 text-ink-500',
              )}
              title="Helpful"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setFeedback('down')}
              className={cn(
                'rounded-lg p-1.5 transition',
                feedback === 'down' ? 'bg-red-100 text-red-800' : 'hover:bg-ink-100 text-ink-500',
              )}
              title="Inaccurate"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Evidence Citations Grid ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500 flex items-center gap-2">
            <FileText className="h-4 w-4 text-secondary-600" />
            {t('assistant.evidenceTitle')} ({result.citations.length})
          </h4>
          <span className="text-xs text-ink-400">Click markers above to highlight</span>
        </div>

        <ol className="grid gap-4 md:grid-cols-2">
          {result.citations.map((citation: Citation) => {
            const isSelected = activeCitation === citation.marker;
            return (
              <li
                key={citation.chunkId}
                id={`citation-${citation.marker}`}
                onClick={() => setActiveCitation(citation.marker)}
                className={cn(
                  'cursor-pointer scroll-mt-24 rounded-2xl border bg-white p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift',
                  isSelected
                    ? 'border-secondary-500 ring-2 ring-secondary-200 bg-secondary-50/20'
                    : 'border-ink-200',
                )}
              >
                <div className="mb-3 flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition shadow-soft',
                      isSelected ? 'bg-secondary-600 text-white' : 'bg-ink-900 text-white',
                    )}
                  >
                    {citation.marker}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-sm text-ink-900" title={citation.documentTitle}>
                      {citation.documentTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-500">
                      {citation.page ? (
                        <span className="rounded bg-ink-100 px-1.5 py-0.2 font-medium">
                          {t('assistant.page')} {citation.page}
                        </span>
                      ) : (
                        <span className="rounded bg-ink-100 px-1.5 py-0.2 font-medium">Document Body</span>
                      )}
                      {citation.sectionHeading && (
                        <span className="truncate max-w-[140px] text-[11px] text-ink-400 italic">
                          &bull; {citation.sectionHeading}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <blockquote className="rounded-xl border border-ink-100 bg-ink-50/80 p-3.5 text-xs leading-relaxed text-ink-700">
                  <Quote className="mb-1 h-3.5 w-3.5 text-secondary-600 inline mr-1 opacity-70" />
                  <span>{citation.excerpt}</span>
                </blockquote>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-green via-brand-cyan to-brand-purple transition-all duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
