import { POLICIES } from '@/lib/security/ratelimit';
import { assertSameOrigin, clientContext, enforceRateLimit, handler, json, readJson } from '@/server/http';
import { createPaypalOrderService } from '@/server/services/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/paypal/create-order — crea la orden de PayPal. El precio y la moneda salen SOLO del
 * servidor; la autorización es el token de desbloqueo (llegó únicamente al correo del cliente).
 * 404 si los pagos no están activos.
 */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.checkout, ctx.ipKey);
  const result = await createPaypalOrderService({ body: await readJson(req) });
  return json(result, { status: 201 });
});
