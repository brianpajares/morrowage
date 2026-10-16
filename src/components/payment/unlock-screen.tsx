'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check, CheckCircle2, Clock, Lock, ShieldCheck } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/controls';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { PaymentGate, type CaptureResult } from './payment-gate';

export interface UnlockScreenProps {
  token: string;
  locale: string;
  clientId: string;
  sandbox: boolean;
  priceLabel: string;
  pages: number;
  emailMasked: string;
  resultDisplay: string;
  chronological: number;
}

type Phase = { kind: 'pay' } | { kind: 'paid'; reportUrl?: string } | { kind: 'pending' } | { kind: 'already' };

/** Página de desbloqueo: el valor del informe, el precio claro y el pago (PayPal o tarjeta) sin segundo código. */
export function UnlockScreen(p: UnlockScreenProps) {
  const t = useTranslations('unlock');
  const preview = useTranslations('preview');
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'pay' });

  const onResult = (r: CaptureResult) => {
    if (r.status === 'paid') setPhase({ kind: 'paid', reportUrl: r.reportUrl });
    else if (r.status === 'pending') setPhase({ kind: 'pending' });
    else setPhase({ kind: 'already' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (phase.kind !== 'pay') {
    const view =
      phase.kind === 'paid'
        ? { title: t('paidTitle'), body: t('paidBody', { email: p.emailMasked }), icon: <CheckCircle2 className="size-12 text-primary" aria-hidden="true" /> }
        : phase.kind === 'pending'
          ? { title: t('pendingTitle'), body: t('pendingBody', { email: p.emailMasked }), icon: <Clock className="size-12 text-primary" aria-hidden="true" /> }
          : { title: t('alreadyTitle'), body: t('alreadyBody', { email: p.emailMasked }), icon: <CheckCircle2 className="size-12 text-primary" aria-hidden="true" /> };
    return (
      <div className="container-page flex justify-center py-14">
        <Card className="w-full max-w-[720px] animate-fade-up space-y-5 sm:p-10" role="status" data-testid="unlock-result">
          {view.icon}
          <h1 className="text-3xl font-extrabold sm:text-4xl">{view.title}</h1>
          <p className="text-lg">{view.body}</p>
          <p className="text-sm text-muted">{t('checkSpam')}</p>
          {phase.kind === 'paid' && phase.reportUrl ? (
            // Navegación completa: el informe es una ruta con token y su propia política de caché/referrer.
            <a href={new URL(phase.reportUrl, 'http://x').pathname} className={cn(buttonVariants({ size: 'lg' }), 'group')} data-testid="open-report">
              {t('openReport')}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          ) : null}
        </Card>
      </div>
    );
  }

  const includes = t.raw('includes') as string[];
  const trust = t.raw('trust') as string[];

  return (
    <div className="container-page py-8 sm:py-14">
      <div className="mx-auto max-w-[1000px]">
        <header className="mb-8 max-w-[680px] space-y-3">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{t('title')}</h1>
          <p className="text-lg text-muted">{t('lead', { pages: p.pages, email: p.emailMasked })}</p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          {/* Columna de pago: primero en móvil, sticky en escritorio */}
          <aside className="order-1 space-y-4 lg:sticky lg:top-24 lg:order-2" aria-label={t('priceTitle')}>
            <Card className="space-y-5 border-primary/40 p-6 shadow-card">
              {p.sandbox ? (
                <Badge tone="locked" className="w-full justify-center py-1.5 text-xs">
                  {t('sandbox')}
                </Badge>
              ) : null}
              <div>
                <p className="text-sm font-semibold text-muted">{t('priceTitle')}</p>
                <p className="text-5xl font-extrabold tracking-tight text-primary tabular" data-testid="unlock-price">
                  {p.priceLabel}
                </p>
                <p className="mt-1 text-sm text-muted">{t('priceNote')}</p>
              </div>

              <div className="space-y-1.5">
                <CheckboxField id="unlock-terms" checked={terms} onCheckedChange={(v) => { setTerms(v); if (v) setTermsError(false); }} invalid={termsError} describedBy={termsError ? 'unlock-terms-error' : undefined}>
                  <span className="text-sm">
                    {t('terms')}{' '}
                    <Link href="/terms" className="font-semibold text-primary underline underline-offset-4">
                      {t('termsLink')}
                    </Link>
                  </span>
                </CheckboxField>
                {termsError ? (
                  <p id="unlock-terms-error" role="alert" className="pl-9 text-sm font-semibold text-danger">
                    {t('termsRequired')}
                  </p>
                ) : null}
              </div>

              <PaymentGate
                token={p.token}
                clientId={p.clientId}
                locale={p.locale}
                termsAccepted={terms}
                onTermsRequired={() => {
                  setTermsError(true);
                  document.getElementById('unlock-terms')?.focus();
                }}
                onResult={onResult}
                onCancel={() => undefined}
              />

              <p className="flex items-start gap-2 text-xs text-muted">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {t('secure')}
              </p>
            </Card>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs font-semibold text-muted">
              {trust.map((x) => (
                <li key={x} className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                  {x}
                </li>
              ))}
            </ul>
          </aside>

          {/* Columna de valor */}
          <div className="order-2 space-y-5 lg:order-1">
            <Card className="space-y-1 sm:p-8">
              <p className="eyebrow">{t('resultLabel')}</p>
              <p className="text-6xl font-extrabold leading-none tracking-tight text-primary tabular sm:text-7xl" data-testid="unlock-result-age">
                {p.resultDisplay}
              </p>
              <p className="pt-2 text-base text-muted">{t('chronological', { age: p.chronological })}</p>
              <p className="border-t border-line pt-3 text-sm font-semibold">{preview('not_bio')}</p>
            </Card>

            <Card className="space-y-4 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold">{t('includesTitle')}</h2>
                <Badge tone="primary">{t('pagesBadge', { pages: p.pages })}</Badge>
              </div>
              <ul className="space-y-3">
                {includes.map((i) => (
                  <li key={i} className="flex gap-3">
                    <Check className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" strokeWidth={3} />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <p className="rounded-md border-l-4 border-primary bg-surface-alt px-4 py-3 text-sm">{t('mission')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Estado de enlace no válido / caducado. */
export function UnlockMessage({ kind }: { kind: 'expired' | 'not_found' }) {
  const t = useTranslations('unlock');
  return (
    <div className="container-page flex justify-center py-16">
      <Card className="w-full max-w-[720px] space-y-4 text-center" role="status">
        <h1 className="text-3xl font-extrabold">{kind === 'expired' ? t('expiredTitle') : t('notFoundTitle')}</h1>
        <p className="text-lg text-muted">{kind === 'expired' ? t('expiredBody') : t('notFoundBody')}</p>
        <div className="flex justify-center pt-2">
          <Button asChild>
            <Link href="/calculate">{t('restart')}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
