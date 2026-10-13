'use client';

import { getPseudonymousSessionId } from '@/lib/analytics/client';

export interface ApiFailure {
  ok: false;
  status: number;
  code: string;
  fields?: Record<string, string>;
}
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

/** POST JSON a nuestra API con cookie de sesión, locale, pseudónimo de analítica y token de Turnstile. */
export async function postJson<T>(
  path: string,
  body: unknown,
  opts: { locale: string; turnstileToken?: string },
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-ma-locale': opts.locale,
        'x-ma-session': getPseudonymousSessionId(),
        ...(opts.turnstileToken ? { 'x-turnstile-token': opts.turnstileToken } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: typeof json.code === 'string' ? json.code : 'unknown',
        fields: (json.fields as Record<string, string> | undefined) ?? undefined,
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, code: 'network' };
  }
}
