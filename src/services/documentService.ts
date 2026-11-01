import { supabase } from '@/lib/supabase';
import { chunkSections } from '@/lib/text/chunking';
import { detectFileType, extractSections, MAX_UPLOAD_BYTES, type UploadProblem } from '@/lib/documents/extractText';
import { DEMO_DOCUMENTS } from '@/data/demoDocuments';
import type { ChunkWithDocument, DocumentChunk, FileType, KnowledgeDocument } from '@/types/knowledge';
import { apiListDocuments, apiUploadDocument, apiDeleteDocument, type ApiDocument } from '@/lib/api/documents';
import { checkBackendHealth } from '@/lib/api/client';

const LOCAL_DOCS_KEY = 'knowledgex_local_documents';
const LOCAL_CHUNKS_KEY = 'knowledgex_local_chunks';

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

function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return Boolean(url && !url.includes('not-configured'));
}

function getStoredLocalDocs(): KnowledgeDocument[] {
  try {
    const raw = localStorage.getItem(LOCAL_DOCS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredLocalDocs(docs: KnowledgeDocument[]): void {
  try {
    localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs));
  } catch {}
}

function getStoredLocalChunks(): DocumentChunk[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHUNKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredLocalChunks(chunks: DocumentChunk[]): void {
  try {
    localStorage.setItem(LOCAL_CHUNKS_KEY, JSON.stringify(chunks));
  } catch {}
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
    processing_status: doc.processing_status || 'completed',
    processing_progress: doc.processing_progress ?? 100,
    processing_error: doc.processing_error,
    processing_logs: doc.processing_logs || [],
    chunk_size: doc.chunk_size || 500,
    chunk_overlap: doc.chunk_overlap || 100,
    metadata_json: doc.metadata_json || {},
    current_version: doc.current_version || 1,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

export async function listDocuments(): Promise<KnowledgeDocument[]> {
  // 1. Try FastAPI backend first
  try {
    const health = await checkBackendHealth();
    if (health.reachable) {
      const resp = await apiListDocuments(0, 100);
      if (resp.documents && resp.documents.length > 0) {
        return resp.documents.map(mapApiDocument);
      }
    }
  } catch (err) {
    console.warn('FastAPI backend not active, switching to local store:', err);
  }

  // 2. Try Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data as KnowledgeDocument[];
      }
    } catch {}
  }

  // 3. Fallback to Local Browser Storage Vault
  let localDocs = getStoredLocalDocs();
  if (localDocs.length === 0) {
    // Auto-seed demo documents into local storage so the user always has immediate access
    await seedDemoDocuments();
    localDocs = getStoredLocalDocs();
  }

  return localDocs;
}

export async function seedDemoDocuments(): Promise<'added' | 'exists'> {
  const localDocs = getStoredLocalDocs();
  if (localDocs.some((d) => d.is_demo)) return 'exists';

  const newDocs: KnowledgeDocument[] = [];
  const newChunks: DocumentChunk[] = getStoredLocalChunks();

  DEMO_DOCUMENTS.forEach((demo, idx) => {
    const docId = `demo_doc_${idx + 1}`;
    const rawChunks = chunkSections([{ text: demo.text, page: 1 }]);
    const doc: KnowledgeDocument = {
      id: docId,
      title: demo.title,
      file_name: demo.fileName,
      file_type: 'txt',
      byte_size: new Blob([demo.text]).size,
      chunk_count: rawChunks.length,
      is_demo: true,
      processing_status: 'completed',
      processing_progress: 100,
      chunk_size: 500,
      chunk_overlap: 100,
      current_version: 1,
      created_at: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
    };
    newDocs.push(doc);

    rawChunks.forEach((c, cIdx) => {
      newChunks.push({
        id: `chunk_${docId}_${cIdx}`,
        document_id: docId,
        chunk_index: cIdx,
        page_hint: 1,
        content: c.content,
        section_heading: demo.title,
      });
    });
  });

  saveStoredLocalDocs([...newDocs, ...localDocs]);
  saveStoredLocalChunks(newChunks);
  return 'added';
}

export async function addDocumentFromFile(file: File): Promise<AddDocumentResult> {
  const fileType = detectFileType(file);
  if (!fileType) return { ok: false, problem: 'unsupported' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, problem: 'tooLarge' };

  // 1. Try FastAPI backend upload
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
    console.warn('Backend upload not available, using client ingestion:', err);
  }

  // 2. Client-side structure-aware extraction
  let extracted;
  try {
    extracted = await extractSections(file, fileType);
  } catch {
    return { ok: false, problem: 'failed' };
  }

  const rawChunks = chunkSections(extracted);
  if (rawChunks.length === 0) return { ok: false, problem: 'noText' };

  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = file.name.replace(/\.[^.]+$/, '');

  const newDoc: KnowledgeDocument = {
    id: docId,
    title,
    file_name: file.name,
    file_type: fileType,
    byte_size: file.size,
    chunk_count: rawChunks.length,
    is_demo: false,
    processing_status: 'completed',
    processing_progress: 100,
    chunk_size: 500,
    chunk_overlap: 100,
    current_version: 1,
    created_at: new Date().toISOString(),
  };

  const localChunks = getStoredLocalChunks();
  rawChunks.forEach((c, idx) => {
    localChunks.push({
      id: `chunk_${docId}_${idx}`,
      document_id: docId,
      chunk_index: idx,
      page_hint: c.page,
      content: c.content,
      section_heading: title,
    });
  });

  saveStoredLocalDocs([newDoc, ...getStoredLocalDocs()]);
  saveStoredLocalChunks(localChunks);

  return { ok: true, document: newDoc };
}

export async function fetchChunks(documents: KnowledgeDocument[]): Promise<ChunkWithDocument[]> {
  if (documents.length === 0) return [];
  const titles = new Map(documents.map((doc) => [doc.id, doc.title]));
  const ids = new Set(titles.keys());

  // 1. Check local storage chunks first
  const localChunks = getStoredLocalChunks();
  const matched = localChunks.filter((c) => ids.has(c.document_id));

  if (matched.length > 0) {
    return matched.map((c) => ({
      ...c,
      documentTitle: titles.get(c.document_id) || '',
    }));
  }

  // 2. Check demo documents fallback if empty
  const results: ChunkWithDocument[] = [];
  for (const doc of documents) {
    const demo = DEMO_DOCUMENTS.find((d) => d.title === doc.title);
    if (demo) {
      const raw = chunkSections([{ text: demo.text, page: 1 }]);
      raw.forEach((r, idx) => {
        results.push({
          id: `chunk_${doc.id}_${idx}`,
          document_id: doc.id,
          chunk_index: idx,
          page_hint: 1,
          content: r.content,
          documentTitle: doc.title,
        });
      });
    }
  }

  return results;
}

export async function deleteDocument(documentId: string): Promise<void> {
  // Remove from backend if reachable
  try {
    const health = await checkBackendHealth();
    if (health.reachable) {
      await apiDeleteDocument(documentId);
    }
  } catch {}

  // Remove from local storage
  const remainingDocs = getStoredLocalDocs().filter((d) => d.id !== documentId);
  saveStoredLocalDocs(remainingDocs);

  const remainingChunks = getStoredLocalChunks().filter((c) => c.document_id !== documentId);
  saveStoredLocalChunks(remainingChunks);
}
