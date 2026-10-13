import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { ContentPage, Sections } from '@/components/site/content';
import { TrackedLink } from '@/components/analytics/tracked-link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { LOCALES, type Locale } from '@/lib/locales';
import { pageMetadata } from '@/lib/seo';
import { getMessages } from '@/messages';
import { GUIDE_SLUGS, type GuideSlug } from '../slugs';

const isSlug = (s: string): s is GuideSlug => (GUIDE_SLUGS as readonly string[]).includes(s);

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => GUIDE_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSlug(slug)) return {};
  const g = getMessages(locale).guides.items[slug];
  return pageMetadata({ locale, path: `/guides/${slug}`, title: g.title, description: g.description, index: true });
}

export default async function GuidePage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!isSlug(slug)) notFound();
  const m = getMessages(locale).guides;
  const g = m.items[slug];
  return (
    <ContentPage eyebrow="MorrowAge" title={g.title} lede={g.description}>
      <Sections sections={g.sections} />
      <div className="mt-12">
        <TrackedLink href="/calculate" event="calculate_start_click" withReferrer className={cn(buttonVariants({ size: 'lg' }), 'group')}>
          {m.cta}
          <ArrowRight className="size-5" aria-hidden="true" />
        </TrackedLink>
      </div>
    </ContentPage>
  );
}
