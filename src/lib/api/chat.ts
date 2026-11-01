/**
 * Chat and Assistant Sessions API service.
 */
import { apiClient } from './client';

export interface ChatCitation {
  marker: string;
  document_id: string;
  document_title: string;
  page?: number | null;
  chunk_index: number;
  excerpt: string;
  score?: number;
}

export interface ApiChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  confidence: 'high' | 'medium' | 'low';
  citations: ChatCitation[];
  created_at: string;
}

export interface ApiChatSession {
  id: string;
  user_id: string;
  collection_id?: string | null;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatTurnResponse {
  session_id: string;
  user_message: ApiChatMessage;
  assistant_message: ApiChatMessage;
}

export async function apiListChatSessions(): Promise<ApiChatSession[]> {
  return apiClient.get<ApiChatSession[]>('/api/v1/chat/sessions');
}

export async function apiCreateChatSession(payload: {
  title?: string;
  collection_id?: string;
}): Promise<ApiChatSession> {
  return apiClient.post<ApiChatSession>('/api/v1/chat/sessions', payload);
}

export async function apiGetChatSession(
  sessionId: string,
): Promise<{ session: ApiChatSession; messages: ApiChatMessage[] }> {
  return apiClient.get(`/api/v1/chat/sessions/${sessionId}`);
}

export async function apiDeleteChatSession(sessionId: string): Promise<void> {
  return apiClient.delete(`/api/v1/chat/sessions/${sessionId}`);
}

export async function apiSendMessage(
  sessionId: string,
  content: string,
  documentIds?: string[],
): Promise<ChatTurnResponse> {
  return apiClient.post<ChatTurnResponse>(`/api/v1/chat/sessions/${sessionId}/messages`, {
    content,
    document_ids: documentIds,
  });
}
