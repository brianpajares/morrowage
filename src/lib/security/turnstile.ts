/**
 * Cloudflare Turnstile (FR-23, AT-26).
 *  - Con TURNSTILE_SECRET_KEY: verificación obligatoria contra siteverify.
 *  - APP_ENV=test: token mock explícito `test-turnstile-pass` (jamás aceptado fuera de test).
 *  - Sin clave en desarrollo/producción: se omite SOLO el captcha (rate limit sigue activo) y
 *    /api/health expone `capabilities.turnstile=false` para que el operador lo vea.
 */
import { getEnv } from '@/lib/env';

export const TEST_TURNSTILE_TOKEN = 'test-turnstile-pass';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileOutcome =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: 'missing_token' | 'rejected' | 'unavailable' };

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string,
  fetchFn: typeof fetch = fetch,
): Promise<TurnstileOutcome> {
  const env = getEnv();

  if (env.appEnv === 'test') {
    if (token === TEST_TURNSTILE_TOKEN) return { ok: true, skipped: false };
    if (!env.turnstile.secretKey) return { ok: true, skipped: true };
  }

  const secret = env.turnstile.secretKey;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: 'missing_token' };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp);
    const res = await fetchFn(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    const json = (await res.json()) as { success?: boolean };
    return json.success === true ? { ok: true, skipped: false } : { ok: false, reason: 'rejected' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
