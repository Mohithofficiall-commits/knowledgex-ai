import { supabase } from '@/lib/supabase';
import { chunkSections } from '@/lib/text/chunking';
import { detectFileType, extractSections, MAX_UPLOAD_BYTES, type UploadProblem } from '@/lib/documents/extractText';
import { DEMO_DOCUMENTS } from '@/data/demoDocuments';
import type { ChunkWithDocument, DocumentChunk, FileType, KnowledgeDocument } from '@/types/knowledge';
import { apiListDocuments, apiUploadDocument, apiDeleteDocument, type ApiDocument } from '@/lib/api/documents';
import { checkBackendHealth } from '@/lib/api/client';

const CHUNK_INSERT_BATCH = 200;
const CHUNK_PAGE_SIZE = 1000;

export type AddDocumentResult =
  | { ok: true; document: KnowledgeDocument }
  | { ok: false; problem: UploadProblem };

interface NewDocument {
  title: string;
  file_name: string;
  file_type: FileType;
  byte_size: number;
  is_demo: boolean;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function mapApiDocument(doc: ApiDocument): KnowledgeDocument {
  return {
    id: doc.id,
    title: doc.title,
    file_name: doc.file_name,
    file_type: doc.file_type,
    byte_size: doc.byte_size,
    chunk_count: doc.chunk_count,
    is_demo: doc.is_demo,
    content_hash: doc.content_hash,
    processing_status: doc.processing_status,
    processing_progress: doc.processing_progress,
    processing_error: doc.processing_error,
    processing_logs: doc.processing_logs,
    chunk_size: doc.chunk_size,
    chunk_overlap: doc.chunk_overlap,
    metadata_json: doc.metadata_json,
    current_version: doc.current_version,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

async function insertDocumentWithChunks(document: NewDocument, texts: { content: string; page: number | null }[]) {
  const { data, error } = await supabase
    .from('documents')
    .insert({ ...document, chunk_count: texts.length })
    .select()
    .single();
  throwIfError(error);
  const created = data as KnowledgeDocument;

  for (let start = 0; start < texts.length; start += CHUNK_INSERT_BATCH) {
    const batch = texts.slice(start, start + CHUNK_INSERT_BATCH).map((chunk, offset) => ({
      document_id: created.id,
      chunk_index: start + offset,
      page_hint: chunk.page,
      content: chunk.content,
    }));
    const { error: chunkError } = await supabase.from('document_chunks').insert(batch);
    if (chunkError) {
      await supabase.from('documents').delete().eq('id', created.id);
      throw new Error(chunkError.message);
    }
  }

  return created;
}

export async function addDocumentFromFile(file: File): Promise<AddDocumentResult> {
  const fileType = detectFileType(file);
  if (!fileType) return { ok: false, problem: 'unsupported' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, problem: 'tooLarge' };

  // Try FastAPI backend first
  try {
    const health = await checkBackendHealth();
    if (health.reachable) {
      const resp = await apiUploadDocument(file);
      if (resp.ok && resp.document) {
        return { ok: true, document: mapApiDocument(resp.document) };
      }
      if (resp.problem) {
        return { ok: false, problem: resp.problem };
      }
    }
  } catch (err) {
    console.warn('Backend upload fell back to Supabase client:', err);
  }

  // Graceful fallback to client-side chunking and Supabase storage
  let chunks;
  try {
    chunks = chunkSections(await extractSections(file, fileType));
  } catch {
    return { ok: false, problem: 'failed' };
  }
  if (chunks.length === 0) return { ok: false, problem: 'noText' };

  const title = file.name.replace(/\.[^.]+$/, '');
  const document = await insertDocumentWithChunks(
    { title, file_name: file.name, file_type: fileType, byte_size: file.size, is_demo: false },
    chunks,
  );
  return { ok: true, document };
}

export async function listDocuments(): Promise<KnowledgeDocument[]> {
  // Try FastAPI backend first
  try {
    const health = await checkBackendHealth();
    if (health.reachable) {
      const resp = await apiListDocuments(0, 100);
      if (resp.documents && resp.documents.length > 0) {
        return resp.documents.map(mapApiDocument);
      }
    }
  } catch (err) {
    console.warn('Backend document list fell back to Supabase client:', err);
  }

  // Fallback to Supabase
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      return data as KnowledgeDocument[];
    }
  } catch {}

  return [];
}

export async function deleteDocument(documentId: string): Promise<void> {
  try {
    const health = await checkBackendHealth();
    if (health.reachable) {
      await apiDeleteDocument(documentId);
    }
  } catch (err) {
    console.warn('Backend delete fell back to Supabase client:', err);
  }

  try {
    const { error } = await supabase.from('documents').delete().eq('id', documentId);
    if (error) console.warn('Supabase delete notice:', error.message);
  } catch {}
}

export async function seedDemoDocuments(): Promise<'added' | 'exists'> {
  const currentDocs = await listDocuments();
  if (currentDocs.some((d) => d.is_demo)) return 'exists';

  for (const demo of DEMO_DOCUMENTS) {
    const chunks = chunkSections([{ text: demo.text, page: null }]);
    try {
      await insertDocumentWithChunks(
        {
          title: demo.title,
          file_name: demo.fileName,
          file_type: 'txt',
          byte_size: new Blob([demo.text]).size,
          is_demo: true,
        },
        chunks,
      );
    } catch {}
  }
  return 'added';
}

export async function fetchChunks(documents: KnowledgeDocument[]): Promise<ChunkWithDocument[]> {
  if (documents.length === 0) return [];
  const titles = new Map(documents.map((doc) => [doc.id, doc.title]));
  const ids = [...titles.keys()];
  const results: ChunkWithDocument[] = [];

  for (let from = 0; ; from += CHUNK_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, document_id, chunk_index, page_hint, content')
      .in('document_id', ids)
      .order('document_id', { ascending: true })
      .order('chunk_index', { ascending: true })
      .range(from, from + CHUNK_PAGE_SIZE - 1);
    throwIfError(error);
    const rows = (data ?? []) as DocumentChunk[];
    for (const row of rows) {
      results.push({ ...row, documentTitle: titles.get(row.document_id) ?? '' });
    }
    if (rows.length < CHUNK_PAGE_SIZE) break;
  }

  return results;
}
