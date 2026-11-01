import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/i18n/LanguageContext';

export type ButtonVariant = 'primary' | 'warm' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'cyan' | 'purple' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white shadow-soft hover:bg-primary-700 hover:shadow-glow-green focus-visible:ring-primary-300',
  warm: 'bg-warm-600 text-white shadow-soft hover:bg-warm-700 focus-visible:ring-warm-200',
  secondary: 'bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-100 hover:ring-ink-300 shadow-soft',
  cyan: 'bg-secondary-500 text-ink-950 shadow-soft hover:bg-secondary-600 hover:text-white hover:shadow-glow focus-visible:ring-secondary-300',
  purple: 'bg-accent-600 text-white shadow-soft hover:bg-accent-700 hover:shadow-glow-purple focus-visible:ring-accent-300',
  outline: 'bg-transparent border border-ink-300 text-ink-700 hover:bg-ink-100 hover:text-ink-900',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50',
  destructive: 'bg-red-700 text-white shadow-soft hover:bg-red-800 focus-visible:ring-red-200',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-xs font-semibold gap-1.5',
  md: 'h-11 px-5 text-sm font-semibold gap-2',
  lg: 'h-13 px-7 text-base font-bold gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.98] focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 select-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export interface CardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function Card({ children, className, hoverEffect = false }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-200/90 bg-white p-6 shadow-soft sm:p-7 backdrop-blur-sm',
        hoverEffect && 'transition-all duration-300 hover:-translate-y-1 hover:border-ink-300 hover:shadow-lift',
        className,
      )}
    >
      {children}
    </div>
  );
}

export type BadgeTone = 'green' | 'cyan' | 'purple' | 'orange' | 'lavender' | 'neutral';

const BADGE_TONES: Record<BadgeTone, string> = {
  green: 'bg-primary-50 text-primary-800 ring-primary-300/80',
  cyan: 'bg-secondary-50 text-secondary-800 ring-secondary-300/80',
  purple: 'bg-accent-50 text-accent-800 ring-accent-300/80',
  orange: 'bg-warm-50 text-warm-800 ring-warm-300/80',
  lavender: 'bg-lavender-100 text-lavender-900 ring-lavender-300/80',
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset select-none',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface NoticeProps {
  tone: 'error' | 'info' | 'success' | 'warning';
  icon: ReactNode;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

const NOTICE_TONES: Record<NoticeProps['tone'], string> = {
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-secondary-200 bg-secondary-50 text-secondary-900',
  success: 'border-primary-200 bg-primary-50 text-primary-900',
  warning: 'border-warm-200 bg-warm-50 text-warm-900',
};

export function Notice({ tone, icon, title, children, action, className }: NoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-2xl border p-4.5 text-sm animate-scale-in shadow-soft', NOTICE_TONES[tone], className)}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-bold">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3.5 rounded-2xl border border-dashed border-ink-300 bg-white/70 px-6 py-14 text-center backdrop-blur-sm', className)}>
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-lavender-100 to-secondary-100 text-secondary-700 shadow-soft">
        {icon}
      </span>
      <h3 className="text-lg font-bold text-ink-900">{title}</h3>
      <p className="max-w-md text-sm text-ink-500 leading-relaxed">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export function Modal({ title, onClose, children, footer, maxWidth = '2xl' }: ModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const maxWMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-lift animate-scale-in sm:rounded-3xl border border-ink-200/80',
          maxWMap[maxWidth],
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-ink-200 px-6 py-4.5">
          <h2 className="text-lg font-bold text-ink-900 tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-ink-200 px-6 py-4.5 bg-ink-50/50 rounded-b-3xl">{footer}</div>}
      </div>
    </div>
  );
}

export interface TabsProps<T extends string> {
  tabs: { id: T; label: string; icon?: ReactNode; badge?: string | number }[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ tabs, activeTab, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-2xl bg-ink-100 p-1.5 ring-1 ring-ink-200/80', className)}>
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200',
              active
                ? 'bg-white text-ink-900 shadow-soft ring-1 ring-ink-200/60'
                : 'text-ink-600 hover:text-ink-900 hover:bg-white/60',
            )}
          >
            {tab.icon && <span className="h-4 w-4 shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  active ? 'bg-ink-100 text-ink-700' : 'bg-ink-200 text-ink-600',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
