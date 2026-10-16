import { getEnv } from '@/lib/env';
import { getDriveSnapshotStatus, getModelSnapshot } from '@/lib/drive/loader';
import { safeEqual } from '@/lib/security/tokens';
import { handler, json } from '@/server/http';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type KeyStatus = 'missing' | 'placeholder' | 'unexpected_format' | 'ok';

/** Estado de la clave de Resend SIN revelarla: missing | placeholder | unexpected_format | ok. */
function resendKeyStatus(raw: string | undefined): KeyStatus {
  const v = (raw ?? '').trim();
  if (!v) return 'missing';
  if (/REPLACE_ME|YOUR_[A-Z_]+/i.test(v)) return 'placeholder';
  return /^re_[A-Za-z0-9_]{8,}$/.test(v) ? 'ok' : 'unexpected_format';
}

/**
 * GET /api/health — estado para monitores y diagnóstico. Público: versión, estado de Drive/almacén y
 * un resumen SIN secretos de las integraciones (booleanos, estado de la clave de Resend, entorno de
 * PayPal y su client id —que es público—, rama y commit desplegados). Es lo que el dueño comparte en
 * una captura para diagnosticar (playbook de monetización §8). Con `Authorization: Bearer $CRON_SECRET`
 * se añaden además las capacidades detalladas.
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

  body.integrations = {
    email: env.capabilities.email,
    database: env.capabilities.supabase,
    paypal: env.capabilities.paypal,
    resend_api_key: resendKeyStatus(process.env.RESEND_API_KEY),
    email_from_domain: env.emailFrom?.split('@')[1]?.replace('>', '') ?? null,
    owner_email: Boolean(env.ownerEmail),
    deployment: process.env.VERCEL_ENV ?? 'local',
    build: { branch: process.env.VERCEL_GIT_COMMIT_REF ?? null, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null },
    cron: Boolean(env.cronSecret),
    turnstile: env.capabilities.turnstile,
  };
  body.payments = {
    enabled: env.paypalActive,
    mode: env.monetizationMode,
    env: env.paypal.env,
    client_id: env.paypal.clientId ?? null,
    live_blocked: env.paypal.liveBlocked,
    webhook_configured: Boolean(env.paypal.webhookId),
    price_usd: env.price.amountMinor / 100,
  };

  const auth = req.headers.get('authorization') ?? '';
  if (env.cronSecret && safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    body.capabilities = env.capabilities;
    body.monetization = { mode: env.monetizationMode, stripeActive: env.stripeActive, paypalActive: env.paypalActive };
    body.store = { ok: storeOk };
  }
  return json(body, { status: ok ? 200 : 503 });
});
