import { ApiError, handler, json } from '@/server/http';
import { isCronAuthorized } from '@/server/services/admin';
import { cleanupJob } from '@/server/services/cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET /api/cron/cleanup — Vercel Cron envía `Authorization: Bearer $CRON_SECRET`. */
export const GET = handler(async (req: Request) => {
  if (!isCronAuthorized(req)) throw new ApiError(401, 'unauthorized');
  return json(await cleanupJob());
});
