import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { GateScreen } from '@/components/assessment/gate-screen';
import { getEnv } from '@/lib/env';
import type { Locale } from '@/lib/locales';

export const dynamic = 'force-dynamic';

export default async function ReportRequestPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Con Stripe activo el flujo gratuito de email no existe (la URL no es alcanzable).
  if (getEnv().stripeActive) notFound();
  return <GateScreen phase={getEnv().paypalActive ? 'paypal' : 'validation'} />;
}
