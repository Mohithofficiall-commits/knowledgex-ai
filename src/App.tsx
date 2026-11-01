import { LanguageProvider } from '@/i18n/LanguageContext';
import { useRoute } from '@/lib/router';
import { AppShell } from '@/components/layout/AppShell';
import { LandingPage } from '@/pages/LandingPage';

function App() {
  const route = useRoute();

  return (
    <LanguageProvider>
      {route === '/' ? <LandingPage /> : <AppShell route={route} />}
    </LanguageProvider>
  );
}

export default App;
