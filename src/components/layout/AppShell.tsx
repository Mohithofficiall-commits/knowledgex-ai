import { useEffect, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import type { TranslationKey } from '@/i18n/translations';
import { useTranslation } from '@/i18n/LanguageContext';
import type { AppRoute } from '@/lib/router';
import { LibraryProvider } from '@/contexts/LibraryContext';
import { Logo } from '@/components/brand/Logo';
import { Sidebar } from '@/components/layout/Sidebar';
import { LanguageToggle } from '@/components/language/LanguageToggle';
import { DashboardPage } from '@/pages/DashboardPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { AssistantPage } from '@/pages/AssistantPage';
import { ResearchPage } from '@/pages/ResearchPage';
import { SummarizePage } from '@/pages/SummarizePage';
import { ComparePage } from '@/pages/ComparePage';
import { KnowledgeGraphPage } from '@/pages/KnowledgeGraphPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';

type AppPageRoute = Exclude<AppRoute, '/'>;

const PAGE_TITLES: Record<AppPageRoute, TranslationKey> = {
  '/dashboard': 'nav.dashboard',
  '/library': 'nav.library',
  '/assistant': 'nav.assistant',
  '/research': 'nav.research',
  '/summarize': 'nav.summarize',
  '/compare': 'nav.compare',
  '/knowledge-graph': 'nav.knowledgeGraph',
  '/history': 'nav.history',
  '/settings': 'nav.settings',
};

function renderPage(route: AppPageRoute): ReactNode {
  switch (route) {
    case '/dashboard':
      return <DashboardPage />;
    case '/library':
      return <LibraryPage />;
    case '/assistant':
      return <AssistantPage />;
    case '/research':
      return <ResearchPage />;
    case '/summarize':
      return <SummarizePage />;
    case '/compare':
      return <ComparePage />;
    case '/knowledge-graph':
      return <KnowledgeGraphPage />;
    case '/history':
      return <HistoryPage />;
    case '/settings':
      return <SettingsPage />;
  }
}

export function AppShell({ route }: { route: AppPageRoute }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [route]);

  return (
    <LibraryProvider>
      <div className="min-h-screen bg-ink-50">
        <Sidebar activeRoute={route} open={menuOpen} onClose={() => setMenuOpen(false)} />

        <div className="lg:pl-72">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-ink-200/90 bg-white/90 px-4 backdrop-blur-md sm:px-8 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={t('nav.menu')}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 transition hover:bg-ink-100 lg:hidden shadow-soft"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="lg:hidden">
                <Logo size="sm" />
              </div>
              <h1 className="hidden text-base font-bold text-ink-900 lg:block tracking-tight">
                {t(PAGE_TITLES[route])}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <LanguageToggle />
            </div>
          </header>

          <main className="animate-fade-in px-4 py-8 sm:px-8 lg:py-10">
            <div className="mx-auto max-w-6xl">{renderPage(route)}</div>
          </main>
        </div>
      </div>
    </LibraryProvider>
  );
}
