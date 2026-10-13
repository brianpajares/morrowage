import { z } from 'zod';
import { POLICIES } from '@/lib/security/ratelimit';
import { ApiError, assertSameOrigin, clientContext, enforceRateLimit, handler, json } from '@/server/http';
import { requireAdmin, resolveDeletion } from '@/server/services/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/deletion/{id} — ejecuta el borrado solicitado (respeta retención legal de pedidos). */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.admin, ctx.ipKey);
  const admin = await requireAdmin(req);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(400, 'invalid_id');
  const row = await resolveDeletion(admin, id);
  return json({ id: row.id, status: row.status, resolvedAt: row.resolved_at });
});
