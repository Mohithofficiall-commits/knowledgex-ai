import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Cpu,
  FileSearch,
  Filter,
  Info,
  Key,
  Network,
  RotateCcw,
  Search,
  Send,
  Shield,
  Sliders,
  Sparkles,
  TriangleAlert,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { answerQuestion } from '@/lib/rag/answer';
import { callClientLlm } from '@/lib/rag/client_llm';
import { routeHref } from '@/lib/router';
import { fetchChunks } from '@/services/documentService';
import { addHistoryEntry } from '@/services/historyService';
import { apiAsk, apiTestApiKey, type AskRequestOptions } from '@/lib/api/rag';
import { checkBackendHealth } from '@/lib/api/client';
import { Badge, Button, Card, EmptyState, Notice } from '@/components/ui';
import { AskResultView } from '@/components/results/AskResultView';
import { DocumentScopePicker } from '@/components/documents/DocumentSelect';
import { LoadDemoButton } from '@/components/documents/LoadDemoButton';
import { cn } from '@/lib/cn';
import type { AskResult } from '@/types/knowledge';

type ScopeMode = 'all' | 'selected';
type RagMode = 'hybrid' | 'graph_rag' | 'crag' | 'agentic';

interface ChatTurn {
  id: string;
  question: string;
  result: AskResult;
  timestamp: Date;
}

export function AssistantPage() {
  const { t, language } = useTranslation();
  const { documents, status } = useLibrary();
  const [question, setQuestion] = useState('');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ragMode, setRagMode] = useState<RagMode>('hybrid');
  const [asking, setAsking] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle');

  // Quick API Key Management Drawer
  const [showKeyDrawer, setShowKeyDrawer] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>(() => {
    return localStorage.getItem('knowledgex_llm_provider') || 'none';
  });
  const [inputApiKey, setInputApiKey] = useState<string>(() => {
    return localStorage.getItem('knowledgex_llm_key') || '';
  });
  const [keySavedFeedback, setKeySavedFeedback] = useState<string | null>(null);

  const scopeDocuments = useMemo(
    () => (scopeMode === 'all' ? documents : documents.filter((doc) => selectedIds.includes(doc.id))),
    [documents, scopeMode, selectedIds],
  );

  const examples = [
    t('assistant.exampleOne'),
    t('assistant.exampleTwo'),
    t('assistant.exampleThree'),
  ];

  const toggleDocument = (documentId: string) => {
    setSelectedIds((current) =>
      current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId],
    );
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('knowledgex_llm_provider', activeProvider);
    if (inputApiKey.trim()) {
      localStorage.setItem('knowledgex_llm_key', inputApiKey.trim());
      setKeySavedFeedback('API key activated! Live generative AI enabled.');
    } else {
      localStorage.removeItem('knowledgex_llm_key');
      setKeySavedFeedback('Offline heuristic mode activated.');
    }
    setTimeout(() => {
      setKeySavedFeedback(null);
      setShowKeyDrawer(false);
    }, 1800);
  };

  const runQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || asking) return;
    if (scopeDocuments.length === 0) {
      setError(t('assistant.scopeHint'));
      return;
    }

    setAsking(true);
    setError(null);
    setSaveState('idle');
    setQuestion('');

    try {
      let result: AskResult;
      const backendHealth = await checkBackendHealth();

      const storedProvider = localStorage.getItem('knowledgex_llm_provider') || 'none';
      const storedKey = localStorage.getItem('knowledgex_llm_key') || undefined;
      const storedAlpha = localStorage.getItem('knowledgex_rag_alpha');
      const alphaVal = storedAlpha ? parseFloat(storedAlpha) : 0.5;

      if (backendHealth.reachable) {
        try {
          const docIds = scopeDocuments.map((doc) => doc.id);

          const conversationHistory = turns.slice(0, 3).reverse().flatMap((t) => [
            { role: 'user' as const, content: t.question },
            { role: 'assistant' as const, content: t.result.answer },
          ]);

          const askOptions: AskRequestOptions = {
            documentIds: docIds,
            language: language as 'en' | 'ta',
            ragMode,
            alpha: alphaVal,
            conversationHistory,
            overrideLlmProvider: storedProvider !== 'none' ? storedProvider : undefined,
            overrideApiKey: storedKey,
          };

          const resp = await apiAsk(trimmed, askOptions);
          result = {
            answer: resp.answer,
            confidence: resp.confidence,
            supportScore: resp.support_score,
            abstain: resp.abstain,
            ragModeUsed: resp.rag_mode_used,
            llmProvider: resp.llm_provider,
            llmModel: resp.llm_model,
            isMockLlm: resp.is_mock_llm,
            graphContext: resp.graph_context,
            processingTimeMs: resp.processing_time_ms,
            contradictions: resp.contradictions.map((c) => ({
              entity: c.entity,
              issueType: c.issue_type,
              description: c.description,
              passageA: c.passage_a,
              passageB: c.passage_b,
            })),
            citations: resp.citations.map((c) => ({
              marker: c.marker,
              documentId: c.document_id,
              documentTitle: c.document_title,
              chunkId: c.chunk_id,
              page: c.page,
              sectionHeading: c.section_heading,
              excerpt: c.excerpt,
              relevanceScore: c.relevance_score,
            })),
          };
        } catch (err: any) {
          console.warn('Backend RAG call fallback to local engine:', err);
          const chunks = await fetchChunks(scopeDocuments);
          const extractiveResult = answerQuestion(trimmed, chunks);
          result = extractiveResult;
        }
      } else {
        // Local engine execution (Offline or GitHub Pages)
        const chunks = await fetchChunks(scopeDocuments);
        const extractiveResult = answerQuestion(trimmed, chunks);

        // If user configured an API key, call client-side LLM for real live synthesis!
        if (storedProvider && storedProvider !== 'none' && storedKey) {
          try {
            const clientEvidence = extractiveResult.citations.map((c) => ({
              title: c.documentTitle,
              page: c.page,
              text: c.excerpt,
            }));

            const llmRes = await callClientLlm({
              provider: storedProvider as any,
              apiKey: storedKey,
              query: trimmed,
              evidence: clientEvidence,
              language: language as 'en' | 'ta',
            });

            result = {
              answer: llmRes.answer,
              confidence: extractiveResult.confidence,
              supportScore: 0.95,
              abstain: false,
              ragModeUsed: ragMode,
              llmProvider: llmRes.providerUsed,
              llmModel: llmRes.modelUsed,
              isMockLlm: false,
              citations: extractiveResult.citations,
            };
          } catch (clientErr: any) {
            console.warn('Client LLM direct call failed, using extractive:', clientErr);
            result = extractiveResult;
          }
        } else {
          result = extractiveResult;
        }
      }

      const newTurn: ChatTurn = {
        id: String(Date.now()),
        question: trimmed,
        result,
        timestamp: new Date(),
      };
      setTurns((prev) => [newTurn, ...prev]);

      try {
        await addHistoryEntry({
          kind: 'ask',
          query: trimmed,
          language,
          document_ids: scopeDocuments.map((doc) => doc.id),
          result,
        });
        setSaveState('saved');
      } catch {
        setSaveState('failed');
      }
    } catch {
      setError(t('common.connectionError'));
    } finally {
      setAsking(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runQuestion(question);
  };

  const handleClearChat = () => {
    setTurns([]);
    setQuestion('');
    setError(null);
    setSaveState('idle');
  };

  if (status === 'ready' && documents.length === 0) {
    return (
      <EmptyState
        icon={<FileSearch className="h-6 w-6" />}
        title={t('library.emptyTitle')}
        description={t('assistant.noDocs')}
        action={
          <div className="flex flex-col items-center gap-4">
            <a href={routeHref('/library')}>
              <Button variant="primary">
                {t('assistant.noDocsCta')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <LoadDemoButton />
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
              <Bot className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-secondary-700">
              Evidence-Attributed Advanced RAG
            </span>
          </div>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900">{t('assistant.title')}</h2>
          <p className="text-sm text-ink-500">{t('assistant.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKeyDrawer((v) => !v)}
            className="border-brand-purple/40 text-brand-purple hover:bg-brand-purple/10"
          >
            <Key className="h-3.5 w-3.5 mr-1" />
            {activeProvider !== 'none' && inputApiKey ? 'API Key Active' : 'Set API Key'}
          </Button>

          {turns.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearChat}>
              <RotateCcw className="h-3.5 w-3.5" />
              {t('assistant.newQuestion')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Quick API Key Configuration Card (Collapsible) ── */}
      {showKeyDrawer && (
        <Card className="p-5 border-brand-purple/30 bg-gradient-to-r from-brand-lavender/30 via-white to-accent-50/20 shadow-md space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-purple text-white shadow-soft">
                <Key className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-ink-900">LLM Generation Provider & API Key</h4>
                <p className="text-xs text-ink-500">
                  Mandatory configuration for live external LLM generation or offline CPU extraction.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowKeyDrawer(false)}
              className="text-ink-400 hover:text-ink-700 p-1 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4 space-y-1">
              <label className="text-[11px] font-bold uppercase text-ink-600">Provider</label>
              <select
                value={activeProvider}
                onChange={(e) => setActiveProvider(e.target.value)}
                className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-900"
              >
                <option value="none">Offline Heuristic Extractor</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="google">Google Gemini (1.5 Flash)</option>
                <option value="anthropic">Anthropic Claude (3.5 Haiku)</option>
              </select>
            </div>

            <div className="sm:col-span-6 space-y-1">
              <label className="text-[11px] font-bold uppercase text-ink-600">API Key Secret</label>
              <input
                type="password"
                placeholder={
                  activeProvider === 'openai'
                    ? 'sk-proj-...'
                    : activeProvider === 'google'
                    ? 'AIzaSy...'
                    : activeProvider === 'anthropic'
                    ? 'sk-ant-...'
                    : 'No key needed for offline mode'
                }
                disabled={activeProvider === 'none'}
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
                className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-xs font-mono text-ink-900 placeholder:text-ink-400 disabled:bg-ink-100"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <Button size="sm" variant="primary" onClick={handleSaveApiKey} className="w-full h-10">
                Activate
              </Button>
            </div>
          </div>

          {keySavedFeedback && (
            <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" />}>
              {keySavedFeedback}
            </Notice>
          )}
        </Card>
      )}

      {/* ── Active Status Banner ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-3.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              activeProvider !== 'none' && inputApiKey ? 'bg-primary-500 animate-pulse' : 'bg-brand-orange',
            )}
          />
          <span className="text-xs font-bold text-ink-800">
            {activeProvider !== 'none' && inputApiKey
              ? `Live Generative Engine Active: ${activeProvider.toUpperCase()}`
              : '⚡ Deterministic Offline Extractive Engine Active (Free & Private)'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowKeyDrawer(true)}
          className="text-xs font-bold text-secondary-700 hover:text-secondary-900 underline underline-offset-2"
        >
          {activeProvider !== 'none' && inputApiKey ? 'Switch / Reconfigure Key' : 'Configure API Key →'}
        </button>
      </div>

      {/* ── Input Box & Controls ── */}
      <Card className="p-6 sm:p-7 shadow-soft border-ink-200 space-y-4">
        {/* RAG Engine Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-brand-purple" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-600">RAG Engine Mode:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'hybrid', label: 'Hybrid (BM25 + Dense RRF)', icon: Sliders },
              { id: 'graph_rag', label: 'Graph RAG (Entities)', icon: Network },
              { id: 'crag', label: 'Corrective RAG (CRAG)', icon: Brain },
              { id: 'agentic', label: 'Agentic RAG (Sub-Queries)', icon: Zap },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRagMode(m.id as RagMode)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                    ragMode === m.id
                      ? 'bg-ink-900 text-white shadow-soft'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200 hover:text-ink-900',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
            <input
              id="assistant-question"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t('assistant.placeholder')}
              className="h-14 w-full rounded-2xl border border-ink-200 bg-white pl-12 pr-28 text-sm sm:text-base text-ink-900 placeholder:text-ink-400 outline-none transition focus:border-secondary-500 focus:ring-4 focus:ring-secondary-100 shadow-xs"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <Button size="sm" variant="cyan" type="submit" loading={asking} disabled={!question.trim()}>
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('assistant.ask')}</span>
              </Button>
            </div>
          </div>

          {/* Scope Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-ink-100">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-ink-400" />
              <span className="text-xs font-semibold text-ink-600">{t('assistant.scope')}:</span>
              <div className="inline-flex rounded-xl bg-ink-100 p-0.5 ring-1 ring-ink-200">
                {(['all', 'selected'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScopeMode(mode)}
                    className={cn(
                      'rounded-lg px-3 py-1 text-xs font-semibold transition',
                      scopeMode === mode ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500 hover:text-ink-900',
                    )}
                  >
                    {mode === 'all'
                      ? `${t('assistant.scopeAll')} (${documents.length})`
                      : t('assistant.scopeSelected')}
                  </button>
                ))}
              </div>
            </div>

            {saveState === 'saved' && (
              <span className="text-xs font-semibold text-primary-700">✓ {t('assistant.saved')}</span>
            )}
          </div>

          {scopeMode === 'selected' && (
            <div className="rounded-2xl border border-ink-200 bg-ink-50/60 p-4 space-y-2">
              <p className="text-xs font-medium text-ink-500">{t('assistant.scopeHint')}</p>
              <DocumentScopePicker documents={documents} selectedIds={selectedIds} onToggle={toggleDocument} />
            </div>
          )}
        </form>

        {/* Suggestion Quick Chips */}
        {turns.length === 0 && !asking && (
          <div className="mt-6 space-y-2.5 border-t border-ink-100 pt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-orange" />
              {t('assistant.examples')}
            </p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void runQuestion(example)}
                  className="rounded-xl border border-ink-200 bg-ink-50/80 px-3.5 py-1.5 text-left text-xs font-medium text-ink-700 transition hover:border-secondary-300 hover:bg-secondary-50/70 hover:text-secondary-900"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Status / Loading ── */}
      {error && (
        <Notice tone="error" icon={<TriangleAlert className="h-5 w-5" />}>
          {error}
        </Notice>
      )}

      {asking && (
        <div className="flex items-center gap-3 rounded-2xl border border-secondary-200 bg-secondary-50/40 p-5 text-sm font-medium text-secondary-900 shadow-soft animate-pulse">
          <span className="flex h-3 w-3 rounded-full bg-secondary-500" />
          <span>Executing {ragMode.toUpperCase()} Retrieval & Evidence Verification Pipeline...</span>
        </div>
      )}

      {/* ── Chat Turns Timeline ── */}
      <div className="space-y-8">
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-4">
            {/* User Question Bubble */}
            <div className="flex items-start justify-end gap-3">
              <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-gradient-to-r from-ink-800 to-ink-900 px-5 py-3.5 text-white shadow-soft">
                <p className="text-sm font-semibold">{turn.question}</p>
                <span className="mt-1 block text-[10px] text-slate-400 text-right">
                  {turn.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white shadow-soft">
                <User className="h-4 w-4" />
              </span>
            </div>

            {/* AI Synthesised Response with Evidence */}
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-green via-brand-cyan to-brand-purple text-white shadow-soft mt-1">
                <Bot className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <AskResultView result={turn.result} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
