import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Eye, FileCode, FileSpreadsheet, FileText, Search, Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { fetchChunks } from '@/services/documentService';
import { Badge, Button, Modal, Notice } from '@/components/ui';
import { FILE_TYPE_LABEL, formatBytes, formatDate } from '@/lib/format';
import type { ChunkWithDocument, KnowledgeDocument } from '@/types/knowledge';

interface DocumentCardProps {
  document: KnowledgeDocument;
  onPreview: () => void;
  onDelete: () => void;
}

export function DocumentCard({ document, onPreview, onDelete }: DocumentCardProps) {
  const { t, language } = useTranslation();

  const typeStyles = {
    pdf: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      badge: 'cyan' as const,
    },
    docx: {
      bg: 'bg-secondary-50',
      text: 'text-secondary-700',
      badge: 'green' as const,
    },
    txt: {
      bg: 'bg-primary-50',
      text: 'text-primary-700',
      badge: 'purple' as const,
    },
    html: {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      badge: 'orange' as const,
    },
  }[document.file_type] || {
    bg: 'bg-ink-100',
    text: 'text-ink-700',
    badge: 'neutral' as const,
  };

  return (
    <article className="group flex flex-col justify-between rounded-3xl border border-ink-200/90 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-ink-300 hover:shadow-lift">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${typeStyles.bg} ${typeStyles.text} transition duration-300 group-hover:scale-105 shadow-xs`}>
            <FileText className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="truncate text-base font-bold text-ink-900 group-hover:text-primary-700 transition" title={document.title}>
              {document.title}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={typeStyles.badge}>{FILE_TYPE_LABEL[document.file_type] || document.file_type.toUpperCase()}</Badge>
              {document.is_demo && <Badge tone="orange">{t('common.demo')}</Badge>}
              {document.processing_status && document.processing_status !== 'completed' && (
                <Badge tone={document.processing_status === 'failed' ? 'orange' : 'cyan'}>
                  {document.processing_status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-ink-50/80 p-3.5 text-xs border border-ink-100">
          <div>
            <dt className="text-[10px] uppercase font-bold text-ink-400">{t('library.size')}</dt>
            <dd className="font-bold text-ink-800 mt-0.5">{formatBytes(document.byte_size)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase font-bold text-ink-400">{t('library.passages')}</dt>
            <dd className="font-bold text-ink-800 mt-0.5">{document.chunk_count}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase font-bold text-ink-400">{t('library.added')}</dt>
            <dd className="font-bold text-ink-800 mt-0.5">{formatDate(document.created_at, language)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-ink-100 pt-4">
        <Button variant="secondary" size="sm" onClick={onPreview} className="flex-1">
          <Eye className="h-3.5 w-3.5 text-secondary-600" />
          {t('library.view')}
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete} aria-label={t('common.delete')}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
}

interface DocumentPreviewProps {
  document: KnowledgeDocument;
  onClose: () => void;
}

const PREVIEW_PASSAGES = 8;

export function DocumentPreviewModal({ document, onClose }: DocumentPreviewProps) {
  const { t } = useTranslation();
  const [chunks, setChunks] = useState<ChunkWithDocument[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;
    fetchChunks([document])
      .then((rows) => {
        if (active) setChunks(rows.slice(0, PREVIEW_PASSAGES));
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [document]);

  const filteredChunks = (chunks ?? []).filter(
    (c) => !searchTerm.trim() || c.content.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Modal
      title={t('library.previewTitle')}
      onClose={onClose}
      maxWidth="3xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-extrabold text-ink-900 text-base">{document.title}</p>
              <p className="text-xs text-ink-500">{t('library.previewNote')} ({document.chunk_count} total chunks)</p>
            </div>
          </div>

          <div className="relative sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search passages..."
              className="h-9 w-full rounded-xl border border-ink-200 pl-8 pr-3 text-xs text-ink-900 placeholder:text-ink-400 outline-none focus:border-secondary-500 focus:ring-2 focus:ring-secondary-100"
            />
          </div>
        </div>

        {failed && (
          <Notice tone="error" icon={<AlertTriangle className="h-5 w-5" />}>
            {t('common.connectionError')}
          </Notice>
        )}

        {!failed && chunks === null && (
          <div className="py-12 text-center text-xs text-ink-500 font-medium">{t('common.loading')}</div>
        )}

        {chunks !== null && filteredChunks.length === 0 && (
          <p className="py-8 text-center text-xs text-ink-400">No passages match your search filter.</p>
        )}

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {filteredChunks.map((chunk) => (
            <div key={chunk.id} className="rounded-2xl border border-ink-200/90 bg-ink-50/70 p-4 transition hover:bg-white hover:shadow-soft">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-700 bg-secondary-100 px-2 py-0.5 rounded-md">
                  {chunk.page_hint ? `${t('assistant.page')} ${chunk.page_hint}` : `${t('library.passages')} ${chunk.chunk_index + 1}`}
                </span>
                <span className="text-[10px] text-ink-400">ID: {chunk.id.slice(0, 8)}</span>
              </div>
              <p className="text-xs leading-relaxed text-ink-700">{chunk.content}</p>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
