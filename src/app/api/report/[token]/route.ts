import { POLICIES } from '@/lib/security/ratelimit';
import { ApiError, clientContext, enforceRateLimit, handler, json } from '@/server/http';
import { lookupReport } from '@/server/services/report';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/report/{token} — informe estructurado y seguro. 404 token inválido · 410 token expirado. */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.report, ctx.ipKey);
  const { token } = await params;

  const found = await lookupReport(getStore(), token);
  if (found.status === 'not_found') throw new ApiError(404, 'report_not_found');
  if (found.status === 'expired') throw new ApiError(410, 'token_expired');
  // Informe bloqueado (falta el pago): ni un solo dato del informe viaja al navegador.
  if (found.status === 'locked') throw new ApiError(402, 'payment_required');

  const { data } = found;
  return json({
    verificationId: data.verificationId,
    locale: data.locale,
    modelVersion: data.modelVersion,
    accessTier: data.accessTier,
    expiresAt: found.expiresAt,
    data,
  });
});
