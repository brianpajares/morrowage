/**
 * Copy canónico (`spec/copy_i18n.json`), aprobado por QA/UX. Es la fuente de verdad del microcopy:
 * aquí solo se "localiza" (se elige es/en/pt por hoja); nunca se reescribe.
 */
import copy from '@spec/copy_i18n.json';
import type { Locale } from '@/lib/locales';

type CopyRoot = Omit<typeof copy, 'meta'>;

export type Localized<T> = T extends { es: infer S; en: unknown; pt: unknown }
  ? S
  : T extends object
    ? { [K in keyof T]: Localized<T[K]> }
    : T;

export type CanonicalMessages = Localized<CopyRoot>;

function isLeaf(node: unknown): node is Record<Locale, unknown> {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return false;
  const keys = Object.keys(node);
  return keys.length === 3 && keys.includes('es') && keys.includes('en') && keys.includes('pt');
}

function localize(node: unknown, locale: Locale): unknown {
  if (isLeaf(node)) return node[locale];
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, localize(v, locale)]));
  }
  return node;
}

export function canonicalMessages(locale: Locale): CanonicalMessages {
  const { meta: _meta, ...rest } = copy;
  return localize(rest, locale) as CanonicalMessages;
}
