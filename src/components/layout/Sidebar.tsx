import { useEffect } from 'react';
import {
  BookOpen,
  FlaskConical,
  GitCompare,
  History,
  LayoutDashboard,
  MessageSquareText,
  Network,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import type { TranslationKey } from '@/i18n/translations';
import { useTranslation } from '@/i18n/LanguageContext';
import { routeHref, type AppRoute } from '@/lib/router';
import { Logo } from '@/components/brand/Logo';
import { LanguageToggle } from '@/components/language/LanguageToggle';
import { cn } from '@/lib/cn';

type NavRoute = Exclude<AppRoute, '/'>;

type NavGroup = {
  label: string;
  items: { route: NavRoute; labelKey: TranslationKey; icon: typeof LayoutDashboard }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { route: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { route: '/library', labelKey: 'nav.library', icon: BookOpen },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { route: '/assistant', labelKey: 'nav.assistant', icon: MessageSquareText },
      { route: '/research', labelKey: 'nav.research', icon: FlaskConical },
      { route: '/summarize', labelKey: 'nav.summarize', icon: Sparkles },
      { route: '/compare', labelKey: 'nav.compare', icon: GitCompare },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { route: '/knowledge-graph', labelKey: 'nav.knowledgeGraph', icon: Network },
      { route: '/history', labelKey: 'nav.history', icon: History },
    ],
  },
  {
    label: 'System',
    items: [{ route: '/settings', labelKey: 'nav.settings', icon: Settings }],
  },
];

// Accent colour per group for the active icon bg
const GROUP_ACCENT: Record<string, string> = {
  Core: 'bg-primary-600',
  Intelligence: 'bg-secondary-600',
  Knowledge: 'bg-accent-600',
  System: 'bg-ink-600',
};

const GROUP_ACTIVE: Record<string, string> = {
  Core: 'bg-primary-50 text-primary-800 shadow-soft ring-1 ring-primary-200',
  Intelligence: 'bg-secondary-50 text-secondary-800 shadow-soft ring-1 ring-secondary-200',
  Knowledge: 'bg-accent-50 text-accent-800 shadow-soft ring-1 ring-accent-200',
  System: 'bg-ink-100 text-ink-900 shadow-soft ring-1 ring-ink-200',
};

function findGroup(route: NavRoute): string {
  for (const g of NAV_GROUPS) {
    if (g.items.some((i) => i.route === route)) return g.label;
  }
  return 'Core';
}

interface SidebarProps {
  activeRoute: NavRoute;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ activeRoute, open, onClose }: SidebarProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const activeGroup = findGroup(activeRoute);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-ink-200 bg-white transition-transform duration-300 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-6">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.closeMenu')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-6 pb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
          {t('brand.tagline')}
        </p>

        {/* Navigation groups */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 scrollbar-thin">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ route, labelKey, icon: Icon }) => {
                  const active = route === activeRoute;
                  return (
                    <li key={route}>
                      <a
                        href={routeHref(route)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                          active
                            ? GROUP_ACTIVE[group.label]
                            : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                            active
                              ? `${GROUP_ACCENT[group.label]} text-white`
                              : 'bg-ink-100 text-ink-500 group-hover:bg-white',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {t(labelKey)}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="space-y-4 border-t border-ink-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t('common.language')}
            </span>
            <LanguageToggle />
          </div>
          <a
            href={routeHref('/')}
            className="block text-sm font-semibold text-secondary-700 transition hover:text-secondary-900"
          >
            {t('nav.home')}
          </a>
        </div>
      </aside>
    </>
  );
}
