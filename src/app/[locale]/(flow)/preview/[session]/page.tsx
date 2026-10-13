import { setRequestLocale } from 'next-intl/server';
import { PreviewScreen } from '@/components/assessment/preview-screen';
import { getEnv } from '@/lib/env';
import type { Locale } from '@/lib/locales';

export const dynamic = 'force-dynamic';

export default async function PreviewPage({ params }: { params: Promise<{ locale: Locale; session: string }> }) {
  const { locale, session } = await params;
  setRequestLocale(locale);
  // La fase la decide el servidor: validation (gate de email) o stripe (checkout con flag activo).
  const phase = getEnv().stripeActive ? 'stripe' : 'validation';
  return <PreviewScreen sessionId={session} phase={phase} />;
}
