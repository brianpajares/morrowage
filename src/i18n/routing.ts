import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/locales';

/**
 * Prefijo de locale siempre presente (`/es/…`, `/en/…`, `/pt/…`): URLs estables y canónicas por
 * idioma (NFR-06), `hreflang` simétrico y SEO localizado (PRD §25). `/` redirige según
 * Accept-Language / cookie NEXT_LOCALE.
 */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});
