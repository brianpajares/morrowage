'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, BarChart3, Layers, Lock, Sparkles } from 'lucide-react';
import { AgeScale } from '@/components/charts/age-scale';
import { Accordion } from '@/components/ui/controls';
import { Badge, Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { CountUp } from '@/components/ui/count-up';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics/client';
import { useAssessment } from '@/lib/assessment/state';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locales';
import { formatNumber } from '@/lib/report/format';

/** Vista previa gratuita: SOLO los elementos `free_preview` (spec/outputs_spec.json). */
export function PreviewScreen({ sessionId, phase }: { sessionId: string; phase: 'validation' | 'stripe' }) {
  const t = useTranslations('preview');
  const trust = useTranslations('trust');
  const v = useTranslations('variables');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { state, reset } = useAssessment();
  const calc = state.calculation;
  const valid = state.hydrated && calc && calc.id === sessionId;

  useEffect(() => {
    if (valid) track('preview_view', { morrow_age_status: calc.output.morrow_age_status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  if (!state.hydrated) return <div className="container-page py-24" aria-busy="true" />;

  if (!valid || !calc) {
    return (
      <div className="container-page flex justify-center py-16">
        <Card className="w-full max-w-[720px] space-y-4 text-center">
          <h1 className="text-2xl font-extrabold">{t('expiredTitle')}</h1>
          <p className="text-muted">{t('expiredBody')}</p>
          <Button
            onClick={() => {
              reset();
              router.push('/calculate');
            }}
          >
            {t('restart')}
          </Button>
        </Card>
      </div>
    );
  }

  const o = calc.output;
  const within = o.morrow_age_status === 'WITHIN_REFERENCE_RANGE' && o.morrow_age !== undefined;
  const sentence =
    o.morrow_age_status === 'WITHIN_REFERENCE_RANGE' ? t('within', { age: o.morrow_age_display }) : o.morrow_age_status === 'BELOW_REFERENCE_RANGE' ? t('below') : t('above');
  const delta = o.delta_age;
  const deltaText =
    delta === undefined
      ? null
      : Math.abs(delta) < 0.05
        ? t('deltaSame')
        : delta < 0
          ? t('deltaLower', { years: formatNumber(locale, Math.abs(delta), 1, 1) })
          : t('deltaHigher', { years: formatNumber(locale, Math.abs(delta), 1, 1) });
  const driver = o.top_driver;
  const dir = driver.log_hazard_contribution > 5e-4 ? 'higher' : driver.log_hazard_contribution < -5e-4 ? 'lower' : 'neutral';
  const cta = phase === 'stripe' ? '/checkout' : '/report-request';

  return (
    <div className="container-page py-8 sm:py-14">
      <div className="mx-auto max-w-[760px] space-y-5">
        <Card className="animate-fade-up space-y-2 sm:p-10">
          <p className="eyebrow">{t('eyebrow')}</p>
          <p className="text-[clamp(4.5rem,18vw,7.5rem)] font-extrabold leading-none tracking-tight text-primary tabular" data-testid="morrow-age">
            {within ? (
              <CountUp from={calc.chronological} to={o.morrow_age!} finalText={o.morrow_age_display} />
            ) : (
              o.morrow_age_display
            )}
          </p>
          <p className="text-xl font-semibold" aria-live="polite">
            {sentence}
          </p>
          <p className="text-base text-muted">
            {t('chronological')}: <strong className="text-fg tabular">{calc.chronological}</strong>
            {deltaText ? ` · ${deltaText}` : null}
          </p>
          <AgeScale
            className="pt-4"
            chronological={calc.chronological}
            morrow={o.morrow_age}
            status={o.morrow_age_status}
            display={o.morrow_age_display}
            range={o.morrow_age_reference_range}
            labels={{
              chronological: t('chronological'),
              morrow: t('morrowLabel'),
              title: t('chartTitle'),
              summary: t('chartSummary', { chrono: calc.chronological, morrow: o.morrow_age_display }),
              boundary: o.morrow_age_status === 'BELOW_REFERENCE_RANGE' ? `${t('chartBelow')} ${t('boundaryNote')}` : o.morrow_age_status === 'ABOVE_REFERENCE_RANGE' ? `${t('chartAbove')} ${t('boundaryNote')}` : undefined,
            }}
          />
          <p className="border-t border-line pt-4 text-sm font-semibold">{t('not_bio')}</p>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold">{t('driverTitle')}</h2>
          </div>
          <p className="text-base">{t('driver', { driver: v(`${driver.name}.driver`) })}</p>
          <p className="text-sm text-muted">
            {v(`direction.${dir}`)} · {t('driverNote')}
          </p>
        </Card>

        <Accordion
          items={[
            {
              id: 'tech',
              title: t('techDetail'),
              content: <p>{t('hazard', { hr: formatNumber(locale, o.relative_hazard, 2, 2) })}</p>,
            },
          ]}
        />

        <section aria-labelledby="locked-title" className="space-y-3 pt-2">
          <p id="locked-title" className="text-base font-semibold">
            {t('locked')}
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['sensitivity', BarChart3],
                ['drivers', Layers],
                ['scenarios', Sparkles],
              ] as const
            ).map(([key, Icon]) => (
              <li key={key} className="relative overflow-hidden rounded-lg border border-dashed border-line bg-surface-alt/70 p-4">
                <Icon className="size-5 text-locked" aria-hidden="true" />
                <p className="mt-2 font-bold">{t(`lockedCards.${key}.title`)}</p>
                <p className="mt-1 text-sm text-muted">{t(`lockedCards.${key}.body`)}</p>
                <Badge tone="locked" className="mt-3">
                  <Lock className="size-3" aria-hidden="true" />
                  {t('lockedLabel')}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col items-stretch gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={cta}
            onClick={() => track('preview_unlock_click', { phase })}
            className={cn(buttonVariants({ size: 'lg' }), 'group w-full sm:w-auto')}
          >
            {t('cta')}
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <p className="text-xs text-muted">
            {trust('source')} ·{' '}
            <Link href="/methodology" className="font-semibold text-primary underline underline-offset-4" onClick={() => track('methodology_open', { origin_screen: 'preview' })}>
              {trust('method')}
            </Link>{' '}
            · {t('modelVersion', { model: o.model_version })} ·{' '}
            <Link href="/privacy" className="underline underline-offset-4">
              {t('privacyLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
