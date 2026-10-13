import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { CheckoutScreen } from '@/components/assessment/checkout-screen';
import { getEnv } from '@/lib/env';
import type { Locale } from '@/lib/locales';
import { getStripe } from '@/server/services/stripe';

export const dynamic = 'force-dynamic';

async function loadPrice(): Promise<{ priceId: string; amountMinor: number; currency: string } | null> {
  const { stripe } = getEnv();
  if (!stripe.priceId) return null;
  try {
    const price = await (await getStripe()).prices.retrieve(stripe.priceId);
    if (!price.active || price.unit_amount === null) return null;
    return { priceId: stripe.priceId, amountMinor: price.unit_amount, currency: price.currency.toUpperCase() };
  } catch {
    return null;
  }
}

/** /checkout existe técnicamente, pero NO es alcanzable mientras Stripe esté apagado (404). */
export default async function CheckoutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const env = getEnv();
  if (!env.stripeActive || !env.capabilities.stripe) notFound();
  return <CheckoutScreen price={await loadPrice()} />;
}
