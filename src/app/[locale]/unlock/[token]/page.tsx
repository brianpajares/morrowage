import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages as getIntlMessages, setRequestLocale } from 'next-intl/server';
import { TrackOnView } from '@/components/analytics/track-on-view';
import { UnlockMessage, UnlockScreen } from '@/components/payment/unlock-screen';
import { getEnv } from '@/lib/env';
import type { Locale } from '@/lib/locales';
import { FULL_REPORT_PAGES } from '@/lib/report/extras';
import { formatUsd } from '@/lib/price';
import { getMessages, type Messages } from '@/messages';
import { pickNamespaces } from '@/messages/util';
import { getUnlockContext, type UnlockContext } from '@/server/services/unlock';
import { getStore } from '@/server/store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: getMessages(locale).unlock.metaTitle,
    robots: { index: false, follow: false, nocache: true, noarchive: true },
    referrer: 'no-referrer',
  };
}

/** /[locale]/unlock/<token> — noindex, no-referrer; el token solo llegó al correo del cliente (sin segundo código). */
export default async function UnlockPage({ params }: { params: Promise<{ locale: Locale; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const env = getEnv();

  let ctx: UnlockContext;
  try {
    ctx = await getUnlockContext(getStore(), token);
  } catch {
    ctx = { status: 'not_found' };
  }

  const messages = (await getIntlMessages()) as unknown as Messages;
  const client = pickNamespaces(messages, ['unlock', 'preview', 'a11y', 'common', 'errors', 'nav']);

  if (ctx.status === 'open_report') redirect(`/${locale}/report/${token}`);
  if (ctx.status === 'expired' || ctx.status === 'not_found' || !env.paypalActive || !env.paypal.clientId) {
    // Sin pagos activos no hay nada que desbloquear: se muestra el mismo aviso neutro (no se filtra configuración).
    if (ctx.status === 'ok' && !env.paypalActive) notFound();
    return (
      <NextIntlClientProvider locale={locale} messages={client}>
        <UnlockMessage kind={ctx.status === 'expired' ? 'expired' : 'not_found'} />
      </NextIntlClientProvider>
    );
  }

  return (
    <NextIntlClientProvider locale={locale} messages={client}>
      <TrackOnView event="checkout_view" props={{ currency: 'USD' }} />
      <UnlockScreen
        token={token}
        locale={locale}
        clientId={env.paypal.clientId}
        sandbox={env.paypal.env === 'sandbox'}
        priceLabel={formatUsd(env.price.amountMinor, locale)}
        pages={FULL_REPORT_PAGES}
        emailMasked={ctx.emailMasked}
        resultDisplay={ctx.resultDisplay}
        chronological={ctx.chronological}
      />
    </NextIntlClientProvider>
  );
}
