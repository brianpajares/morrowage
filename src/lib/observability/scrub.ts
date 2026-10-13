/**
 * Redacción de PII / datos de salud / tokens para logs, Sentry y cualquier telemetría.
 * Un único módulo para que logs (AT-32), Sentry (AT-23) y analítica compartan reglas.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
/** Tokens opacos (base64url ≥ 32 chars) incluidos los del path /report/<token>. */
const TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g;
const REPORT_PATH_RE = /(\/report\/)[^/?#\s]+/gi;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

/** Claves cuyo valor jamás debe salir del proceso. */
const SENSITIVE_KEYS = new Set([
  'email',
  'to',
  'from',
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'report_token',
  'reporturl',
  'report_url',
  'x-turnstile-token',
  'stripe-signature',
  'input_payload',
  'output_payload',
  'inputs',
  'input',
  'output',
  'body',
  'data',
  'morrow_age',
  'morrowage',
  'delta_age',
  'eta_nonage',
  'delta_lp',
  'relative_hazard',
  'drivers',
  'top_driver',
  'measurement_sensitivity',
  'age_years',
  'sleep_hours',
  'self_rated_health',
  'cigarettes_per_day',
  'reaction_time_ms',
  'waist_to_height_ratio',
  'alcohol_units_week',
  'resting_hr_bpm',
  'service_role_key',
  'apikey',
  'api_key',
  'private_key',
  'secret',
]);

export const REDACTED = '[redacted]';

export function redactString(value: string): string {
  return value
    .replace(REPORT_PATH_RE, '$1[token]')
    .replace(BEARER_RE, 'Bearer [token]')
    .replace(JWT_RE, '[jwt]')
    .replace(EMAIL_RE, '[email]')
    .replace(TOKEN_RE, '[token]');
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

export function redactDeep(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return undefined;
  if (depth > 6) return '[depth]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactDeep(v, depth + 1, seen));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? REDACTED : redactDeep(v, depth + 1, seen);
  }
  return out;
}

/** Quita query/fragmento de una URL: los tokens y datos nunca viajan en querystring, pero se descarta igual. */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url, 'http://placeholder.invalid');
    const path = redactString(u.pathname);
    return url.startsWith('http') ? `${u.origin}${path}` : path;
  } catch {
    return redactString(url.split(/[?#]/)[0] ?? '');
  }
}
