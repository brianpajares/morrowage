export const LOCALES = ['es', 'en', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** BCP-47 tag usado para Intl (números, fechas, moneda). No cambia valores canónicos del motor. */
export const INTL_TAG: Record<Locale, string> = {
  es: 'es',
  en: 'en-US',
  pt: 'pt-BR',
};
