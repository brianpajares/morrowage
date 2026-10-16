'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, CheckCircle2, MailCheck } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics/client';
import { useAssessment } from '@/lib/assessment/state';
import { cn } from '@/lib/cn';

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

type DeliveryProgress = { state: 'pending' } | { state: 'sent' } | { state: 'failed'; ref: string | null };

/**
 * Consulta el estado de la entrega (el correo se envía tras la respuesta). Si falla, devuelve el código
 * corto `ref:` (p. ej. `resend_403_validation_error`) para poder diagnosticar con una captura.
 */
function useDeliveryProgress(leadId: string | undefined): DeliveryProgress {
  const [progress, setProgress] = useState<DeliveryProgress>({ state: 'pending' });
  useEffect(() => {
    if (!leadId) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      tries++;
      try {
        const res = await fetch(`/api/leads/${leadId}/status`, { credentials: 'same-origin', cache: 'no-store' });
        if (res.ok) {
          const j = (await res.json()) as { status?: string; ref?: string | null };
          if (j.status === 'delivered' || j.status === 'paid') return void (!stop && setProgress({ state: 'sent' }));
          if (j.status === 'failed') return void (!stop && setProgress({ state: 'failed', ref: j.ref ?? null }));
        }
      } catch {
        /* se reintenta */
      }
      if (!stop && tries < 8) setTimeout(tick, 2500);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [leadId]);
  return progress;
}

export function SuccessScreen({ paid, ttlDays, priceLabel }: { paid: boolean; ttlDays: number; priceLabel: string | null }) {
  const t = useTranslations('success');
  const tw = useTranslations('success.paid');
  const tc = useTranslations('checkout');
  const tp = useTranslations('preview');
  const { state, reset } = useAssessment();
  const delivery = state.delivery;
  const progress = useDeliveryProgress(state.hydrated ? delivery?.leadId : undefined);

  useEffect(() => {
    if (state.hydrated && delivery?.unlockUrl) track('report_gate_view', { phase: 'paypal' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated, !!delivery?.unlockUrl]);

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

  // ---- Modo de pago: «¡Felicidades! Revisa tu correo» + «Desbloquear ahora». SIN informe, SIN descarga.
  if (delivery.unlockUrl) {
    return (
      <div className="container-page flex justify-center py-14">
        <Card className="w-full max-w-[720px] animate-fade-up space-y-5 sm:p-10" data-testid="success-paywall">
          <span className="grid size-14 place-items-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/25">
            <MailCheck className="size-7" aria-hidden="true" />
          </span>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{tw('title')}</h1>
          <p className="text-lg">{tw('body', { email: delivery.emailMasked ?? '' })}</p>
          <p className="text-sm text-muted">{tw('hint')}</p>
          {progress.state === 'failed' ? (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm font-semibold text-danger">
              {tw('failed', { ref: progress.ref ?? 'unknown' })}
            </p>
          ) : null}
          <div className="space-y-2 border-t border-line pt-5">
            {/* Navegación completa: ruta con token, noindex y no-referrer. */}
            <a
              href={pathOf(delivery.unlockUrl)}
              onClick={() => track('preview_unlock_click', { phase: 'paypal' })}
              className={cn(buttonVariants({ size: 'lg' }), 'group w-full sm:w-auto')}
              data-testid="unlock-now"
            >
              {tw('unlockCta', { price: priceLabel ?? '' })}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <p className="text-sm text-muted">{tw('unlockNote')}</p>
          </div>
          <button type="button" onClick={reset} className="block text-sm text-muted underline underline-offset-4 hover:text-fg">
            {tp('restart')}
          </button>
        </Card>
      </div>
    );
  }

  // ---- Modo validation (informe gratis)
  return (
    <div className="container-page flex justify-center py-14">
      <Card className="w-full max-w-[720px] animate-fade-up space-y-5 sm:p-10">
        <CheckCircle2 className="size-12 text-primary" aria-hidden="true" />
        <h1 className="text-3xl font-extrabold sm:text-4xl">{t('title')}</h1>
        <p className="text-lg">{t('body')}</p>
        <ul className="space-y-1.5 text-sm text-muted">
          <li>
            {progress.state === 'sent'
              ? t('emailSent')
              : progress.state === 'failed'
                ? `${t('emailFailed')} (ref: ${progress.ref ?? 'unknown'})`
                : t('emailPending')}
          </li>
          <li>{t('checkSpam')}</li>
          <li>{t('expiry', { days: ttlDays })}</li>
          <li className="font-semibold text-fg">{t('saveLink')}</li>
        </ul>
        {delivery.reportUrl ? (
          // Navegación completa: el informe es una ruta con token y su propia política de caché/referrer.
          <a href={pathOf(delivery.reportUrl)} className={cn(buttonVariants({ size: 'lg' }), 'group')}>
            {t('cta')}
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        ) : null}
        <button type="button" onClick={reset} className="block text-sm text-muted underline underline-offset-4 hover:text-fg">
          {tp('restart')}
        </button>
      </Card>
    </div>
  );
}
