import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  Hash,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import {
  apiGetDocumentStatus,
  apiGetExtractedText,
  apiGetChunks,
  apiReprocessDocument,
  type ApiChunk,
  type ExtractedTextResponse,
  type DocumentStatusResponse,
} from '@/lib/api/documents';
import { Badge, Button, Modal, Notice } from '@/components/ui';
import { FILE_TYPE_LABEL, formatBytes, formatDate } from '@/lib/format';
import type { KnowledgeDocument } from '@/types/knowledge';
import { cn } from '@/lib/cn';

interface DocumentDetailsModalProps {
  document: KnowledgeDocument;
  onClose: () => void;
  onDocumentUpdated?: () => void;
}

type ModalTab = 'overview' | 'extracted' | 'chunks' | 'logs';

export function DocumentDetailsModal({
  document,
  onClose,
  onDocumentUpdated,
}: DocumentDetailsModalProps) {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<ModalTab>('overview');

  // Chunks & Extracted Text state
  const [chunks, setChunks] = useState<ApiChunk[] | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedTextResponse | null>(null);
  const [statusData, setStatusData] = useState<DocumentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Reprocessing state
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessSuccess, setReprocessSuccess] = useState<string | null>(null);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [customChunkSize, setCustomChunkSize] = useState<number>(document.chunk_size || 500);
  const [customOverlap, setCustomOverlap] = useState<number>(document.chunk_overlap || 100);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const [chunksRes, textRes, statusRes] = await Promise.allSettled([
        apiGetChunks(document.id, 0, 100),
        apiGetExtractedText(document.id),
        apiGetDocumentStatus(document.id),
      ]);

      if (chunksRes.status === 'fulfilled') setChunks(chunksRes.value);
      if (textRes.status === 'fulfilled') setExtractedData(textRes.value);
      if (statusRes.status === 'fulfilled') setStatusData(statusRes.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetails();
  }, [document.id]);

  const handleCopyHash = () => {
    if (document.content_hash) {
      void navigator.clipboard.writeText(document.content_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    setReprocessSuccess(null);
    setReprocessError(null);
    try {
      const res = await apiReprocessDocument(document.id, customChunkSize, customOverlap);
      if (res.ok) {
        setReprocessSuccess(`Reprocessed successfully! Generated ${res.document?.chunk_count} chunks.`);
        await loadDetails();
        onDocumentUpdated?.();
      } else {
        setReprocessError(res.error_message || 'Reprocessing failed.');
      }
    } catch (err: any) {
      setReprocessError(err.message || 'Error triggering pipeline reprocessing.');
    } finally {
      setReprocessing(false);
    }
  };

  const filteredChunks = (chunks ?? []).filter(
    (c) =>
      !searchTerm.trim() ||
      c.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.section_heading && c.section_heading.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const status = statusData?.processing_status || document.processing_status || 'completed';
  const progress = statusData?.processing_progress ?? document.processing_progress ?? 100;
  const logs = statusData?.processing_logs || document.processing_logs || [];

  return (
    <Modal
      title={document.title}
      onClose={onClose}
      maxWidth="3xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              tone={
                status === 'completed'
                  ? 'green'
                  : status === 'failed'
                  ? 'orange'
                  : 'cyan'
              }
            >
              Status: {status.toUpperCase()}
            </Badge>
            {document.content_hash && (
              <span className="text-[11px] font-mono text-ink-400">
                SHA-256: {document.content_hash.slice(0, 10)}...
              </span>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-ink-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition',
              activeTab === 'overview'
                ? 'bg-ink-900 text-white shadow-soft'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
            )}
          >
            <BookOpen className="h-4 w-4" />
            Overview & Metadata
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extracted')}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition',
              activeTab === 'extracted'
                ? 'bg-ink-900 text-white shadow-soft'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
            )}
          >
            <FileText className="h-4 w-4" />
            Extracted Text ({extractedData?.sections.length || document.chunk_count})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chunks')}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition',
              activeTab === 'chunks'
                ? 'bg-ink-900 text-white shadow-soft'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
            )}
          >
            <Layers className="h-4 w-4" />
            Chunks & Embeddings ({chunks?.length || document.chunk_count})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition',
              activeTab === 'logs'
                ? 'bg-ink-900 text-white shadow-soft'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
            )}
          >
            <Terminal className="h-4 w-4" />
            Pipeline Logs ({logs.length})
          </button>
        </div>

        {/* Tab 1: Overview & Metadata */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="rounded-2xl border border-ink-200/90 bg-ink-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">File Type</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone="purple">{FILE_TYPE_LABEL[document.file_type] || document.file_type.toUpperCase()}</Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-ink-200/90 bg-ink-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">File Size</p>
                <p className="mt-1 text-sm font-bold text-ink-900">{formatBytes(document.byte_size)}</p>
              </div>
              <div className="rounded-2xl border border-ink-200/90 bg-ink-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Chunks Indexed</p>
                <p className="mt-1 text-sm font-bold text-ink-900">{document.chunk_count}</p>
              </div>
              <div className="rounded-2xl border border-ink-200/90 bg-ink-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Added Date</p>
                <p className="mt-1 text-sm font-bold text-ink-900">{formatDate(document.created_at, language)}</p>
              </div>
            </div>

            {/* Author / Date / Page metadata */}
            <div className="rounded-2xl border border-ink-200/90 bg-white p-5 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-ink-900 flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary-600" />
                Document Metadata & File Signatures
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-ink-400 font-medium">Author / Origin:</span>{' '}
                  <span className="font-bold text-ink-800">
                    {document.metadata_json?.author || 'Not specified in header'}
                  </span>
                </div>
                <div>
                  <span className="text-ink-400 font-medium">Pages / Sections:</span>{' '}
                  <span className="font-bold text-ink-800">
                    {document.metadata_json?.page_count || 1} page(s)
                  </span>
                </div>
                <div>
                  <span className="text-ink-400 font-medium">Word Count:</span>{' '}
                  <span className="font-bold text-ink-800">
                    {document.metadata_json?.word_count ? `${document.metadata_json.word_count.toLocaleString()} words` : 'Computed during chunking'}
                  </span>
                </div>
                <div>
                  <span className="text-ink-400 font-medium">Character Count:</span>{' '}
                  <span className="font-bold text-ink-800">
                    {document.metadata_json?.char_count ? `${document.metadata_json.char_count.toLocaleString()} chars` : `${document.byte_size.toLocaleString()} bytes`}
                  </span>
                </div>
              </div>

              {/* Checksum SHA-256 */}
              {document.content_hash && (
                <div className="rounded-xl bg-ink-50 p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Hash className="h-4 w-4 text-ink-400 shrink-0" />
                    <span className="font-mono text-ink-600 truncate">{document.content_hash}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCopyHash} className="shrink-0 h-8 px-2.5">
                    {copiedHash ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-ink-500" />
                    )}
                    {copiedHash ? 'Copied' : 'Copy Hash'}
                  </Button>
                </div>
              )}

              {/* OCR Notice if detected */}
              {document.metadata_json?.ocr_notice && (
                <Notice tone="warning" icon={<Cpu className="h-4 w-4 text-brand-orange" />}>
                  {document.metadata_json.ocr_notice}
                </Notice>
              )}
            </div>

            {/* Interactive Reprocessing Controls */}
            <div className="rounded-2xl border border-secondary-200 bg-secondary-50/50 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-secondary-700" />
                  <h4 className="text-sm font-bold text-ink-900">Pipeline Reprocessing Parameters</h4>
                </div>
                <Badge tone="cyan">Configurable Chunking</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1">
                    Chunk Size: {customChunkSize} characters
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="1500"
                    step="50"
                    value={customChunkSize}
                    onChange={(e) => setCustomChunkSize(Number(e.target.value))}
                    className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-secondary-600"
                  />
                  <p className="text-[11px] text-ink-400 mt-1">Smaller chunks improve pinpoint retrieval; larger chunks preserve context.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1">
                    Chunk Overlap: {customOverlap} characters
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="25"
                    value={customOverlap}
                    onChange={(e) => setCustomOverlap(Number(e.target.value))}
                    className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-secondary-600"
                  />
                  <p className="text-[11px] text-ink-400 mt-1">Sliding window overlap ensures concepts on chunk boundaries are preserved.</p>
                </div>
              </div>

              {reprocessSuccess && (
                <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" />}>
                  {reprocessSuccess}
                </Notice>
              )}

              {reprocessError && (
                <Notice tone="error" icon={<AlertTriangle className="h-4 w-4" />}>
                  {reprocessError}
                </Notice>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReprocess}
                  disabled={reprocessing}
                >
                  {reprocessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {reprocessing ? 'Reprocessing Pipeline...' : 'Reprocess Document'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Extracted Text */}
        {activeTab === 'extracted' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-ink-500 border-b border-ink-100 pb-2">
              <span className="font-bold text-ink-800">
                Extracted Structural Content ({extractedData?.sections.length ?? 0} passages)
              </span>
              <span>Total pages: {extractedData?.total_pages ?? 1}</span>
            </div>

            {loading && (
              <div className="py-12 text-center text-xs text-ink-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                Loading reconstructed document text...
              </div>
            )}

            {!loading && extractedData?.sections && extractedData.sections.length > 0 ? (
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
                {extractedData.sections.map((sec, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-ink-200/80 bg-ink-50/60 p-4 transition hover:bg-white hover:shadow-soft"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {sec.page && (
                          <span className="text-[10px] font-bold text-secondary-700 bg-secondary-100 px-2 py-0.5 rounded-md">
                            Page {sec.page}
                          </span>
                        )}
                        {sec.section_heading && (
                          <span className="text-xs font-bold text-ink-800 truncate max-w-sm">
                            {sec.section_heading}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-ink-400 font-mono">
                        ~{sec.tokens} tokens
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-ink-700 whitespace-pre-wrap">{sec.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              !loading && (
                <p className="py-8 text-center text-xs text-ink-400">
                  No extracted text found on server.
                </p>
              )
            )}
          </div>
        )}

        {/* Tab 3: Chunks & Embeddings */}
        {activeTab === 'chunks' && (
          <div className="space-y-4">
            {/* Search filter for chunks */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter chunks by content or heading..."
                  className="h-9 w-full rounded-xl border border-ink-200 pl-8 pr-3 text-xs text-ink-900 outline-none focus:border-secondary-500 focus:ring-2 focus:ring-secondary-100"
                />
              </div>
              <Badge tone="purple">Mock Embeddings (384-dim)</Badge>
            </div>

            {/* Explanation card */}
            <div className="rounded-xl border border-primary-200/70 bg-primary-50/50 p-3 text-xs text-primary-800 flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-primary-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Provider-Independent Embedding Pipeline</p>
                <p className="text-[11px] text-primary-700 mt-0.5">
                  Chunks are embedded via <span className="font-mono">mock-minilm-l6-v2</span> using deterministic lexical hashing. Vectors are unit-normalized and prepared for Qdrant vector search in Phase 05.
                </p>
              </div>
            </div>

            {/* Chunk List */}
            {loading && (
              <div className="py-12 text-center text-xs text-ink-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                Loading indexed chunks...
              </div>
            )}

            {!loading && filteredChunks.length > 0 ? (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                {filteredChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-2xl border border-ink-200/90 bg-white p-4 shadow-xs transition hover:shadow-soft"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-ink-800 bg-ink-100 px-2 py-0.5 rounded-md font-mono">
                          Chunk #{chunk.chunk_index}
                        </span>
                        {chunk.page_hint && (
                          <span className="text-[10px] font-bold text-secondary-700 bg-secondary-100 px-2 py-0.5 rounded-md">
                            Page {chunk.page_hint}
                          </span>
                        )}
                        {chunk.section_heading && (
                          <span className="text-xs font-bold text-ink-800">
                            {chunk.section_heading}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={chunk.is_mock_embedding ? 'purple' : 'green'}>
                          {chunk.is_mock_embedding ? 'Mock Vector' : 'Dense Vector'}
                        </Badge>
                        <span className="text-[10px] text-ink-400">~{chunk.token_count} tokens</span>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-ink-700">{chunk.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              !loading && (
                <p className="py-8 text-center text-xs text-ink-400">
                  No chunks match your search criteria.
                </p>
              )
            )}
          </div>
        )}

        {/* Tab 4: Pipeline Execution & Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="rounded-2xl border border-ink-200/80 bg-ink-50/70 p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ink-800">Pipeline Ingestion Progress</span>
                <span className="font-mono font-bold text-ink-600">{progress}%</span>
              </div>
              <div className="h-2.5 w-full bg-ink-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-green via-brand-cyan to-brand-purple transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Logs audit table */}
            <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-xs">
              <div className="bg-ink-100/70 px-4 py-2.5 border-b border-ink-200 text-[11px] font-bold uppercase tracking-wider text-ink-600 flex justify-between">
                <span>Stage & Event</span>
                <span>Timestamp</span>
              </div>
              <div className="divide-y divide-ink-100 max-h-[45vh] overflow-y-auto">
                {logs.length > 0 ? (
                  logs.map((entry, idx) => (
                    <div key={idx} className="p-3 text-xs flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded uppercase',
                              entry.stage === 'error'
                                ? 'bg-red-100 text-red-700'
                                : entry.stage === 'validation'
                                ? 'bg-blue-100 text-blue-700'
                                : entry.stage === 'chunking'
                                ? 'bg-purple-100 text-purple-700'
                                : entry.stage === 'embedding'
                                ? 'bg-secondary-100 text-secondary-700'
                                : 'bg-primary-100 text-primary-700',
                            )}
                          >
                            {entry.stage}
                          </span>
                        </div>
                        <p className="text-ink-700 mt-1">{entry.message}</p>
                      </div>
                      <span className="text-[10px] font-mono text-ink-400 shrink-0">
                        {entry.timestamp?.slice(11, 19) || ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-ink-400">
                    No processing logs recorded.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
