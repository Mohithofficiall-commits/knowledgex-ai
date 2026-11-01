import { useTranslation, type Language } from '@/i18n/LanguageContext';

const OPTIONS: { value: Language; label: string; native: string }[] = [
  { value: 'en', label: 'English', native: 'EN' },
  { value: 'ta', label: 'Tamil', native: 'த' },
];

interface LanguageToggleProps {
  variant?: 'light' | 'dark';
}

export function LanguageToggle({ variant = 'dark' }: LanguageToggleProps) {
  const { language, setLanguage, t } = useTranslation();
  const isLight = variant === 'light';

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={`inline-flex items-center rounded-full p-1 ${
        isLight ? 'bg-white/10 ring-1 ring-white/20' : 'bg-ink-100 ring-1 ring-ink-200'
      }`}
    >
      {OPTIONS.map((option) => {
        const active = option.value === language;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLanguage(option.value)}
            aria-pressed={active}
            title={option.label}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
              active
                ? 'bg-white text-ink-900 shadow-soft'
                : isLight
                  ? 'text-white/80 hover:text-white'
                  : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            {option.native}
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
