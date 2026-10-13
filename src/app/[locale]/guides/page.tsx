import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { ContentPage } from '@/components/site/content';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/lib/locales';
import { pageMetadata } from '@/lib/seo';
import { getMessages } from '@/messages';
import { GUIDE_SLUGS } from './slugs';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = getMessages(locale).guides;
  return pageMetadata({ locale, path: '/guides', title: m.metaTitle, description: m.indexLede, index: true });
}

export default async function GuidesIndex({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const m = getMessages(locale).guides;
  return (
    <ContentPage eyebrow="MorrowAge" title={m.indexTitle} lede={m.indexLede}>
      <ul className="space-y-4">
        {GUIDE_SLUGS.map((slug) => {
          const g = m.items[slug];
          return (
            <li key={slug}>
              <Card className="space-y-2 p-6 transition-shadow hover:shadow-float">
                <h2 className="text-xl font-bold">{g.title}</h2>
                <p className="text-muted">{g.description}</p>
                <Link href={`/guides/${slug}`} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline underline-offset-4">
                  {m.readGuide}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </ContentPage>
  );
}
