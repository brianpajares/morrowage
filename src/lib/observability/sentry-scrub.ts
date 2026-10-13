/**
 * Scrubbing de eventos de Sentry (NFR-09, AT-23, AT-32): nunca viajan cuerpos de petición, cookies,
 * cabeceras, query strings, email, tokens ni datos de salud. Funciones puras y testeadas.
 */
import { redactDeep, redactString, sanitizeUrl } from './scrub';

interface LooseEvent {
  request?: { url?: string; headers?: unknown; cookies?: unknown; data?: unknown; query_string?: unknown; env?: unknown };
  user?: unknown;
  extra?: unknown;
  contexts?: Record<string, unknown>;
  breadcrumbs?: Array<{ message?: string; data?: unknown; category?: string }>;
  exception?: { values?: Array<{ value?: string }> };
  message?: string;
  transaction?: string;
  tags?: Record<string, unknown>;
  server_name?: string;
}

export function scrubSentryEvent<T extends LooseEvent>(event: T): T {
  const e = event as LooseEvent;
  if (e.request) {
    e.request = { url: e.request.url ? sanitizeUrl(e.request.url) : undefined };
  }
  delete e.user;
  delete e.server_name;
  if (e.extra) e.extra = redactDeep(e.extra) as typeof e.extra;
  if (e.contexts) e.contexts = redactDeep(e.contexts) as typeof e.contexts;
  if (e.tags) e.tags = redactDeep(e.tags) as typeof e.tags;
  if (e.message) e.message = redactString(e.message);
  if (e.transaction) e.transaction = redactString(e.transaction);
  if (e.exception?.values) {
    for (const v of e.exception.values) if (v.value) v.value = redactString(v.value);
  }
  if (e.breadcrumbs) {
    e.breadcrumbs = e.breadcrumbs.map((b) => ({
      category: b.category,
      message: b.message ? redactString(b.message) : undefined,
      data: undefined,
    }));
  }
  return event;
}
