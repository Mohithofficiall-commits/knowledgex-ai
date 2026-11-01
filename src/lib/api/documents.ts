/**
 * Document API service – talks to the FastAPI backend.
 * Full document ingestion pipeline: upload, status tracking, reprocessing, extracted text, and chunks.
 */
import { apiClient } from './client';
import type { FileType, ProcessingStatus, ProcessingLogEntry } from '@/types/knowledge';

export interface ApiDocument {
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

export interface ApiChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  page_hint: number | null;
  section_heading?: string | null;
  content: string;
  token_count: number;
  embedding_model?: string | null;
  is_mock_embedding?: boolean;
}

export interface DocumentListResponse {
  documents: ApiDocument[];
  total: number;
}

export interface UploadResponse {
  ok: boolean;
  document?: ApiDocument;
  is_duplicate?: boolean;
  duplicate_of_id?: string | null;
  problem?: 'unsupported' | 'tooLarge' | 'noText' | 'failed' | 'duplicate';
  error_message?: string | null;
}

export interface DocumentStatusResponse {
  document_id: string;
  title: string;
  processing_status: ProcessingStatus;
  processing_progress: number;
  processing_error?: string | null;
  processing_logs: ProcessingLogEntry[];
  chunk_count: number;
}

export interface ExtractedSectionItem {
  chunk_index: number;
  page: number | null;
  section_heading: string | null;
  content: string;
  tokens: number;
  embedding_model: string | null;
  is_mock_embedding: boolean;
}

export interface ExtractedTextResponse {
  document_id: string;
  title: string;
  total_chunks: number;
  total_pages: number;
  metadata: Record<string, any>;
  sections: ExtractedSectionItem[];
}

/** List all documents from the FastAPI backend. */
export async function apiListDocuments(
  skip = 0,
  limit = 50,
): Promise<DocumentListResponse> {
  return apiClient.get<DocumentListResponse>('/api/v1/documents', { skip, limit });
}

/** Upload a file to the FastAPI backend with configurable chunking parameters. */
export async function apiUploadDocument(
  file: File,
  options: {
    title?: string;
    collectionId?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    allowDuplicates?: boolean;
  } = {},
): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  if (options.title) form.append('title', options.title);
  if (options.collectionId) form.append('collection_id', options.collectionId);
  if (options.chunkSize) form.append('chunk_size', String(options.chunkSize));
  if (options.chunkOverlap) form.append('chunk_overlap', String(options.chunkOverlap));
  if (options.allowDuplicates) form.append('allow_duplicates', 'true');

  return apiClient.upload<UploadResponse>('/api/v1/documents/upload', form);
}

/** Fetch a single document by ID. */
export async function apiGetDocument(documentId: string): Promise<ApiDocument> {
  return apiClient.get<ApiDocument>(`/api/v1/documents/${documentId}`);
}

/** Fetch ingestion processing status, progress percentage, and logs. */
export async function apiGetDocumentStatus(documentId: string): Promise<DocumentStatusResponse> {
  return apiClient.get<DocumentStatusResponse>(`/api/v1/documents/${documentId}/status`);
}

/** Reprocess an existing document with new chunking parameters. */
export async function apiReprocessDocument(
  documentId: string,
  chunkSize: number = 500,
  chunkOverlap: number = 100,
): Promise<UploadResponse> {
  return apiClient.post<UploadResponse>(`/api/v1/documents/${documentId}/reprocess`, {
    chunk_size: chunkSize,
    chunk_overlap: chunkOverlap,
  });
}

/** Fetch the full reconstructed extracted text grouped by pages and headings. */
export async function apiGetExtractedText(documentId: string): Promise<ExtractedTextResponse> {
  return apiClient.get<ExtractedTextResponse>(`/api/v1/documents/${documentId}/extracted-text`);
}

/** Delete a document by ID. */
export async function apiDeleteDocument(documentId: string): Promise<void> {
  return apiClient.delete(`/api/v1/documents/${documentId}`);
}

/** Fetch preview chunks for a document. */
export async function apiGetChunks(
  documentId: string,
  skip = 0,
  limit = 50,
): Promise<ApiChunk[]> {
  return apiClient.get<ApiChunk[]>(`/api/v1/documents/${documentId}/chunks`, { skip, limit });
}
