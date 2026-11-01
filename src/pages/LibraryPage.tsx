import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileCode,
  FileText,
  Filter,
  Library,
  Plus,
  Search,
  Sparkles,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useLibrary, type UploadOutcome } from '@/contexts/LibraryContext';
import type { TranslationKey } from '@/i18n/translations';
import type { FileType, KnowledgeDocument } from '@/types/knowledge';
import { Badge, Button, EmptyState, Modal, Notice, Tabs } from '@/components/ui';
import { UploadDropzone } from '@/components/documents/UploadDropzone';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { DocumentDetailsModal } from '@/components/documents/DocumentDetailsModal';
import { LoadDemoButton } from '@/components/documents/LoadDemoButton';
import { cn } from '@/lib/cn';

const PROBLEM_KEYS: Record<'unsupported' | 'tooLarge' | 'noText' | 'failed' | 'duplicate', TranslationKey | string> = {
  unsupported: 'library.unsupported',
  tooLarge: 'library.tooLarge',
  noText: 'library.noText',
  failed: 'library.uploadFailed',
  duplicate: 'Duplicate content detected (SHA-256 hash matched existing document in library).',
};

type FilterType = 'all' | FileType | 'demo';

function UploadResults({ outcomes, onDismiss }: { outcomes: UploadOutcome[]; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {outcomes.map((outcome, index) => {
        const ok = outcome.result.ok;
        const prob = !ok && 'problem' in outcome.result ? outcome.result.problem : undefined;
        const msg = ok
          ? t('library.uploaded')
          : prob === 'duplicate'
          ? String(PROBLEM_KEYS.duplicate)
          : prob && prob in PROBLEM_KEYS
          ? t(PROBLEM_KEYS[prob] as TranslationKey)
          : t('library.uploadFailed');
        return (
          <Notice
            key={`${outcome.fileName}-${index}`}
            tone={ok ? 'success' : prob === 'duplicate' ? 'warning' : 'error'}
            icon={ok ? <CheckCircle2 className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
            title={outcome.fileName}
          >
            {msg}
          </Notice>
        );
      })}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

export function LibraryPage() {
  const { t } = useTranslation();
  const { documents, status, isUploading, reload, uploadFiles, removeDocument } = useLibrary();
  const [outcomes, setOutcomes] = useState<UploadOutcome[] | null>(null);
  const [previewing, setPreviewing] = useState<KnowledgeDocument | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showUpload, setShowUpload] = useState(true);

  const handleFiles = async (files: File[]) => {
    setOutcomes(null);
    setOutcomes(await uploadFiles(files));
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      await removeDocument(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        !searchQuery.trim() ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'all') return true;
      if (activeFilter === 'demo') return doc.is_demo;
      return doc.file_type === activeFilter;
    });
  }, [documents, searchQuery, activeFilter]);

  const pdfCount = documents.filter((d) => d.file_type === 'pdf').length;
  const docxCount = documents.filter((d) => d.file_type === 'docx').length;
  const txtCount = documents.filter((d) => d.file_type === 'txt').length;
  const htmlCount = documents.filter((d) => d.file_type === 'html').length;

  return (
    <div className="space-y-10">
      {/* ── Page Header ── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Library className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary-700">
              Personal Knowledge Store
            </span>
          </div>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900">{t('library.title')}</h2>
          <p className="max-w-2xl text-sm text-ink-500">{t('library.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <LoadDemoButton />
          <Button
            variant={showUpload ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setShowUpload(!showUpload)}
          >
            <Upload className="h-4 w-4" />
            {showUpload ? 'Hide Uploader' : 'Upload Files'}
          </Button>
        </div>
      </div>

      {/* ── Dropzone Section (collapsible) ── */}
      {showUpload && (
        <div className="animate-fade-in space-y-4">
          <UploadDropzone onFiles={handleFiles} uploading={isUploading} />
          {outcomes && <UploadResults outcomes={outcomes} onDismiss={() => setOutcomes(null)} />}
        </div>
      )}

      {/* ── Error Banner ── */}
      {status === 'error' && (
        <Notice
          tone="error"
          icon={<TriangleAlert className="h-5 w-5" />}
          action={
            <Button size="sm" variant="secondary" onClick={() => void reload()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('common.connectionError')}
        </Notice>
      )}

      {/* ── Search & Filter Controls ── */}
      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by name..."
              className="h-11 w-full rounded-2xl border border-ink-200 bg-white pl-10 pr-4 text-xs sm:text-sm text-ink-900 placeholder:text-ink-400 outline-none transition focus:border-secondary-500 focus:ring-4 focus:ring-secondary-100 shadow-xs"
            />
          </div>

          {/* Type Filter Pills */}
          <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-ink-100 p-1 ring-1 ring-ink-200">
            {[
              { id: 'all', label: 'All', badge: documents.length },
              { id: 'pdf', label: 'PDF', badge: pdfCount },
              { id: 'docx', label: 'DOCX', badge: docxCount },
              { id: 'txt', label: 'TXT', badge: txtCount },
              { id: 'html', label: 'HTML', badge: htmlCount },
              { id: 'demo', label: 'Demo' },
            ].map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id as FilterType)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition',
                    active
                      ? 'bg-white text-ink-900 shadow-soft'
                      : 'text-ink-600 hover:text-ink-900 hover:bg-white/50',
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={cn('rounded-full px-1.5 py-0.2 text-[10px]', active ? 'bg-ink-100 font-bold' : 'text-ink-400')}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Document Grid ── */}
        {status === 'loading' && <p className="text-sm text-ink-500">{t('common.loading')}</p>}

        {status === 'ready' && documents.length === 0 && (
          <EmptyState
            icon={<Library className="h-6 w-6" />}
            title={t('library.emptyTitle')}
            description={t('library.emptyDesc')}
            action={<LoadDemoButton variant="primary" />}
          />
        )}

        {documents.length > 0 && filteredDocuments.length === 0 && (
          <p className="rounded-3xl border border-dashed border-ink-300 bg-white/60 p-12 text-center text-xs text-ink-500">
            No documents match your current filter. Try resetting search or type filter.
          </p>
        )}

        {filteredDocuments.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onPreview={() => setPreviewing(doc)}
                onDelete={() => {
                  setDeleteError(false);
                  setPendingDelete(doc);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Document Details & Ingestion Inspection Modal ── */}
      {previewing && (
        <DocumentDetailsModal
          document={previewing}
          onClose={() => setPreviewing(null)}
          onDocumentUpdated={reload}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {pendingDelete && (
        <Modal
          title={t('common.delete')}
          onClose={() => !deleting && setPendingDelete(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={deleting}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={confirmDelete} loading={deleting}>
                {t('common.delete')}
              </Button>
            </>
          }
        >
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <FileText className="h-5 w-5" />
            </span>
            <div className="space-y-2">
              <p className="font-bold text-ink-900 text-base">{pendingDelete.title}</p>
              <p className="text-sm leading-relaxed text-ink-600">{t('library.confirmDelete')}</p>
              {deleteError && (
                <Notice tone="error" icon={<TriangleAlert className="h-5 w-5" />}>
                  {t('common.connectionError')}
                </Notice>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
