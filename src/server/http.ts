/**
 * Utilidades HTTP de los route handlers: errores tipados, lectura acotada de JSON, chequeo de
 * origen (CSRF), cookies de sesión y contexto del cliente. Sin dependencias de Next para poder
 * probarlas con `Request` estándar.
 */
import { getEnv } from '@/lib/env';
import { clientIp, rateLimit, type RateLimitPolicy } from '@/lib/security/ratelimit';
import { hashForKey } from '@/lib/security/tokens';
import { isLocale, type Locale } from '@/lib/locales';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra?: Record<string, unknown>,
    readonly retryAfter?: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export function json(body: unknown, init: ResponseInit & { cookies?: string[] } = {}): Response {
  const { cookies, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, max-age=0');
  for (const c of cookies ?? []) headers.append('set-cookie', c);
  return new Response(JSON.stringify(body), { ...rest, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    const headers = new Headers();
    if (err.retryAfter) headers.set('retry-after', String(err.retryAfter));
    return json({ error: err.code, code: err.code, ...(err.extra ?? {}) }, { status: err.status, headers });
  }
  return json({ error: 'internal_error', code: 'internal_error' }, { status: 500 });
}

/** Lee JSON con límite de tamaño y content-type estricto. */
export async function readJson(req: Request, maxBytes = 8 * 1024): Promise<unknown> {
  const ct = req.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(ct)) throw new ApiError(415, 'unsupported_media_type');
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new ApiError(413, 'payload_too_large');
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new ApiError(413, 'payload_too_large');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, 'invalid_json');
  }
}

/**
 * Protección CSRF para endpoints con efectos que usan cookies: si el navegador envía `Origin`,
 * debe coincidir con el host de la app. Peticiones sin Origin (curl, server-to-server) se aceptan:
 * el control de abuso real son Turnstile + rate limit + sesión ligada a cookie.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(getEnv().appUrl).host);
  } catch {
    /* appUrl inválida: se valida abajo con el host de la petición */
  }
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) allowed.add(host);
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'bad_origin');
  }
  if (!allowed.has(originHost)) throw new ApiError(403, 'bad_origin');
}

export const SESSION_COOKIE = 'ma_sid';

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(value: string, maxAgeSeconds: number): string {
  const secure = getEnv().appUrl.startsWith('https://') ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

export function deviceClassFromUa(ua: string | null): 'mobile' | 'tablet' | 'desktop' {
  if (!ua) return 'desktop';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export interface ClientContext {
  ip: string;
  ipKey: string;
  sessionId: string | undefined;
  psid: string | undefined;
  locale: Locale | undefined;
  deviceClass: 'mobile' | 'tablet' | 'desktop';
  turnstileToken: string | null;
}

export function clientContext(req: Request): ClientContext {
  const env = getEnv();
  const ip = clientIp(req.headers);
  const cookies = parseCookies(req.headers.get('cookie'));
  const psidRaw = req.headers.get('x-ma-session');
  const lang = req.headers.get('x-ma-locale');
  return {
    ip,
    ipKey: hashForKey(ip, env.sessionPepper),
    sessionId: cookies[SESSION_COOKIE],
    psid: psidRaw && /^[0-9a-f]{32}$/.test(psidRaw) ? psidRaw : undefined,
    locale: isLocale(lang) ? lang : undefined,
    deviceClass: deviceClassFromUa(req.headers.get('user-agent')),
    turnstileToken: req.headers.get('x-turnstile-token'),
  };
}

export async function enforceRateLimit(policy: RateLimitPolicy, key: string): Promise<void> {
  const res = await rateLimit(policy, key);
  if (!res.allowed) throw new ApiError(429, 'rate_limited', undefined, res.retryAfterSeconds);
}

/** Envuelve un handler: cualquier error se convierte en JSON seguro, sin trazas ni mensajes crudos. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      const { log } = await import('@/lib/log');
      const { reportError } = await import('@/lib/observability/report-error');
      const name = err instanceof Error ? err.name : 'unknown';
      log.error('unhandled_api_error', { errorName: name });
      reportError('unhandled_api_error', { errorName: name }, { component: 'api' });
      const { StoreUnavailableError } = await import('@/server/store');
      const { DriveUnavailableError } = await import('@/lib/drive/loader');
      if (err instanceof StoreUnavailableError || err instanceof DriveUnavailableError) {
        return json({ error: 'service_unavailable', code: 'service_unavailable' }, { status: 503 });
      }
      return errorResponse(err);
    }
  };
}
