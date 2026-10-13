import type { MetadataRoute } from 'next';
import { COUNTRIES } from '@/lib/countries';
import { LOCALES } from '@/lib/locales';
import { INDEXABLE_PATHS, localizedUrl } from '@/lib/seo';
import { GUIDE_SLUGS } from './[locale]/guides/slugs';

/** Solo páginas indexables (PRD §25): landing, cómo funciona, metodología, FAQ, legal, SEO localizado. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths: string[] = [
    ...INDEXABLE_PATHS,
    '/guides',
    ...GUIDE_SLUGS.map((s) => `/guides/${s}`),
    ...COUNTRIES.map((c) => `/country/${c}/risk-equivalent-age`),
  ];
  return paths.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: localizedUrl(locale, path),
      lastModified: new Date('2026-10-13'),
      changeFrequency: path === '' ? ('weekly' as const) : ('monthly' as const),
      priority: path === '' ? 1 : path === '/methodology' || path === '/risk-equivalent-age-calculator' ? 0.8 : 0.6,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, localizedUrl(l, path)])) },
    })),
  );
}
