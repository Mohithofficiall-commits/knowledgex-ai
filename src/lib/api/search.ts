/**
 * Full-text and Hybrid Search API service.
 */
import { apiClient } from './client';

export interface ApiSearchHit {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  page_hint?: number | null;
  content: string;
  score: number;
  highlight?: string | null;
}

export interface SearchQueryResponse {
  query: string;
  total_hits: number;
  hits: ApiSearchHit[];
}

export async function apiSearchQuery(
  query: string,
  options: {
    collection_id?: string;
    document_ids?: string[];
    top_k?: number;
  } = {},
): Promise<SearchQueryResponse> {
  return apiClient.post<SearchQueryResponse>('/api/v1/search/query', {
    query,
    collection_id: options.collection_id,
    document_ids: options.document_ids,
    top_k: options.top_k ?? 10,
  });
}
