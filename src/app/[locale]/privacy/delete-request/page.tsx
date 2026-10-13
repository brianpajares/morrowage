import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages as getIntlMessages, setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/site/content';
import { DeleteRequestForm } from '@/components/site/delete-request-form';
import { isVerificationId } from '@/lib/security/tokens-client';
import type { Locale } from '@/lib/locales';
import { pageMetadata } from '@/lib/seo';
import { TurnstileProvider } from '@/lib/turnstile-client';
import { getMessages, type Messages } from '@/messages';
import { pickNamespaces } from '@/messages/util';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = getMessages(locale).deleteRequest;
  // Página de acción: se enlaza desde privacidad/pie, pero no se indexa.
  return pageMetadata({ locale, path: '/privacy/delete-request', title: m.metaTitle, description: m.metaDescription, index: false });
}

export default async function DeleteRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ vid?: string }>;
}) {
  const { locale } = await params;
  const { vid } = await searchParams;
  setRequestLocale(locale);
  const m = getMessages(locale).deleteRequest;
  const messages = pickNamespaces((await getIntlMessages()) as unknown as Messages, ['deleteRequest', 'errors', 'a11y']);
  const initial = vid && isVerificationId(vid.toUpperCase()) ? vid.toUpperCase() : '';
  return (
    <ContentPage eyebrow="MorrowAge" title={m.title} lede={m.lede}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <TurnstileProvider>
          <DeleteRequestForm initialVerificationId={initial} />
        </TurnstileProvider>
      </NextIntlClientProvider>
    </ContentPage>
  );
}
