import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { AssessmentProvider } from '@/lib/assessment/state';
import { TurnstileProvider } from '@/lib/turnstile-client';
import { pickNamespaces } from '@/messages/util';
import type { Messages } from '@/messages';

/**
 * Layout del funnel (scope → pasos → procesamiento → preview → gate → éxito). Aquí viven el estado del
 * assessment (sessionStorage), Turnstile invisible y SOLO los mensajes que necesitan estos componentes cliente.
 * Todas las rutas del grupo son noindex (PRD §25).
 */
export const metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function FlowLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = (await getMessages()) as unknown as Messages;
  const client = pickNamespaces(messages, [
    'a11y',
    'nav',
    'common',
    'scope',
    'steps',
    'errors',
    'variables',
    'processing',
    'preview',
    'email_gate',
    'success',
    'checkout',
    'trust',
  ]);
  return (
    <NextIntlClientProvider locale={locale} messages={client}>
      <AssessmentProvider>
        <TurnstileProvider>{children}</TurnstileProvider>
      </AssessmentProvider>
    </NextIntlClientProvider>
  );
}
