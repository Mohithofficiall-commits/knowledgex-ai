import { supabase } from '@/lib/supabase';
import type { HistoryEntry, HistoryKind, HistoryResult } from '@/types/knowledge';

export interface NewHistoryEntry {
  kind: HistoryKind;
  query: string;
  language: 'en' | 'ta';
  document_ids: string[];
  result: HistoryResult;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from('search_history')
    .select('id, kind, query, language, document_ids, result, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  throwIfError(error);
  return (data ?? []) as HistoryEntry[];
}

export async function addHistoryEntry(entry: NewHistoryEntry): Promise<void> {
  const { error } = await supabase.from('search_history').insert(entry);
  throwIfError(error);
}

export async function deleteHistoryEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from('search_history').delete().eq('id', entryId);
  throwIfError(error);
}

export async function clearHistory(): Promise<void> {
  const { error } = await supabase.from('search_history').delete().not('id', 'is', null);
  throwIfError(error);
}
