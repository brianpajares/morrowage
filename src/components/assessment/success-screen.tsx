'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { useAssessment } from '@/lib/assessment/state';
import { cn } from '@/lib/cn';

function reportPath(reportUrl: string): string {
  try {
    const u = new URL(reportUrl);
    return u.pathname;
  } catch {
    return reportUrl;
  }
}

export function SuccessScreen({ paid, ttlDays }: { paid: boolean; ttlDays: number }) {
  const t = useTranslations('success');
  const tc = useTranslations('checkout');
  const tp = useTranslations('preview');
  const { state, reset } = useAssessment();

  if (paid) {
    return (
      <div className="container-page flex justify-center py-14">
        <Card className="w-full max-w-[720px] space-y-4 sm:p-10" role="status">
          <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-extrabold">{tc('paidTitle')}</h1>
          <p className="text-lg text-muted">{tc('paidBody')}</p>
          <p className="text-sm text-muted">{t('checkSpam')}</p>
        </Card>
      </div>
    );
  }

  if (!state.hydrated) return <div className="container-page py-24" aria-busy="true" />;
  const delivery = state.delivery;

  if (!delivery) {
    return (
      <div className="container-page flex justify-center py-14">
        <Card className="w-full max-w-[720px] space-y-4 text-center">
          <p className="text-lg">{t('missing')}</p>
          <Button asChild>
            <Link href="/calculate">{tp('restart')}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page flex justify-center py-14">
      <Card className="w-full max-w-[720px] animate-fade-up space-y-5 sm:p-10">
        <CheckCircle2 className="size-12 text-primary" aria-hidden="true" />
        <h1 className="text-3xl font-extrabold sm:text-4xl">{t('title')}</h1>
        <p className="text-lg">{t('body')}</p>
        <ul className="space-y-1.5 text-sm text-muted">
          <li>{t('emailPending')}</li>
          <li>{t('checkSpam')}</li>
          <li>{t('expiry', { days: ttlDays })}</li>
          <li className="font-semibold text-fg">{t('saveLink')}</li>
        </ul>
        {/* Navegación completa: el informe es una ruta con token y su propia política de caché/referrer. */}
        <a href={reportPath(delivery.reportUrl)} className={cn(buttonVariants({ size: 'lg' }), 'group')} onClick={() => undefined}>
          {t('cta')}
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </a>
        <button type="button" onClick={reset} className="block text-sm text-muted underline underline-offset-4 hover:text-fg">
          {tp('restart')}
        </button>
      </Card>
    </div>
  );
}
