import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { Button, Notice } from '@/components/ui';

export function LoadDemoButton({ variant = 'secondary' }: { variant?: 'secondary' | 'primary' }) {
  const { t } = useTranslation();
  const { loadDemoDocuments } = useLibrary();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await loadDemoDocuments();
      setMessage(
        result === 'added'
          ? { tone: 'success', text: t('library.demoLoaded') }
          : { tone: 'info', text: t('library.demoExists') },
      );
    } catch {
      setMessage({ tone: 'error', text: t('common.connectionError') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button variant={variant} onClick={handleClick} loading={loading}>
        <Sparkles className="h-4 w-4" />
        {t('library.loadDemo')}
      </Button>
      {message && (
        <Notice tone={message.tone} icon={<Sparkles className="h-5 w-5" />}>
          {message.text}
        </Notice>
      )}
    </div>
  );
}
