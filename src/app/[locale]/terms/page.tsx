import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ContentPage, Sections } from '@/components/site/content';
import { getEnv } from '@/lib/env';
import type { Locale } from '@/lib/locales';
import { formatDate, interp } from '@/lib/report/format';
import { pageMetadata } from '@/lib/seo';
import { getMessages } from '@/messages';

const LAST_UPDATED = '2026-10-13';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = getMessages(locale).terms;
  return pageMetadata({ locale, path: '/terms', title: m.metaTitle, description: m.metaDescription, index: true });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const m = getMessages(locale).terms;
  const tokenDays = Math.max(1, Math.round(getEnv().reportTokenTtlHours / 24));
  return (
    <ContentPage eyebrow="MorrowAge" title={m.title} lede={m.lede} meta={interp(m.updated, { date: formatDate(locale, LAST_UPDATED) })}>
      <Sections sections={m.sections} render={(t) => interp(t, { tokenDays })} />
    </ContentPage>
  );
}
