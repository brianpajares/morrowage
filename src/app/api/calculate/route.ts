import { POLICIES } from '@/lib/security/ratelimit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import {
  ApiError,
  assertSameOrigin,
  clientContext,
  enforceRateLimit,
  handler,
  json,
  readJson,
  sessionCookie,
} from '@/server/http';
import { calculateService } from '@/server/services/calculate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.calculate, ctx.ipKey);

  const captcha = await verifyTurnstile(ctx.turnstileToken, ctx.ip);
  if (!captcha.ok) throw new ApiError(403, 'turnstile_failed');

  const body = await readJson(req);
  const result = await calculateService({
    body,
    sessionId: ctx.sessionId,
    psid: ctx.psid,
    deviceClass: ctx.deviceClass,
  });

  const { newSessionId, ...payload } = result;
  const maxAge = 24 * 60 * 60; // la sesión que liga cálculo ↔ lead dura 24 h
  return json(payload, {
    status: 200,
    cookies: newSessionId ? [sessionCookie(newSessionId, maxAge)] : [],
  });
});
