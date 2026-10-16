/**
 * Formato del precio del informe (solo presentación; el importe real vive en el servidor:
 * `getEnv().price`, nunca viene del navegador).
 */
import { INTL_TAG, type Locale } from '@/lib/locales';

/** 1900 → «US$19»; 1950 → «US$19.50» / «US$19,50» según idioma. */
export function formatUsd(amountMinor: number, locale: Locale): string {
  const whole = amountMinor % 100 === 0;
  const n = new Intl.NumberFormat(INTL_TAG[locale], { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(amountMinor / 100);
  return `US$${n}`;
}
