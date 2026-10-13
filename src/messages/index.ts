import type { Locale } from '@/lib/locales';
import { canonicalMessages, type CanonicalMessages } from './canonical';
import { emailsEn } from './extra/emails.en';
import { emailsEs } from './extra/emails.es';
import { emailsPt } from './extra/emails.pt';
import { flowEn } from './extra/flow.en';
import { flowEs } from './extra/flow.es';
import { flowPt } from './extra/flow.pt';
import { legalEn } from './extra/legal.en';
import { legalEs } from './extra/legal.es';
import { legalPt } from './extra/legal.pt';
import { reportEn } from './extra/report.en';
import { reportEs } from './extra/report.es';
import { reportPt } from './extra/report.pt';
import { seoEn } from './extra/seo.en';
import { seoEs } from './extra/seo.es';
import { seoPt } from './extra/seo.pt';
import { siteEn } from './extra/site.en';
import { siteEs } from './extra/site.es';
import { sitePt } from './extra/site.pt';
import { deepMerge, type Shape } from './util';

type Extra = Shape<typeof siteEs> & Shape<typeof flowEs> & Shape<typeof emailsEs> & Shape<typeof reportEs> & Shape<typeof legalEs> & Shape<typeof seoEs>;

export type Messages = CanonicalMessages & Extra;

const extras: Record<Locale, Extra> = {
  es: { ...siteEs, ...flowEs, ...emailsEs, ...reportEs, ...legalEs, ...seoEs } as unknown as Extra,
  en: { ...siteEn, ...flowEn, ...emailsEn, ...reportEn, ...legalEn, ...seoEn },
  pt: { ...sitePt, ...flowPt, ...emailsPt, ...reportPt, ...legalPt, ...seoPt },
};

const cache = new Map<Locale, Messages>();

/** Mensajes completos de un idioma = copy canónico (spec) + extensiones tipadas con paridad ES/EN/PT. */
export function getMessages(locale: Locale): Messages {
  let m = cache.get(locale);
  if (!m) {
    m = deepMerge(canonicalMessages(locale) as unknown as Record<string, unknown>, extras[locale] as unknown as Record<string, unknown>) as unknown as Messages;
    cache.set(locale, m);
  }
  return m;
}

export type { CanonicalMessages };
