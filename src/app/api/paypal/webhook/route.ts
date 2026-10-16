import { after } from 'next/server';
import { ApiError, handler, json } from '@/server/http';
import { handlePaypalWebhook } from '@/server/services/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 256 * 1024;

/**
 * POST /api/paypal/webhook — verifica la firma con la API oficial de PayPal (PAYPAL_WEBHOOK_ID), es
 * idempotente por event id y responde 500 si el procesamiento falla (PayPal reintenta). Firma falsa → 401.
 * Respaldo de la captura del navegador: entrega aunque el comprador cierre la pestaña.
 */
export const POST = handler(async (req: Request) => {
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new ApiError(413, 'payload_too_large');
  const result = await handlePaypalWebhook(raw, req.headers, { schedule: (task) => after(task) });
  return json({ received: true, duplicate: result.duplicate });
});
