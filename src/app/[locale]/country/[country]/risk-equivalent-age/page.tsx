import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArrowRight, Info } from 'lucide-react';
import { ContentPage } from '@/components/site/content';
import { TrackedLink } from '@/components/analytics/tracked-link';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { COUNTRIES, countryName, isCountry } from '@/lib/countries';
import { LOCALES, type Locale } from '@/lib/locales';
import { interp } from '@/lib/report/format';
import { pageMetadata } from '@/lib/seo';
import { getMessages } from '@/messages';

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => COUNTRIES.map((country) => ({ locale, country })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; country: string }> }): Promise<Metadata> {
  const { locale, country } = await params;
  if (!isCountry(country)) return {};
  const m = getMessages(locale).country;
  const name = countryName(locale, country);
  return pageMetadata({
    locale,
    path: `/country/${country}/risk-equivalent-age`,
    title: interp(m.metaTitle, { country: name }),
    description: interp(m.metaDescription, { country: name }),
    index: true,
  });
}

export default async function CountryPage({ params }: { params: Promise<{ locale: Locale; country: string }> }) {
  const { locale, country } = await params;
  setRequestLocale(locale);
  if (!isCountry(country)) notFound();
  const m = getMessages(locale).country;
  const name = countryName(locale, country);
  return (
    <ContentPage eyebrow="MorrowAge" title={interp(m.h1, { country: name })}>
      <div role="note" className="mb-8 flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/8 p-5">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="font-bold">{m.notice}</p>
      </div>
      <div className="prose-ma space-y-4">
        {m.paragraphs.map((p) => (
          <p key={p}>{interp(p, { country: name })}</p>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-5">
        <TrackedLink href="/calculate" event="calculate_start_click" withReferrer className={cn(buttonVariants({ size: 'lg' }), 'group')}>
          {m.cta}
          <ArrowRight className="size-5" aria-hidden="true" />
        </TrackedLink>
        <Link href="/methodology" className={buttonVariants({ variant: 'link' })}>
          {m.methodLink}
        </Link>
      </div>
    </ContentPage>
  );
}
