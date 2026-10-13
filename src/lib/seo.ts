import type { Metadata } from 'next';
import { getEnv } from '@/lib/env';
import { LOCALES, type Locale } from '@/lib/locales';

/** Segmentos del sitio que se indexan (PRD §25). El resto es noindex. */
export const INDEXABLE_PATHS = [
  '',
  '/how-it-works',
  '/methodology',
  '/faq',
  '/privacy',
  '/terms',
  '/risk-equivalent-age-calculator',
] as const;

export function localizedUrl(locale: Locale, path: string): string {
  const base = getEnv().appUrl;
  return `${base}/${locale}${path === '/' ? '' : path}`;
}

export function pageMetadata(opts: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  index: boolean;
}): Metadata {
  const { locale, path, title, description, index } = opts;
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((l) => [l, localizedUrl(l, path)]));
  languages['x-default'] = localizedUrl('es', path);
  return {
    title,
    description,
    alternates: { canonical: localizedUrl(locale, path), languages },
    openGraph: { title, description, url: localizedUrl(locale, path), locale },
    robots: index ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
  };
}
