import { POLICIES } from '@/lib/security/ratelimit';
import { clientContext, enforceRateLimit, handler, json } from '@/server/http';
import { funnel, requireAdmin } from '@/server/services/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/funnel — métricas agregadas del funnel (sin PII ni datos de salud). */
export const GET = handler(async (req: Request) => {
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.admin, ctx.ipKey);
  await requireAdmin(req);
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get('days') ?? '14') || 14));
  return json(await funnel(days));
});
