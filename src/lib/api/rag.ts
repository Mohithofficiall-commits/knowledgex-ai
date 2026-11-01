/**
 * RAG API service – Ask / Summarize / Compare / Version Compare endpoints on FastAPI backend.
 * Features Hybrid Search, BM25 + Dense RRF, Cross-Encoder Reranking, Graph RAG,
 * Contradiction Detection, Evidence Verification, Hallucination Abstention, and Version Comparison.
 */
import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────

export interface ApiCitation {
  marker: number;
  document_id: string;
  document_title: string;
  chunk_id: string;
  page: number | null;
  section_heading?: string | null;
  excerpt: string;
  relevance_score?: number;
}

export interface Contradiction {
  entity: string;
  issue_type: string;
  description: string;
  passage_a: string;
  passage_b: string;
}

export interface AskResponse {
  query: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  support_score: number;
  citations: ApiCitation[];
  contradictions: Contradiction[];
  abstain: boolean;
  rag_mode_used: string;
  llm_provider: string;
  llm_model: string;
  is_mock_llm: boolean;
  graph_context: string[];
  processing_time_ms: number;
  llm_used: boolean;
}

export interface AskRequestOptions {
  collectionId?: string;
  documentIds?: string[];
  language?: 'en' | 'ta';
  ragMode?: 'hybrid' | 'graph_rag' | 'crag' | 'agentic';
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  overrideLlmProvider?: string;
  overrideApiKey?: string;
  alpha?: number;
}

export interface SummarizeResponse {
  points: string[];
  document_title: string;
  coverage: number;
  word_count: number;
  llm_used: boolean;
}

export interface CompareResponse {
  similarity: number;
  document_a: string;
  document_b: string;
  shared: string[];
  unique_a: string[];
  unique_b: string[];
  key_points_a: string[];
  key_points_b: string[];
  contradictions?: Contradiction[];
  llm_used: boolean;
}

export interface VersionCompareResponse {
  document_id: string;
  title: string;
  version_a: number;
  version_b: number;
  similarity_score: number;
  added_clauses: string[];
  removed_clauses: string[];
  modified_clauses: Array<{ old: string; new: string }>;
  risk_delta: string;
}

export interface ApiKeyTestResult {
  valid: boolean;
  message: string;
  provider: string;
}

// ── API calls ─────────────────────────────────────────────────────────

/** Ask a question across documents using the backend Advanced RAG pipeline. */
export async function apiAsk(
  query: string,
  options: AskRequestOptions = {},
): Promise<AskResponse> {
  return apiClient.post<AskResponse>('/api/v1/rag/ask', {
    query,
    collection_id: options.collectionId,
    document_ids: options.documentIds || [],
    language: options.language || 'en',
    rag_mode: options.ragMode || 'hybrid',
    conversation_history: options.conversationHistory || [],
    override_llm_provider: options.overrideLlmProvider,
    override_api_key: options.overrideApiKey,
    alpha: options.alpha ?? 0.5,
  });
}

/** Summarize a single document using the backend. */
export async function apiSummarize(
  documentId: string,
  maxPoints = 6,
  language: 'en' | 'ta' = 'en',
): Promise<SummarizeResponse> {
  return apiClient.post<SummarizeResponse>('/api/v1/rag/summarize', {
    document_id: documentId,
    max_points: maxPoints,
    language,
  });
}

/** Compare two distinct documents using the backend. */
export async function apiCompare(
  documentIdA: string,
  documentIdB: string,
  language: 'en' | 'ta' = 'en',
): Promise<CompareResponse> {
  return apiClient.post<CompareResponse>('/api/v1/rag/compare', {
    document_id_a: documentIdA,
    document_id_b: documentIdB,
    language,
  });
}

/** Compare historical versions of a document. */
export async function apiCompareVersions(
  documentId: string,
  versionA: number,
  versionB: number,
): Promise<VersionCompareResponse> {
  return apiClient.post<VersionCompareResponse>('/api/v1/rag/compare-versions', {
    document_id: documentId,
    version_a: versionA,
    version_b: versionB,
  });
}

/** Verify an LLM API key against its upstream provider. */
export async function apiTestApiKey(
  provider: string,
  apiKey: string,
): Promise<ApiKeyTestResult> {
  return apiClient.post<ApiKeyTestResult>('/api/v1/users/test-api-key', {
    provider,
    api_key: apiKey,
  });
}
