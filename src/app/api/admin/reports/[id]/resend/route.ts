import { after } from 'next/server';
import { z } from 'zod';
import { POLICIES } from '@/lib/security/ratelimit';
import { ApiError, assertSameOrigin, clientContext, enforceRateLimit, handler, json } from '@/server/http';
import { requireAdmin, resendReport } from '@/server/services/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/admin/reports/{id}/resend — rota el token y reproduce el correo de entrega. */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.admin, ctx.ipKey);
  const admin = await requireAdmin(req);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(400, 'invalid_id');
  const res = await resendReport(admin, id, { schedule: (task) => after(task) });
  return json(res, { status: 202 });
});
