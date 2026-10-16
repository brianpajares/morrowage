import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/site/content';
import { Accordion } from '@/components/ui/controls';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/lib/locales';
import { pageMetadata } from '@/lib/seo';
import { getEnv } from '@/lib/env';
import { formatUsd } from '@/lib/price';
import { FULL_REPORT_PAGES } from '@/lib/report/constants';
import { getMessages } from '@/messages';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = getMessages(locale).faq;
  return pageMetadata({ locale, path: '/faq', title: m.metaTitle, description: m.metaDescription, index: true });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const all = getMessages(locale);
  const env = getEnv();
  // En modo de pago, la respuesta de «¿Cuánto cuesta?» dice el precio real (nunca «gratis»).
  const items = m_items(all.faq.items, env.paypalActive ? all.landing.faqPricePaid.replace('{pages}', String(FULL_REPORT_PAGES)).replace('{price}', formatUsd(env.price.amountMinor, locale)) : null);
  const m = { ...all.faq, items };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: m.items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
  return (
    <ContentPage eyebrow="MorrowAge" title={m.title} lede={m.lede}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Accordion items={m.items.map((i, n) => ({ id: `q${n}`, title: i.q, content: <p className="text-base">{i.a}</p> }))} />
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <p className="font-semibold">{m.stillQuestions}</p>
        <Link href="/methodology" className={buttonVariants({ variant: 'secondary' })}>
          {m.methodLink}
        </Link>
      </div>
    </ContentPage>
  );
}

/** Sustituye la respuesta de la pregunta de precio (la única que menciona coste) cuando hay cobro. */
function m_items<T extends { q: string; a: string }>(items: readonly T[], paidAnswer: string | null): T[] {
  if (!paidAnswer) return [...items];
  return items.map((i) => (/cuest|cost|custa/i.test(i.q) ? { ...i, a: paidAnswer } : i));
}
