import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { ContentPage, Sections } from '@/components/site/content';
import { TrackedLink } from '@/components/analytics/tracked-link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locales';
import { pageMetadata } from '@/lib/seo';
import { getMessages } from '@/messages';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = getMessages(locale).calculatorPage;
  return pageMetadata({ locale, path: '/risk-equivalent-age-calculator', title: m.metaTitle, description: m.metaDescription, index: true });
}

export default async function CalculatorLanding({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const m = getMessages(locale).calculatorPage;
  return (
    <ContentPage eyebrow="MorrowAge" title={m.h1} lede={m.lede}>
      <Sections sections={m.sections} />
      <div className="mt-12">
        <TrackedLink href="/calculate" event="calculate_start_click" withReferrer className={cn(buttonVariants({ size: 'lg' }), 'group')}>
          {m.cta}
          <ArrowRight className="size-5" aria-hidden="true" />
        </TrackedLink>
      </div>
    </ContentPage>
  );
}
