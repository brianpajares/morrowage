import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ContentPage, Sections } from '@/components/site/content';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getEnv } from '@/lib/env';
import type { Locale } from '@/lib/locales';
import { formatDate, interp } from '@/lib/report/format';
import { pageMetadata } from '@/lib/seo';
import { getMessages } from '@/messages';

const LAST_UPDATED = '2026-10-13';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = getMessages(locale).privacy;
  return pageMetadata({ locale, path: '/privacy', title: m.metaTitle, description: m.metaDescription, index: true });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const msg = getMessages(locale);
  const m = msg.privacy;
  const env = getEnv();
  const vars = { retentionDays: env.reportRetentionDays, tokenDays: Math.max(1, Math.round(env.reportTokenTtlHours / 24)) };
  return (
    <ContentPage eyebrow="MorrowAge" title={m.title} lede={m.lede} meta={interp(m.updated, { date: formatDate(locale, LAST_UPDATED) })}>
      <Sections sections={m.sections} render={(t) => interp(t, vars)} />
      {env.privacyContactEmail ? <p className="prose-ma mt-8">{interp(m.contactLine, { email: env.privacyContactEmail })}</p> : null}
      <div className="mt-10">
        <Link href="/privacy/delete-request" className={buttonVariants({ variant: 'secondary' })}>
          {msg.footer.deleteData}
        </Link>
      </div>
    </ContentPage>
  );
}
