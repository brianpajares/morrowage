import { after } from 'next/server';
import { POLICIES } from '@/lib/security/ratelimit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { ApiError, assertSameOrigin, clientContext, enforceRateLimit, handler, json, readJson } from '@/server/http';
import { createDeletionRequestService } from '@/server/services/privacy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.deleteRequest, ctx.ipKey);
  const captcha = await verifyTurnstile(ctx.turnstileToken, ctx.ip);
  if (!captcha.ok) throw new ApiError(403, 'turnstile_failed');

  const result = await createDeletionRequestService(await readJson(req), { schedule: (task) => after(task) });
  return json(result, { status: 202 });
});
