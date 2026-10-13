/**
 * Ingesta server-side de analítica (FR-15, AT-25, AT-32).
 *  - Valida SIEMPRE contra la allowlist del spec (client-supplied o server-originated).
 *  - Agrega contadores diarios sin PII (alimentan /admin) y reenvía a PostHog desde el servidor.
 *  - Nunca registra ni reenvía email, inputs, resultado crudo, drivers, token ni URL de informe.
 */
import { randomUUID } from 'node:crypto';
import { getEnv } from '@/lib/env';
import { log } from '@/lib/log';
import { sanitizeEvent, type AnalyticsEvent, type EventName } from '@/lib/analytics/events';
import type { Locale } from '@/lib/locales';
import { getStore } from '@/server/store';

const DIM_KEYS = [
  'step_id',
  'morrow_age_status',
  'total_elapsed_ms_bucket',
  'elapsed_ms_bucket',
  'latency_bucket',
  'error_code',
  'error_class',
  'phase',
  'access_tier',
  'section_id',
  'source_id',
  'origin_screen',
  'unit_system',
  'unit_mode',
  'direction_only',
  'referrer_group',
  'marketing_opt_in',
  'protocol_version',
  'attempt_count_bucket',
  'provider',
  'currency',
] as const;

export function dimFor(event: AnalyticsEvent): string {
  for (const k of DIM_KEYS) {
    const v = event.props[k];
    if (v !== undefined && v !== null) return String(v).slice(0, 64);
  }
  return '';
}

export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

async function forwardToPostHog(event: AnalyticsEvent): Promise<void> {
  const { key, host } = getEnv().posthog;
  if (!key) return;
  const props = event.props;
  try {
    await fetch(`${host.replace(/\/+$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event: event.name,
        distinct_id: props.session_id_pseudonymous,
        timestamp: props.timestamp_utc,
        properties: { ...props, $process_person_profile: false, $geoip_disable: true, $lib: 'morrowage-server' },
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    log.warn('posthog_forward_failed');
  }
}

/** Procesa un evento ya validado: contadores + PostHog. Los fallos jamás rompen la petición. */
export async function ingestEvent(event: AnalyticsEvent): Promise<void> {
  const locale = event.props.locale as Locale;
  try {
    await getStore().incrementCounter(utcDay(), locale, event.name, dimFor(event));
  } catch {
    log.warn('counter_increment_failed', { event: event.name });
  }
  await forwardToPostHog(event);
}

export interface ServerEventContext {
  locale: Locale;
  psid?: string;
  /** Pseudónimo de respaldo (p. ej. prefijo del hash de sesión) si el cliente no envió psid. */
  fallbackSessionId?: string;
  market?: string | null;
  deviceClass?: 'mobile' | 'tablet' | 'desktop';
}

/** Emite un evento originado en el servidor (calculation_*, email_submit, report_delivery_*, purchase_*…). */
export async function trackServer(
  name: EventName,
  props: Record<string, string | number | boolean>,
  ctx: ServerEventContext,
): Promise<void> {
  const env = getEnv();
  const sid = ctx.psid ?? (ctx.fallbackSessionId ? ctx.fallbackSessionId.slice(0, 32) : undefined) ?? randomUUID().replace(/-/g, '');
  const parsed = sanitizeEvent({
    name,
    props: {
      event_id: randomUUID(),
      session_id_pseudonymous: sid,
      timestamp_utc: new Date().toISOString(),
      locale: ctx.locale,
      market_hint_coarse: ctx.market ?? null,
      model_version: env.modelVersion,
      app_version: env.appVersion,
      device_class: ctx.deviceClass ?? 'desktop',
      experiment_ids: [],
      ...props,
    },
  });
  if (!parsed.ok) {
    // Un evento del servidor fuera del contrato es un bug: se registra la causa (sin valores).
    log.error('server_event_rejected', { event: name, reason: parsed.reason });
    if (env.appEnv === 'test') throw new Error(`analytics_rejected:${name}:${parsed.reason}`);
    return;
  }
  await ingestEvent(parsed.event);
}
