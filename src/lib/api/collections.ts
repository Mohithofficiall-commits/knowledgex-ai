/**
 * Knowledge Collections API service.
 */
import { apiClient } from './client';

export interface ApiCollection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  is_private: boolean;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionListResponse {
  collections: ApiCollection[];
  total: number;
}

export async function apiListCollections(): Promise<CollectionListResponse> {
  return apiClient.get<CollectionListResponse>('/api/v1/collections');
}

export async function apiCreateCollection(payload: {
  name: string;
  description?: string;
  color?: string;
  is_private?: boolean;
}): Promise<ApiCollection> {
  return apiClient.post<ApiCollection>('/api/v1/collections', payload);
}

export async function apiUpdateCollection(
  id: string,
  payload: {
    name?: string;
    description?: string;
    color?: string;
    is_private?: boolean;
  },
): Promise<ApiCollection> {
  return apiClient.put<ApiCollection>(`/api/v1/collections/${id}`, payload);
}

export async function apiDeleteCollection(id: string): Promise<void> {
  return apiClient.delete(`/api/v1/collections/${id}`);
}

export async function apiAssignDocumentToCollection(
  collectionId: string,
  documentId: string,
): Promise<{ ok: boolean }> {
  return apiClient.post<{ ok: boolean }>(
    `/api/v1/collections/${collectionId}/documents/${documentId}`,
  );
}
