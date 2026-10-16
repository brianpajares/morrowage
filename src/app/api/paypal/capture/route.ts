import { after } from 'next/server';
import { POLICIES } from '@/lib/security/ratelimit';
import { assertSameOrigin, clientContext, enforceRateLimit, handler, json, readJson } from '@/server/http';
import { capturePaypalOrderService } from '@/server/services/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/paypal/capture — captura en el SERVIDOR tras la aprobación del comprador y valida todo
 * (orden, custom_id, COMPLETED, importe, moneda, merchant) antes de marcar pagado. La entrega
 * (PDF + avisos) corre tras la respuesta.
 */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.checkout, ctx.ipKey);
  const result = await capturePaypalOrderService({ body: await readJson(req), schedule: (task) => after(task) });
  return json(result);
});
