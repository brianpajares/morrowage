import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { ContentPage } from '@/components/site/content';
import { TrackedLink } from '@/components/analytics/tracked-link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locales';
import { pageMetadata } from '@/lib/seo';
import { getMessages } from '@/messages';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = getMessages(locale).howItWorks;
  return pageMetadata({ locale, path: '/how-it-works', title: m.metaTitle, description: m.metaDescription, index: true });
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const m = getMessages(locale).howItWorks;
  const steps = [
    [m.s1Title, m.s1Body],
    [m.s2Title, m.s2Body],
    [m.s3Title, m.s3Body],
  ] as const;
  return (
    <ContentPage eyebrow="MorrowAge v2.1" title={m.title} lede={m.lede} wide>
      <ol className="grid gap-5 md:grid-cols-3">
        {steps.map(([title, body]) => (
          <li key={title}>
            <Card className="h-full space-y-2 p-6">
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-muted">{body}</p>
            </Card>
          </li>
        ))}
      </ol>

      <section className="mt-12 space-y-3" aria-labelledby="formula">
        <h2 id="formula" className="text-2xl font-bold">
          {m.formulaTitle}
        </h2>
        <Card className="space-y-3 font-mono text-base">
          <p className="break-words">MorrowAge = age × exp( (LP_nonage − LP_benchmark) / β_log_age )</p>
        </Card>
        <p className="text-sm text-muted">{m.formulaNote}</p>
      </section>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <Card className="space-y-2 p-6">
          <h2 className="text-xl font-bold">{m.meansTitle}</h2>
          <p>{m.means}</p>
        </Card>
        <Card className="space-y-2 p-6">
          <h2 className="text-xl font-bold">{m.notMeansTitle}</h2>
          <p>{m.notMeans}</p>
        </Card>
      </div>

      <section className="mt-12 space-y-3" aria-labelledby="limits">
        <h2 id="limits" className="text-2xl font-bold">
          {m.limitsTitle}
        </h2>
        <ul className="space-y-3">
          {m.limits.map((l) => (
            <li key={l} className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-5">
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
