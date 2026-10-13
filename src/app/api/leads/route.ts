import { after } from 'next/server';
import { POLICIES } from '@/lib/security/ratelimit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { ApiError, assertSameOrigin, clientContext, enforceRateLimit, handler, json, readJson } from '@/server/http';
import { createLeadService } from '@/server/services/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.leads, ctx.ipKey);

  const captcha = await verifyTurnstile(ctx.turnstileToken, ctx.ip);
  if (!captcha.ok) throw new ApiError(403, 'turnstile_failed');

  const result = await createLeadService(
    { body: await readJson(req), sessionId: ctx.sessionId, psid: ctx.psid, deviceClass: ctx.deviceClass },
    // La entrega (PDF + 2 emails) corre tras la respuesta: mantiene el p95 interactivo < 2 s.
    { schedule: (task) => after(task) },
  );
  return json(result, { status: 201 });
});
