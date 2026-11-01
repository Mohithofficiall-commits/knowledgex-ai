/**
 * Knowledge Graph API service.
 */
import { apiClient } from './client';

export interface KnowledgeNode {
  id: string;
  label: string;
  node_type: string;
  document_id: string | null;
  metadata_: Record<string, unknown>;
  created_at: string;
}

export interface KnowledgeEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  weight: number;
}

export interface GraphResponse {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface GraphStats {
  document_count: number;
  node_count: number;
  edge_count: number;
  graph_ready: boolean;
}

/** Fetch the knowledge graph (optionally scoped to a document). */
export async function apiGetGraph(
  documentId?: string,
  limit = 100,
): Promise<GraphResponse> {
  return apiClient.get<GraphResponse>('/api/v1/knowledge/graph', {
    ...(documentId ? { document_id: documentId } : {}),
    limit,
  });
}

/** Fetch knowledge graph statistics. */
export async function apiGetGraphStats(): Promise<GraphStats> {
  return apiClient.get<GraphStats>('/api/v1/knowledge/stats');
}
