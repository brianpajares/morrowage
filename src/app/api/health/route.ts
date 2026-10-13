import { getEnv } from '@/lib/env';
import { getDriveSnapshotStatus, getModelSnapshot } from '@/lib/drive/loader';
import { safeEqual } from '@/lib/security/tokens';
import { handler, json } from '@/server/http';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — estado básico para monitores. La vista pública solo contiene lo mínimo del
 * OpenAPI. Con `Authorization: Bearer $CRON_SECRET` el operador recibe además las capacidades
 * configuradas (booleanos, nunca valores).
 */
export const GET = handler(async (req: Request) => {
  const env = getEnv();
  let driveSnapshotStatus = getDriveSnapshotStatus();
  try {
    await getModelSnapshot();
    driveSnapshotStatus = getDriveSnapshotStatus();
  } catch {
    driveSnapshotStatus = 'unavailable';
  }

  let storeOk = false;
  try {
    storeOk = await getStore().ping();
  } catch {
    storeOk = false;
  }

  const ok = driveSnapshotStatus !== 'unavailable' && storeOk;
  const body: Record<string, unknown> = {
    ok,
    appVersion: env.appVersion,
    modelVersion: env.modelVersion,
    driveSnapshotStatus,
  };

  const auth = req.headers.get('authorization') ?? '';
  if (env.cronSecret && safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    body.capabilities = env.capabilities;
    body.monetization = { mode: env.monetizationMode, stripeActive: env.stripeActive };
    body.store = { ok: storeOk };
  }
  return json(body, { status: ok ? 200 : 503 });
});
