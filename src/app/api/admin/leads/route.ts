import { z } from 'zod';
import { POLICIES } from '@/lib/security/ratelimit';
import { ApiError, clientContext, enforceRateLimit, handler, json } from '@/server/http';
import { listLeads, requireAdmin } from '@/server/services/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.enum(['requested', 'delivered', 'failed', 'paid']).optional(),
  cursor: z.string().max(100).optional(),
});

/** GET /api/admin/leads — leads sin payload de salud, resultado crudo ni token/URL. 401 / 403 según sesión. */
export const GET = handler(async (req: Request) => {
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.admin, ctx.ipKey);
  await requireAdmin(req);

  const sp = new URL(req.url).searchParams;
  const q = querySchema.safeParse({ status: sp.get('status') ?? undefined, cursor: sp.get('cursor') ?? undefined });
  if (!q.success) throw new ApiError(400, 'invalid_query');
  try {
    return json(await listLeads(q.data));
  } catch (err) {
    if (err instanceof Error && err.message === 'invalid_cursor') throw new ApiError(400, 'invalid_query');
    throw err;
  }
});
