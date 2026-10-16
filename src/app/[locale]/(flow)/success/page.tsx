import { setRequestLocale } from 'next-intl/server';
import { SuccessScreen } from '@/components/assessment/success-screen';
import { getEnv } from '@/lib/env';
import { formatUsd } from '@/lib/price';
import type { Locale } from '@/lib/locales';

export const dynamic = 'force-dynamic';

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { locale } = await params;
  const { paid } = await searchParams;
  setRequestLocale(locale);
  const env = getEnv();
  return (
    <SuccessScreen
      paid={paid === '1' && env.stripeActive}
      ttlDays={Math.max(1, Math.round(env.reportTokenTtlHours / 24))}
      priceLabel={env.paypalActive ? formatUsd(env.price.amountMinor, locale) : null}
    />
  );
}
