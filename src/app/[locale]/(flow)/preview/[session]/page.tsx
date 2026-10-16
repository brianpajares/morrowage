import { setRequestLocale } from 'next-intl/server';
import { PreviewScreen } from '@/components/assessment/preview-screen';
import { getEnv } from '@/lib/env';
import { formatUsd } from '@/lib/price';
import { FULL_REPORT_PAGES } from '@/lib/report/constants';
import type { Locale } from '@/lib/locales';

export const dynamic = 'force-dynamic';

export default async function PreviewPage({ params }: { params: Promise<{ locale: Locale; session: string }> }) {
  const { locale, session } = await params;
  setRequestLocale(locale);
  // La fase la decide el servidor: validation (gate de email) o stripe (checkout con flag activo).
  const env = getEnv();
  const phase = env.stripeActive ? 'stripe' : env.paypalActive ? 'paypal' : 'validation';
  return <PreviewScreen sessionId={session} phase={phase} priceLabel={phase === 'paypal' ? formatUsd(env.price.amountMinor, locale) : undefined} pages={FULL_REPORT_PAGES} />;
}
