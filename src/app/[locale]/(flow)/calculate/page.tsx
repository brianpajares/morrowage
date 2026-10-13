import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopeGate } from '@/components/assessment/scope-gate';
import { TrackOnView } from '@/components/analytics/track-on-view';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/lib/locales';
import { Link } from '@/i18n/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'scope' });
  return pageMetadata({ locale, path: '/calculate', title: t('title'), description: t('body'), index: false });
}

export default async function ScopePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('scope');
  const points = t.raw('points') as string[];
  return (
    <div className="container-page flex justify-center py-12 sm:py-20">
      <TrackOnView event="scope_view" />
      <section className="w-full max-w-[720px] animate-fade-up rounded-lg border border-line bg-surface p-7 shadow-card sm:p-10" aria-labelledby="scope-title">
        <p className="eyebrow">MorrowAge</p>
        <h1 id="scope-title" className="mt-2 text-3xl font-extrabold sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-lg">{t('body')}</p>
        <ul className="mt-5 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-base">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-md border-l-4 border-primary bg-surface-alt px-4 py-3 text-sm">
          {t('noPii')}{' '}
          <Link href="/privacy" className="font-semibold text-primary underline underline-offset-4">
            {t('privacyLink')}
          </Link>
        </p>
        <ScopeGate />
      </section>
    </div>
  );
}
