import { setRequestLocale } from 'next-intl/server';
import { ProcessingScreen } from '@/components/assessment/processing-screen';
import type { Locale } from '@/lib/locales';

export default async function ProcessingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProcessingScreen />;
}
