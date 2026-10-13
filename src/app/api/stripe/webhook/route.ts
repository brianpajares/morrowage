import { after } from 'next/server';
import { handler, json } from '@/server/http';
import { handleStripeWebhook } from '@/server/services/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/stripe/webhook — verifica la firma sobre el cuerpo RAW (no `req.json()`), es idempotente por
 * event.id y entrega el PDF tras el pago confirmado. Firma inválida → 400.
 */
export const POST = handler(async (req: Request) => {
  const raw = await req.text();
  const result = await handleStripeWebhook(raw, req.headers.get('stripe-signature'), { schedule: (task) => after(task) });
  return json({ received: true, duplicate: result.duplicate });
});
