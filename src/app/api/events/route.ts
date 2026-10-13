import { sanitizeEvent } from '@/lib/analytics/events';
import { POLICIES } from '@/lib/security/ratelimit';
import { ingestEvent } from '@/server/analytics';
import { ApiError, assertSameOrigin, clientContext, enforceRateLimit, handler, readJson } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recolector first-party de analítica. Valida CADA evento contra la allowlist del spec
 * (FR-15, AT-25) antes de contar o reenviar. Responde 204 si el evento es válido; los inválidos
 * reciben 400 y no se registran.
 */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.events, ctx.ipKey);

  // sendBeacon envía un Blob application/json; el límite es pequeño a propósito.
  const body = await readJson(req, 2048);
  const parsed = sanitizeEvent(body);
  if (!parsed.ok) throw new ApiError(400, 'event_rejected', { reason: parsed.reason });

  await ingestEvent(parsed.event);
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
});
