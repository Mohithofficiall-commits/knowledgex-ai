import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  addDocumentFromFile,
  deleteDocument,
  listDocuments,
  seedDemoDocuments,
  type AddDocumentResult,
} from '@/services/documentService';
import type { KnowledgeDocument } from '@/types/knowledge';

export type LibraryStatus = 'loading' | 'ready' | 'error';

export interface UploadOutcome {
  fileName: string;
  result: AddDocumentResult | { ok: false; problem: 'failed' };
}

interface LibraryContextValue {
  documents: KnowledgeDocument[];
  status: LibraryStatus;
  isUploading: boolean;
  reload: () => Promise<void>;
  uploadFiles: (files: File[]) => Promise<UploadOutcome[]>;
  removeDocument: (documentId: string) => Promise<void>;
  loadDemoDocuments: () => Promise<'added' | 'exists'>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [isUploading, setIsUploading] = useState(false);

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setDocuments(await listDocuments());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      setIsUploading(true);
      const outcomes: UploadOutcome[] = [];
      try {
        for (const file of files) {
          try {
            const result = await addDocumentFromFile(file);
            outcomes.push({ fileName: file.name, result });
          } catch {
            outcomes.push({ fileName: file.name, result: { ok: false, problem: 'failed' } });
          }
        }
        await reload();
      } finally {
        setIsUploading(false);
      }
      return outcomes;
    },
    [reload],
  );

  const removeDocument = useCallback(async (documentId: string) => {
    await deleteDocument(documentId);
    setDocuments((current) => current.filter((doc) => doc.id !== documentId));
  }, []);

  const loadDemoDocuments = useCallback(async () => {
    const result = await seedDemoDocuments();
    await reload();
    return result;
  }, [reload]);

  const value = useMemo<LibraryContextValue>(
    () => ({ documents, status, isUploading, reload, uploadFiles, removeDocument, loadDemoDocuments }),
    [documents, status, isUploading, reload, uploadFiles, removeDocument, loadDemoDocuments],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used inside LibraryProvider');
  }
  return context;
}
