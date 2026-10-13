import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, Calculator, Check, ClipboardList, Layers, Lock, Moon, Ruler, ShieldCheck, Timer, Wine, X, HeartPulse, Cigarette, Gauge, UserRound, BookOpen } from 'lucide-react';
import { AgeScale } from '@/components/charts/age-scale';
import { TrackOnView } from '@/components/analytics/track-on-view';
import { TrackedLink } from '@/components/analytics/tracked-link';
import { Badge, Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locales';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, path: '', title: t('title'), description: t('description'), index: true });
}

const INPUT_ICONS = [UserRound, Moon, Gauge, Cigarette, Timer, Ruler, Wine, HeartPulse] as const;
const STEP_ICONS = [ClipboardList, Calculator, Layers] as const;

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const trust = await getTranslations('trust');
  const v = await getTranslations('variables');
  const preview = await getTranslations('preview');
  const chips = t('trust').split('·').map((s) => s.trim()).filter(Boolean);

  const inputFields = [
    'age_years',
    'sleep_hours',
    'self_rated_health',
    'cigarettes_per_day',
    'reaction_time_ms',
    'waist_to_height_ratio',
    'alcohol_units_week',
    'resting_hr_bpm',
  ] as const;

  const steps = t.raw('steps') as Array<{ title: string; body: string }>;
  const freeItems = t.raw('freeItems') as string[];
  const fullItems = t.raw('fullItems') as string[];
  const notItems = t.raw('notItems') as string[];

  return (
    <>
      <TrackOnView event="landing_view" />

      {/* HERO */}
      <section className="container-page grid items-center gap-12 pb-16 pt-14 md:pt-20 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 className="mt-4 text-[clamp(2.4rem,6vw,4.1rem)] font-extrabold leading-[1.04]">{t('h1')}</h1>
          <p className="mt-6 max-w-2xl text-lg text-muted sm:text-xl">{t('sub')}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <TrackedLink
              href="/calculate"
              event="calculate_start_click"
              withReferrer
              className={cn(buttonVariants({ size: 'lg' }), 'group')}
            >
              {t('cta')}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </TrackedLink>
            <Link href="/how-it-works" className={buttonVariants({ variant: 'link' })}>
              {t('howLink')}
            </Link>
          </div>
          <ul className="mt-9 flex flex-wrap gap-2.5" aria-label={trust('method')}>
            {chips.map((c) => (
              <li key={c} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold text-muted shadow-soft">
                <Check className="size-4 text-primary" aria-hidden="true" strokeWidth={3} />
                {c}
              </li>
            ))}
            <li className="inline-flex items-center rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold text-muted shadow-soft tabular">
              40–69
            </li>
          </ul>
        </div>

        <Card className="animate-fade-up p-6 [animation-delay:120ms] sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">{preview('eyebrow')}</p>
            <Badge>{t('demoLabel')}</Badge>
          </div>
          <p className="mt-5 text-[4.5rem] font-extrabold leading-none tracking-tight text-primary tabular" aria-hidden="true">
            47.7
          </p>
          <AgeScale
            className="mt-3"
            chronological={52}
            morrow={47.7}
            status="WITHIN_REFERENCE_RANGE"
            display="47.7"
            labels={{
              chronological: t('demoChrono'),
              morrow: t('demoMorrow'),
              title: t('demoCaption'),
              summary: `${t('demoChrono')} 52. ${t('demoMorrow')} 47.7.`,
            }}
          />
          <p className="mt-2 border-t border-line pt-4 text-sm text-muted">{preview('not_bio')}</p>
        </Card>
      </section>

      {/* QUÉ HACE */}
      <section className="container-page py-14" aria-labelledby="what">
        <h2 id="what" className="text-3xl font-extrabold sm:text-4xl">
          {t('stepsTitle')}
        </h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = STEP_ICONS[i] ?? Layers;
            return (
              <li key={s.title}>
                <Card className="h-full space-y-3 p-6 transition-shadow hover:shadow-float">
                  <span className="grid size-11 place-items-center rounded-md bg-primary/12 text-primary ring-1 ring-primary/25">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-bold">{s.title}</h3>
                  <p className="text-muted">{s.body}</p>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      {/* LOS 8 DATOS */}
      <section className="container-page py-10" aria-labelledby="inputs">
        <div className="rounded-xl border border-line bg-surface p-7 shadow-card sm:p-10">
          <h2 id="inputs" className="text-3xl font-extrabold">
            {t('inputsTitle')}
          </h2>
          <p className="mt-2 text-muted">{t('inputsBody')}</p>
          <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {inputFields.map((f, i) => {
              const Icon = INPUT_ICONS[i] ?? UserRound;
              return (
                <li key={f} className="flex min-h-16 items-center gap-3 rounded-md border border-line bg-surface-alt/60 px-4 py-3">
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-sm font-semibold leading-snug">{v(`${f}.label`)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* QUÉ RECIBES */}
      <section className="container-page py-14" aria-labelledby="deliver">
        <h2 id="deliver" className="text-3xl font-extrabold sm:text-4xl">
          {t('deliverTitle')}
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Card className="space-y-4 p-6">
            <h3 className="text-xl font-bold">{t('freeTitle')}</h3>
            <ul className="space-y-3">
              {freeItems.map((i) => (
                <li key={i} className="flex gap-3">
                  <Check className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" strokeWidth={3} />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="space-y-4 border-primary/40 bg-gradient-to-br from-primary/8 to-surface p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-bold">{t('fullTitle')}</h3>
              <Badge tone="primary">{t('fullBadge')}</Badge>
            </div>
            <ul className="space-y-3">
              {fullItems.map((i) => (
                <li key={i} className="flex gap-3">
                  <Check className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" strokeWidth={3} />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* LO QUE NO ES */}
      <section className="container-page py-10" aria-labelledby="not">
        <div className="rounded-xl border border-line bg-surface-alt/70 p-7 sm:p-10">
          <h2 id="not" className="flex items-center gap-3 text-3xl font-extrabold">
            <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
            {t('notTitle')}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {notItems.map((i) => (
              <li key={i} className="flex gap-3">
                <X className="mt-1 size-5 shrink-0 text-muted" aria-hidden="true" strokeWidth={3} />
                <span className="text-lg">{i}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* METODOLOGÍA */}
      <section className="container-page py-14" aria-labelledby="method">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 id="method" className="flex items-center gap-3 text-3xl font-extrabold">
              <BookOpen className="size-7 text-primary" aria-hidden="true" />
              {t('methodTitle')}
            </h2>
            <p className="mt-4 text-lg text-muted">{t('methodBody')}</p>
            <p className="mt-4 text-sm font-semibold">{trust('source')}</p>
            <Link href="/methodology" className={cn(buttonVariants({ variant: 'link' }), 'mt-2')}>
              {trust('method')}
            </Link>
          </div>
          <Card className="font-mono text-[0.95rem] leading-relaxed" aria-label="MorrowAge = age × exp((LP_nonage − LP_benchmark) / β_log_age)">
            <p className="text-muted">{'// MorrowAge'}</p>
            <p className="mt-2 break-words text-fg">
              age × exp( (LP<sub>nonage</sub> − LP<sub>benchmark</sub>) / β<sub>log_age</sub> )
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <Lock className="size-4" aria-hidden="true" /> {t('trust')}
            </p>
          </Card>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="container-page pb-6 pt-8">
        <div className="relative overflow-hidden rounded-xl bg-primary p-8 text-primary-fg shadow-float sm:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary-fg/10 blur-2xl" />
          <h2 className="relative max-w-2xl text-3xl font-extrabold sm:text-4xl">{t('finalTitle')}</h2>
          <p className="relative mt-3 max-w-2xl text-lg opacity-90">{t('finalBody')}</p>
          <Link
            href="/calculate"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'relative mt-7 bg-primary-fg text-primary hover:bg-primary-fg hover:opacity-95',
            )}
          >
            {t('cta')}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
