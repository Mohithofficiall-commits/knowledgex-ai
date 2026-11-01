import { useRef, useState, type DragEvent } from 'react';
import { CloudUpload, FileCode, FileText, Loader2, Sparkles, Upload } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';

export const ACCEPTED_TYPES =
  '.pdf,.docx,.doc,.txt,.md,.markdown,.csv,.json,.html,.htm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/html,text/markdown';

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  uploading: boolean;
}

export function UploadDropzone({ onFiles, uploading }: UploadDropzoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  const handleSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFiles(Array.from(files));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!uploading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'group relative flex flex-col items-center justify-center gap-4.5 rounded-3xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-300 backdrop-blur-sm',
        dragging
          ? 'scale-[1.01] border-brand-cyan bg-secondary-50/70 shadow-glow'
          : 'border-brand-green/40 bg-white/90 hover:border-brand-green hover:bg-primary-50/30 shadow-soft hover:shadow-lift',
        uploading && 'pointer-events-none opacity-85',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="sr-only"
        id="document-upload-input"
        onChange={(event) => handleSelect(event.target.files)}
      />

      {/* Upload Icon with animated glow */}
      <span
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-green via-brand-cyan to-brand-purple text-white shadow-soft transition-all duration-300',
          !uploading && 'group-hover:scale-105 group-hover:shadow-glow',
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : (
          <CloudUpload className="h-8 w-8 transition duration-300 group-hover:-translate-y-0.5" />
        )}
      </span>

      <div className="space-y-1.5 max-w-md">
        <p className="text-lg font-bold text-ink-900 tracking-tight">
          {uploading ? t('library.uploading') : t('library.dropTitle')}
        </p>
        <p className="text-xs sm:text-sm text-ink-500">{t('library.dropHint')}</p>
      </div>

      {/* Format pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Badge tone="cyan">.PDF</Badge>
        <Badge tone="green">.DOCX</Badge>
        <Badge tone="purple">.TXT</Badge>
        <Badge tone="orange">.HTML</Badge>
        <span className="text-[11px] text-ink-400 font-medium">Max 25 MB/file</span>
      </div>

      <label
        htmlFor="document-upload-input"
        className={cn(
          'mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-soft transition-all duration-200 hover:bg-primary-700 hover:shadow-glow-green focus-within:ring-4 focus-within:ring-primary-200 select-none',
        )}
      >
        <Upload className="h-4 w-4" />
        {t('common.upload')}
      </label>
    </div>
  );
}
