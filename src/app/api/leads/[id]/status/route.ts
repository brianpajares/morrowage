import { getEnv } from '@/lib/env';
import { POLICIES } from '@/lib/security/ratelimit';
import { hashSession, safeEqual } from '@/lib/security/tokens';
import { ApiError, clientContext, enforceRateLimit, handler, json } from '@/server/http';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/leads/{id}/status — estado de la entrega del correo para la pantalla de éxito.
 * Solo lo puede consultar el navegador que creó el cálculo (cookie HttpOnly → hash de sesión).
 * Devuelve únicamente el estado y, si falló, una clase de error corta sin PII (`ref`), p. ej.
 * `resend_403_validation_error`: con una captura se diagnostica sin abrir logs.
 */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.report, ctx.ipKey);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'lead_not_found');

  const store = getStore();
  const lead = await store.getLead(id);
  const calc = lead ? await store.getCalculation(lead.calculation_id) : null;
  if (!lead || !calc) throw new ApiError(404, 'lead_not_found');
  if (!ctx.sessionId || !safeEqual(hashSession(ctx.sessionId, getEnv().sessionPepper), calc.session_hash)) {
    throw new ApiError(404, 'lead_not_found');
  }

  return json({
    status: lead.status,
    ref: lead.status === 'failed' ? (lead.delivery_error_class ?? 'unknown') : null,
  });
});
