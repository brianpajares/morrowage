import type { Locale } from '@/lib/locales';

/** Mercados de validación (spec/monetizacion.json): EE. UU. primario; UK, CA, AU, BR y PE como extensión. */
export const COUNTRIES = ['us', 'gb', 'ca', 'au', 'br', 'pe'] as const;
export type CountrySlug = (typeof COUNTRIES)[number];

export function isCountry(slug: string): slug is CountrySlug {
  return (COUNTRIES as readonly string[]).includes(slug);
}

export function countryName(locale: Locale, slug: CountrySlug): string {
  return new Intl.DisplayNames(locale === 'pt' ? 'pt-BR' : locale, { type: 'region' }).of(slug.toUpperCase()) ?? slug.toUpperCase();
}
