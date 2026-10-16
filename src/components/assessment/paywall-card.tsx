'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, Check, Lock, ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics/client';
import { cn } from '@/lib/cn';

/**
 * Ilustración del informe «por dentro». Datos 100 % sintéticos y de longitud fija: es CSS, no el
 * informe real, así que nada del resultado del usuario puede deducirse de ella.
 */
function BlurredReportMock({ title, note }: { title: string; note: string }) {
  const rows = [78, 54, 66, 38, 58, 46];
  return (
    <figure className="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-xl border border-line bg-surface shadow-card" aria-label={title}>
      <div aria-hidden="true" className="select-none space-y-3 p-5 blur-[5px]">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 rounded bg-primary/70" />
          <div className="h-3 w-16 rounded bg-line" />
        </div>
        <div className="h-9 w-32 rounded bg-fg/20" />
        <div className="space-y-2.5 pt-2">
          {rows.map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2.5 w-20 rounded bg-fg/15" />
              <div className="h-4 rounded bg-primary/30" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-md bg-surface-alt ring-1 ring-line" />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-surface/90 via-surface/30 to-transparent">
        <div className="flex flex-col items-center gap-1 rounded-lg bg-surface/90 px-4 py-3 text-center shadow-soft ring-1 ring-line">
          <Lock className="size-5 text-locked" aria-hidden="true" />
          <figcaption className="text-sm font-bold">{title}</figcaption>
          <span className="text-xs text-muted">{note}</span>
        </div>
      </div>
    </figure>
  );
}

/** Bloque de valor + precio de la vista previa gratuita en modo de pago (CTA → correo con vista previa). */
export function PaywallCard({ priceLabel, pages }: { priceLabel: string; pages: number }) {
  const t = useTranslations('paywall');
  const includes = t.raw('includes') as string[];
  const trust = t.raw('trust') as string[];

  return (
    <section
      aria-labelledby="paywall-title"
      data-testid="paywall"
      className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/8 via-surface to-surface p-6 shadow-card sm:p-8"
    >
      <div className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="eyebrow">{t('eyebrow', { pages })}</p>
            <h2 id="paywall-title" className="text-2xl font-extrabold leading-tight sm:text-3xl">
              {t('title')}
            </h2>
            <p className="text-base text-muted">{t('body')}</p>
          </div>

          <ul className="space-y-2.5">
            {includes.map((i) => (
              <li key={i} className="flex gap-3">
                <Check className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" strokeWidth={3} />
                <span>{i}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-1 border-t border-line pt-4">
            <p className="text-4xl font-extrabold tracking-tight text-primary tabular" data-testid="paywall-price">
              {priceLabel}
            </p>
            <p className="pb-1 text-sm text-muted">
              {t('price', { price: '' }).trim()} · {t('priceNote')}
            </p>
          </div>

          <div className="space-y-2">
            <Link
              href="/report-request"
              onClick={() => track('preview_unlock_click', { phase: 'paypal' })}
              className={cn(buttonVariants({ size: 'lg' }), 'group w-full sm:w-auto')}
              data-testid="paywall-cta"
            >
              {t('cta')}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <p className="text-sm text-muted">{t('ctaNote')}</p>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
            {trust.map((x) => (
              <li key={x} className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                {x}
              </li>
            ))}
          </ul>
        </div>

        <BlurredReportMock title={t('mockTitle')} note={t('mockNote')} />
      </div>
    </section>
  );
}
