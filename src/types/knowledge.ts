export type FileType = 'pdf' | 'docx' | 'txt' | 'html';

export type ProcessingStatus =
  | 'pending'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'completed'
  | 'failed';

export interface ProcessingLogEntry {
  stage: string;
  timestamp: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  file_name: string;
  file_type: FileType;
  byte_size: number;
  chunk_count: number;
  is_demo: boolean;
  content_hash?: string;
  processing_status?: ProcessingStatus;
  processing_progress?: number;
  processing_error?: string | null;
  processing_logs?: ProcessingLogEntry[];
  chunk_size?: number;
  chunk_overlap?: number;
  metadata_json?: Record<string, any>;
  current_version?: number;
  created_at: string;
  updated_at?: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  page_hint: number | null;
  section_heading?: string | null;
  content: string;
  token_count?: number;
  embedding_model?: string | null;
  is_mock_embedding?: boolean;
}

export interface ChunkWithDocument extends DocumentChunk {
  documentTitle: string;
}

export type HistoryKind = 'ask' | 'summary' | 'compare';

export type Confidence = 'high' | 'medium' | 'low';

export interface Citation {
  marker: number;
  documentId: string;
  documentTitle: string;
  chunkId: string;
  page: number | null;
  sectionHeading?: string | null;
  excerpt: string;
  relevanceScore?: number;
}

export interface Contradiction {
  entity: string;
  issueType: string;
  description: string;
  passageA: string;
  passageB: string;
}

export interface AskResult {
  answer: string;
  confidence: Confidence;
  citations: Citation[];
  supportScore?: number;
  contradictions?: Contradiction[];
  abstain?: boolean;
  ragModeUsed?: string;
  llmProvider?: string;
  llmModel?: string;
  isMockLlm?: boolean;
  graphContext?: string[];
  processingTimeMs?: number;
}

export interface SummaryResult {
  points: string[];
  documentTitle: string;
  coverage: number;
  wordCount: number;
}

export interface CompareResult {
  similarity: number;
  documentA: string;
  documentB: string;
  shared: string[];
  uniqueA: string[];
  uniqueB: string[];
  keyPointsA: string[];
  keyPointsB: string[];
}

export type HistoryResult = AskResult | SummaryResult | CompareResult;

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  query: string;
  language: 'en' | 'ta';
  document_ids: string[];
  result: HistoryResult;
  created_at: string;
}
