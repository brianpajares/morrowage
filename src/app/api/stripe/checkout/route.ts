import { POLICIES } from '@/lib/security/ratelimit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { ApiError, assertSameOrigin, clientContext, enforceRateLimit, handler, json, readJson } from '@/server/http';
import { createCheckoutService } from '@/server/services/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/stripe/checkout — solo con MONETIZATION_MODE=stripe y STRIPE_ENABLED=true (404 si no). */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.checkout, ctx.ipKey);
  const captcha = await verifyTurnstile(ctx.turnstileToken, ctx.ip);
  if (!captcha.ok) throw new ApiError(403, 'turnstile_failed');
  const result = await createCheckoutService({ body: await readJson(req), sessionId: ctx.sessionId, psid: ctx.psid });
  return json(result, { status: 201 });
});
