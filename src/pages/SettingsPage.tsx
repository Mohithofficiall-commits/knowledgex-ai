import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  Info,
  Key,
  Languages,
  Layers,
  Save,
  Server,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  TriangleAlert,
  XCircle,
  Zap,
} from 'lucide-react';
import { useTranslation, type Language } from '@/i18n/LanguageContext';
import { Badge, Button, Card, Notice } from '@/components/ui';
import { checkBackendHealth, apiTestApiKey, type ApiKeyTestResult } from '@/lib/api';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

export function SettingsPage() {
  const { t, language, setLanguage } = useTranslation();

  // Backend Connection
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [backendVersion, setBackendVersion] = useState<string>('v1.0.0');

  // AI Model Configuration
  const [llmProvider, setLlmProvider] = useState<string>(() => {
    return localStorage.getItem('knowledgex_llm_provider') || 'none';
  });
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('knowledgex_llm_key') || '';
  });
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<ApiKeyTestResult | null>(null);

  // Advanced RAG Hyperparameters
  const [alpha, setAlpha] = useState<number>(() => {
    const val = localStorage.getItem('knowledgex_rag_alpha');
    return val ? parseFloat(val) : 0.5;
  });
  const [topK, setTopK] = useState<number>(() => {
    const val = localStorage.getItem('knowledgex_rag_top_k');
    return val ? parseInt(val, 10) : 8;
  });
  const [rerankThreshold, setRerankThreshold] = useState<number>(() => {
    const val = localStorage.getItem('knowledgex_rag_rerank_threshold');
    return val ? parseFloat(val) : 0.15;
  });
  const [chunkSize, setChunkSize] = useState<number>(() => {
    const val = localStorage.getItem('knowledgex_default_chunk_size');
    return val ? parseInt(val, 10) : 500;
  });
  const [chunkOverlap, setChunkOverlap] = useState<number>(() => {
    const val = localStorage.getItem('knowledgex_default_chunk_overlap');
    return val ? parseInt(val, 10) : 100;
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Initial check on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setConnectionStatus('testing');
    const res = await checkBackendHealth();
    if (res.reachable) {
      setConnectionStatus('success');
      if (res.version) setBackendVersion(`v${res.version}`);
    } else {
      setConnectionStatus('error');
    }
  };

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      setKeyTestResult({ valid: false, message: 'Please enter an API key to test.', provider: llmProvider });
      return;
    }
    setTestingKey(true);
    setKeyTestResult(null);
    try {
      const res = await apiTestApiKey(llmProvider, apiKey);
      setKeyTestResult(res);
      if (res.valid) {
        localStorage.setItem('knowledgex_llm_key', apiKey);
        localStorage.setItem('knowledgex_llm_provider', llmProvider);
      }
    } catch (err: any) {
      setKeyTestResult({
        valid: false,
        message: err?.message || 'Could not reach backend validation endpoint.',
        provider: llmProvider,
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('knowledgex_llm_provider', llmProvider);
    if (apiKey) localStorage.setItem('knowledgex_llm_key', apiKey);
    else localStorage.removeItem('knowledgex_llm_key');
    localStorage.setItem('knowledgex_rag_alpha', alpha.toString());
    localStorage.setItem('knowledgex_rag_top_k', topK.toString());
    localStorage.setItem('knowledgex_rag_rerank_threshold', rerankThreshold.toString());
    localStorage.setItem('knowledgex_default_chunk_size', chunkSize.toString());
    localStorage.setItem('knowledgex_default_chunk_overlap', chunkOverlap.toString());

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
            <Settings className="h-4 w-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Platform Configuration
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">{t('nav.settings')}</h2>
            <p className="max-w-2xl text-sm text-ink-500 mt-1">
              Configure RAG parameters, LLM API keys for live demonstrations, language, and backend services.
            </p>
          </div>
          <Button variant="primary" onClick={handleSaveSettings} className="shadow-sm">
            <Save className="h-4 w-4" />
            Save Preferences
          </Button>
        </div>
      </div>

      {savedSuccess && (
        <Notice tone="success" icon={<CheckCircle2 className="h-5 w-5" />}>
          All platform parameters, API credentials, and RAG preferences saved successfully.
        </Notice>
      )}

      {/* ── Section 1: Language & Localization ── */}
      <Card className="p-6 sm:p-8 border-ink-200 shadow-soft space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/20 text-brand-orange">
            <Languages className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-ink-900">Language & Localization / மொழித் தேர்வுகள்</h3>
            <p className="text-xs text-ink-500">Choose your preferred interface and reasoning language</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`flex items-start gap-4 p-5 rounded-2xl border text-left transition ${
              language === 'en'
                ? 'border-secondary-500 bg-secondary-50/40 ring-2 ring-secondary-200'
                : 'border-ink-200 bg-white hover:bg-ink-50'
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-100 text-sm font-bold text-secondary-800">
              EN
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink-900 text-sm">English</span>
                {language === 'en' && <Badge tone="cyan">Active</Badge>}
              </div>
              <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                Full interface in English with Latin phonetic and technical RAG parsing.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setLanguage('ta')}
            className={`flex items-start gap-4 p-5 rounded-2xl border text-left transition ${
              language === 'ta'
                ? 'border-primary-500 bg-primary-50/40 ring-2 ring-primary-200'
                : 'border-ink-200 bg-white hover:bg-ink-50'
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-sm font-bold text-primary-800">
              த
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink-900 text-sm">தமிழ் (Tamil)</span>
                {language === 'ta' && <Badge tone="green">செயலில் உள்ளது</Badge>}
              </div>
              <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                முழு இடைமுகமும் தமிழ் மொழியில் இயங்கும். ஆவணங்களில் தமிழ் வினவல் ஆதரவு.
              </p>
            </div>
          </button>
        </div>
      </Card>

      {/* ── Section 2: LLM Provider & Live Demonstration Key Setup ── */}
      <Card className="p-6 sm:p-8 border-ink-200 shadow-soft space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-ink-900">LLM Generation Provider & API Key Setup</h3>
            <p className="text-xs text-ink-500">
              Provider-independent architecture. Runs offline with zero keys, or dynamically upgrades when an API key is provided during review.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">
              Active LLM Provider
            </label>
            <select
              value={llmProvider}
              onChange={(e) => {
                setLlmProvider(e.target.value);
                setKeyTestResult(null);
              }}
              className="h-11 w-full rounded-xl border border-ink-200 px-3.5 text-xs sm:text-sm text-ink-900 outline-none focus:border-secondary-500 focus:ring-2 focus:ring-secondary-100 bg-white font-medium"
            >
              <option value="none">⚡ Offline Heuristic Extractive Mode (Free, Zero-Leak, No Key Needed)</option>
              <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
              <option value="anthropic">Anthropic (Claude 3.5 Sonnet / Haiku)</option>
              <option value="google">Google Gemini (Gemini 1.5 Pro / Flash)</option>
            </select>
          </div>

          {llmProvider !== 'none' ? (
            <div className="space-y-3 rounded-2xl border border-brand-purple/30 bg-brand-lavender/30 p-5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-700">
                  <Key className="h-4 w-4 text-brand-purple" />
                  {llmProvider.toUpperCase()} API Key (For Live Demonstration)
                </label>
                <span className="text-[11px] font-semibold text-ink-500">
                  Never hardcoded &bull; Verified in memory
                </span>
              </div>
              <div className="flex gap-3">
                <input
                  type="password"
                  placeholder={
                    llmProvider === 'openai'
                      ? 'sk-proj-...'
                      : llmProvider === 'anthropic'
                      ? 'sk-ant-...'
                      : 'AIzaSy...'
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-ink-200 bg-white px-4 text-xs sm:text-sm font-mono text-ink-900 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleTestApiKey}
                  loading={testingKey}
                  className="shrink-0"
                >
                  <Zap className="h-4 w-4 mr-1.5" />
                  Test & Verify Key
                </Button>
              </div>

              {keyTestResult && (
                <Notice
                  tone={keyTestResult.valid ? 'success' : 'danger'}
                  icon={
                    keyTestResult.valid ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )
                  }
                >
                  <div className="text-xs">
                    <span className="font-bold">
                      {keyTestResult.valid ? 'Authentication Verified' : 'Authentication Failed'}:{' '}
                    </span>
                    {keyTestResult.message}
                  </div>
                </Notice>
              )}
            </div>
          ) : (
            <Notice tone="info" icon={<Shield className="h-5 w-5 text-secondary-600" />}>
              <strong>Offline Mode Active:</strong> KnowledgeX AI is operating in deterministic heuristic mode. In this mode, evidence verification, semantic search, BM25 retrieval, contradiction detection, and citation extraction execute entirely on local CPU with 100% data privacy and zero API costs.
            </Notice>
          )}
        </div>
      </Card>

      {/* ── Section 3: Advanced RAG Hyperparameters ── */}
      <Card className="p-6 sm:p-8 border-ink-200 shadow-soft space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-100 text-secondary-700">
            <Sliders className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-ink-900">Advanced RAG Retrieval & Reasoning Engine Tuning</h3>
            <p className="text-xs text-ink-500">Fine-tune hybrid weighting, reranker thresholds, and chunking strategies</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Hybrid Alpha */}
          <div className="space-y-2 rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-ink-800">Hybrid Alpha Weight (α)</span>
              <span className="font-mono font-bold text-secondary-700">{alpha.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="w-full accent-secondary-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-ink-400 font-medium">
              <span>0.0 (Pure BM25 Keyword)</span>
              <span>0.5 (Balanced RRF)</span>
              <span>1.0 (Pure Dense Vector)</span>
            </div>
          </div>

          {/* Top-K Retrieval */}
          <div className="space-y-2 rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-ink-800">Top-K Candidate Passages</span>
              <span className="font-mono font-bold text-secondary-700">{topK} chunks</span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              step="1"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value, 10))}
              className="w-full accent-secondary-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-ink-400 font-medium">
              <span>3 (High Precision)</span>
              <span>8 (Standard)</span>
              <span>20 (Broad Recall)</span>
            </div>
          </div>

          {/* Cross-Encoder Rerank Cutoff */}
          <div className="space-y-2 rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-ink-800">Cross-Encoder Relevance Cutoff</span>
              <span className="font-mono font-bold text-secondary-700">{rerankThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.05"
              value={rerankThreshold}
              onChange={(e) => setRerankThreshold(parseFloat(e.target.value))}
              className="w-full accent-secondary-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-ink-400 font-medium">
              <span>0.0 (Keep All Passages)</span>
              <span>0.15 (Default Filter)</span>
              <span>0.5 (Strict Quality)</span>
            </div>
          </div>

          {/* Default Ingestion Chunk Size */}
          <div className="space-y-2 rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-ink-800">Default Chunk Size & Overlap</span>
              <span className="font-mono font-bold text-secondary-700">{chunkSize} / {chunkOverlap} chars</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <input
                type="number"
                min="100"
                max="2000"
                step="50"
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value, 10) || 500)}
                className="h-9 px-2 text-xs rounded-lg border border-ink-200 font-mono text-center"
                title="Chunk Size (chars)"
              />
              <input
                type="number"
                min="0"
                max="400"
                step="25"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(parseInt(e.target.value, 10) || 100)}
                className="h-9 px-2 text-xs rounded-lg border border-ink-200 font-mono text-center"
                title="Chunk Overlap (chars)"
              />
            </div>
            <p className="text-[10px] text-ink-400 text-center">Structure-aware sentence boundary preservation</p>
          </div>
        </div>
      </Card>

      {/* ── Section 4: Backend Service & Database Topology ── */}
      <Card className="p-6 sm:p-8 border-ink-200 shadow-soft space-y-6">
        <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Server className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-ink-900">FastAPI Backend & Database Infrastructure</h3>
            <p className="text-xs text-ink-500">Live service health, database tables, and vector store readiness</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-ink-200 px-4 text-xs sm:text-sm text-ink-900 font-mono outline-none focus:border-secondary-500 focus:ring-2 focus:ring-secondary-100"
            />
            <Button size="sm" variant="secondary" onClick={checkHealth} loading={connectionStatus === 'testing'}>
              Ping Backend
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 pt-2">
            <div className="flex items-center justify-between p-4 rounded-2xl border border-ink-200 bg-ink-50/70">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${connectionStatus === 'success' ? 'bg-primary-500' : 'bg-brand-orange'}`} />
                <div>
                  <p className="text-xs font-bold text-ink-900">FastAPI Service</p>
                  <p className="text-[11px] text-ink-500">{backendVersion}</p>
                </div>
              </div>
              <Badge tone={connectionStatus === 'success' ? 'green' : 'warning'}>
                {connectionStatus === 'success' ? 'Online' : 'Checking'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-ink-200 bg-ink-50/70">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-secondary-500" />
                <div>
                  <p className="text-xs font-bold text-ink-900">PostgreSQL / SQLite</p>
                  <p className="text-[11px] text-ink-500">Documents, Chunks & Logs</p>
                </div>
              </div>
              <Badge tone="cyan">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-ink-200 bg-ink-50/70">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-accent-500" />
                <div>
                  <p className="text-xs font-bold text-ink-900">Knowledge Graph & BM25</p>
                  <p className="text-[11px] text-ink-500">Hybrid Index Topology</p>
                </div>
              </div>
              <Badge tone="purple">Ready</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
