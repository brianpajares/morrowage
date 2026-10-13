/**
 * Allowlist central de analítica (FR-15, AT-25). Fuente: `spec/analytics_events.json`.
 * Reglas duras:
 *  - Solo nombres de evento y propiedades listados en el spec; cualquier otra cosa se rechaza.
 *  - Cada propiedad tiene un validador de valores acotados (enums/buckets), de modo que ni por error
 *    puede viajar un valor crudo de salud, un email, un token o texto libre.
 *  - Defensa en profundidad: claves y valores con forma de PII/health/token se rechazan aunque
 *    alguien las añada al spec.
 */
import spec from '@spec/analytics_events.json';
import { LOCALES } from '@/lib/locales';

export const EVENT_NAMES = spec.events.map((e) => e.name);
export type EventName = (typeof spec.events)[number]['name'];

const ALLOWED_PROPS = new Map<string, readonly string[]>(spec.events.map((e) => [e.name, e.properties]));
const COMMON = spec.common_properties as readonly string[];

export const STEP_IDS = ['age', 'sleep', 'srh', 'cigs', 'reaction', 'wthr', 'alcohol', 'rhr'] as const;
export const SECTION_IDS = ['summary', 'meaning', 'sensitivity', 'drivers', 'scenarios', 'plan', 'method', 'sources'] as const;

const BUCKETS = ['lt_5s', '5_15s', '15_30s', '30_60s', '60_90s', '90_180s', 'gte_180s'] as const;
export type TimeBucket = (typeof BUCKETS)[number];

export function bucketMs(ms: number): TimeBucket {
  const s = ms / 1000;
  if (s < 5) return 'lt_5s';
  if (s < 15) return '5_15s';
  if (s < 30) return '15_30s';
  if (s < 60) return '30_60s';
  if (s < 90) return '60_90s';
  if (s < 180) return '90_180s';
  return 'gte_180s';
}

export function bucketAttempts(n: number): '1' | '2' | '3' | '4_5' | '6_plus' {
  if (n <= 1) return '1';
  if (n === 2) return '2';
  if (n === 3) return '3';
  if (n <= 5) return '4_5';
  return '6_plus';
}

const oneOf = (values: readonly string[]) => (v: unknown) => typeof v === 'string' && values.includes(v);
const pattern = (re: RegExp) => (v: unknown) => typeof v === 'string' && re.test(v);

const PROP_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  referrer_group: oneOf(['direct', 'search', 'social', 'email', 'other']),
  direction_only: oneOf(['below', 'above']),
  step_id: oneOf(STEP_IDS),
  step_index: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 8,
  elapsed_ms_bucket: oneOf(BUCKETS),
  total_elapsed_ms_bucket: oneOf(BUCKETS),
  latency_bucket: oneOf(BUCKETS),
  error_code: pattern(/^[a-z][a-z0-9_]{0,39}$/),
  error_class: pattern(/^[a-z][a-z0-9_]{0,39}$/),
  protocol_version: pattern(/^[a-z0-9][a-z0-9._-]{0,19}$/),
  attempt_count_bucket: oneOf(['1', '2', '3', '4_5', '6_plus']),
  unit_system: oneOf(['metric', 'imperial']),
  unit_mode: oneOf(['us_drinks', 'uk_units', 'grams']),
  morrow_age_status: oneOf(['WITHIN_REFERENCE_RANGE', 'BELOW_REFERENCE_RANGE', 'ABOVE_REFERENCE_RANGE']),
  phase: oneOf(['validation', 'stripe']),
  origin_screen: pattern(/^[a-z][a-z_]{0,23}$/),
  source_id: pattern(/^S\d{2}$/),
  marketing_opt_in: (v) => typeof v === 'boolean',
  provider: oneOf(['resend', 'stripe']),
  price_id: pattern(/^price_[A-Za-z0-9]{4,64}$/),
  currency: pattern(/^[A-Z]{3}$/),
  gross_amount_minor: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 10_000_000,
  access_tier: oneOf(['validation_full', 'paid_full']),
  section_id: oneOf(SECTION_IDS),
};

const COMMON_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  event_id: pattern(/^[0-9a-f-]{36}$/i),
  session_id_pseudonymous: pattern(/^[0-9a-f-]{32,64}$/i),
  timestamp_utc: pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/),
  locale: oneOf(LOCALES),
  market_hint_coarse: (v) => v === null || (typeof v === 'string' && /^[A-Z]{2}$/.test(v)),
  model_version: pattern(/^\d+(\.\d+){0,2}$/),
  app_version: pattern(/^\d+(\.\d+){0,2}$/),
  device_class: oneOf(['mobile', 'tablet', 'desktop']),
  experiment_ids: (v) =>
    Array.isArray(v) && v.length <= 5 && v.every((x) => typeof x === 'string' && /^[a-z0-9_-]{1,40}$/i.test(x)),
};

/** Claves que NUNCA pueden viajar (aunque se añadieran al spec por error). */
const FORBIDDEN_KEY_RE =
  /(^|_)(email|mail|token|url|href|link|age_years|sleep|health|srh|cigarette|cigs|reaction_time|waist|wthr|alcohol|resting|rhr|raw|morrow_age|delta|hazard|driver|contribution|password|name|text|message|free)(_|$)/i;
const EMAIL_VALUE_RE = /@/;
const TOKEN_VALUE_RE = /[A-Za-z0-9_-]{32,}/;

export interface AnalyticsEvent {
  name: EventName;
  /** Propiedades comunes + específicas ya validadas. */
  props: Record<string, unknown>;
}

export type SanitizeResult =
  | { ok: true; event: AnalyticsEvent }
  | { ok: false; reason: 'unknown_event' | 'unknown_property' | 'invalid_value' | 'forbidden_property' | 'malformed' };

function scalarLooksSensitive(v: unknown): boolean {
  if (typeof v === 'string') return EMAIL_VALUE_RE.test(v) || (TOKEN_VALUE_RE.test(v) && !/^[0-9a-f-]{32,64}$/i.test(v));
  return false;
}

export function sanitizeEvent(input: unknown): SanitizeResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return { ok: false, reason: 'malformed' };
  const { name, props } = input as { name?: unknown; props?: unknown };
  if (typeof name !== 'string' || !ALLOWED_PROPS.has(name)) return { ok: false, reason: 'unknown_event' };
  if (props === null || typeof props !== 'object' || Array.isArray(props)) return { ok: false, reason: 'malformed' };

  const specific = ALLOWED_PROPS.get(name) ?? [];
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    const isCommon = COMMON.includes(key);
    const isSpecific = specific.includes(key);
    if (!isCommon && !isSpecific) {
      return { ok: false, reason: FORBIDDEN_KEY_RE.test(key) ? 'forbidden_property' : 'unknown_property' };
    }
    if (FORBIDDEN_KEY_RE.test(key) && !isCommon && !(key in PROP_VALIDATORS)) {
      return { ok: false, reason: 'forbidden_property' };
    }
    const validator = isCommon ? COMMON_VALIDATORS[key] : PROP_VALIDATORS[key];
    if (!validator || !validator(value)) return { ok: false, reason: 'invalid_value' };
    if (scalarLooksSensitive(value) && key !== 'event_id' && key !== 'session_id_pseudonymous') {
      return { ok: false, reason: 'invalid_value' };
    }
    clean[key] = value;
  }
  return { ok: true, event: { name: name as EventName, props: clean } };
}

/** Eventos que se cuentan como paso de funnel agregado en /admin. */
export const FUNNEL_EVENTS: readonly string[] = Array.from(
  new Set(Object.values(spec.funnel_definitions).flat()),
);
