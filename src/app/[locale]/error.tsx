'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  useEffect(() => {
    // Solo el digest (identificador opaco); nunca el mensaje ni datos de la página.
    void import('@sentry/nextjs').then((S) => S.captureException(new Error(`render_error:${error.digest ?? 'n/a'}`))).catch(() => undefined);
  }, [error.digest]);
  return (
    <div className="container-page grid min-h-[50dvh] place-items-center py-20">
      <div className="reading space-y-4 text-center" role="alert">
        <h1 className="text-3xl font-extrabold">{te('generic')}</h1>
        <Button onClick={reset}>{tc('retry')}</Button>
      </div>
    </div>
  );
}
