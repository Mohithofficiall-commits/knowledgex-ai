import { cn } from '@/lib/cn';
import type { KnowledgeDocument } from '@/types/knowledge';

interface DocumentSelectProps {
  id: string;
  label: string;
  value: string;
  documents: KnowledgeDocument[];
  onChange: (documentId: string) => void;
  disabledId?: string;
}

export function DocumentSelect({ id, label, value, documents, onChange, disabledId }: DocumentSelectProps) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm font-semibold text-ink-700">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-xl border border-ink-200 bg-white bg-[length:16px] bg-[right_1rem_center] bg-no-repeat px-4 text-sm font-medium text-ink-900 shadow-soft outline-none transition focus:border-secondary-500 focus:ring-4 focus:ring-secondary-100"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%2364748b' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="" disabled>
          —
        </option>
        {documents.map((doc) => (
          <option key={doc.id} value={doc.id} disabled={doc.id === disabledId}>
            {doc.title}
          </option>
        ))}
      </select>
    </label>
  );
}

interface DocumentScopePickerProps {
  documents: KnowledgeDocument[];
  selectedIds: string[];
  onToggle: (documentId: string) => void;
}

export function DocumentScopePicker({ documents, selectedIds, onToggle }: DocumentScopePickerProps) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {documents.map((doc) => {
        const checked = selectedIds.includes(doc.id);
        return (
          <li key={doc.id}>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition',
                checked
                  ? 'border-primary-300 bg-primary-50 text-primary-900'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(doc.id)}
                className="h-4 w-4 rounded border-ink-300 text-primary-700 focus:ring-primary-500"
              />
              <span className="truncate font-medium">{doc.title}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
