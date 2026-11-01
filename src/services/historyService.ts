import { supabase } from '@/lib/supabase';
import type { HistoryEntry, HistoryKind, HistoryResult } from '@/types/knowledge';

export interface NewHistoryEntry {
  kind: HistoryKind;
  query: string;
  language: 'en' | 'ta';
  document_ids: string[];
  result: HistoryResult;
}

const LOCAL_HISTORY_KEY = 'knowledgex_search_history';

function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return Boolean(url && !url.includes('not-configured'));
}

function getLocalHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(entries.slice(0, 200)));
  } catch {}
}

export async function listHistory(): Promise<HistoryEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('id, kind, query, language, document_ids, result, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!error && data) return data as HistoryEntry[];
    } catch (e) {
      console.warn('Supabase search history fetch fell back to local cache:', e);
    }
  }

  return getLocalHistory();
}

export async function addHistoryEntry(entry: NewHistoryEntry): Promise<void> {
  const newEntry: HistoryEntry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    kind: entry.kind,
    query: entry.query,
    language: entry.language,
    document_ids: entry.document_ids,
    result: entry.result,
    created_at: new Date().toISOString(),
  };

  const list = [newEntry, ...getLocalHistory()];
  saveLocalHistory(list);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('search_history').insert(entry);
    } catch {}
  }
}

export async function deleteHistoryEntry(entryId: string): Promise<void> {
  const list = getLocalHistory().filter((item) => item.id !== entryId);
  saveLocalHistory(list);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('search_history').delete().eq('id', entryId);
    } catch {}
  }
}

export async function clearHistory(): Promise<void> {
  saveLocalHistory([]);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('search_history').delete().not('id', 'is', null);
    } catch {}
  }
}
