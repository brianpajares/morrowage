/**
 * Stripe detrás de feature flag (FR-20, FR-21, AT-18, AT-19): solo opera con
 * MONETIZATION_MODE=stripe Y STRIPE_ENABLED=true. Checkout one-time, webhook con firma sobre el
 * cuerpo RAW e idempotencia por event.id (+ estado del pedido + restricciones UNIQUE).
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { emailSchema } from '@/lib/validation';
import type Stripe from 'stripe';
import { getEnv } from '@/lib/env';
import { LOCALES, type Locale } from '@/lib/locales';
import { hashSession, safeEqual } from '@/lib/security/tokens';
import { log } from '@/lib/log';
import { reportError } from '@/lib/observability/report-error';
import { trackServer } from '@/server/analytics';
import { ApiError } from '@/server/http';
import { getStore } from '@/server/store';
import type { OrderRow } from '@/server/store/types';
import { deliverReport } from './delivery';
import { issueReport, rotateReportToken } from './report';

let client: Stripe | undefined;
let clientKey = '';

export async function getStripe(): Promise<Stripe> {
  const key = getEnv().stripe.secretKey;
  if (!key) throw new ApiError(503, 'stripe_not_configured');
  if (!client || clientKey !== key) {
    const { default: StripeCtor } = await import('stripe');
    client = new StripeCtor(key, { maxNetworkRetries: 2, timeout: 10_000, appInfo: { name: 'MorrowAge', version: getEnv().appVersion } });
    clientKey = key;
  }
  return client;
}

/** Solo tests: inyecta un cliente falso. */
export function setStripeForTests(c: Stripe | undefined): void {
  client = c;
  clientKey = c ? (getEnv().stripe.secretKey ?? '') : '';
}

function assertStripeActive(): void {
  const env = getEnv();
  if (!env.stripeActive) throw new ApiError(404, 'stripe_disabled');
  if (!env.capabilities.stripe) throw new ApiError(503, 'stripe_not_configured');
}

const checkoutSchema = z.strictObject({
  calculationId: z.uuid(),
  email: emailSchema,
  locale: z.enum(LOCALES),
  priceId: z.string().min(1).max(100),
  serviceConsent: z.literal(true).optional(),
});

const STRIPE_LOCALE: Record<Locale, Stripe.Checkout.SessionCreateParams.Locale> = { es: 'es', en: 'en', pt: 'pt' };

export async function createCheckoutService(opts: { body: unknown; sessionId?: string; psid?: string }): Promise<{ checkoutUrl: string }> {
  assertStripeActive();
  const env = getEnv();
  const parsed = checkoutSchema.safeParse(opts.body);
  if (!parsed.success) throw new ApiError(400, 'invalid_request');
  const b = parsed.data;
  // Solo se vende el precio configurado (AT-18: "price permitido").
  if (!safeEqual(b.priceId, env.stripe.priceId ?? '')) throw new ApiError(400, 'price_not_allowed');

  const store = getStore();
  const calc = await store.getCalculation(b.calculationId);
  if (!calc || new Date(calc.expires_at) <= new Date()) throw new ApiError(404, 'calculation_not_found');
  if (!opts.sessionId || !safeEqual(hashSession(opts.sessionId, env.sessionPepper), calc.session_hash)) {
    throw new ApiError(403, 'session_mismatch');
  }

  const stripe = await getStripe();
  const price = await stripe.prices.retrieve(b.priceId);
  if (!price.active || price.unit_amount === null) throw new ApiError(400, 'price_not_allowed');

  const now = new Date().toISOString();
  const lead =
    (await store.findLeadByCalculation(calc.id)) ??
    (await store.insertLead({ calculation_id: calc.id, email: b.email, locale: b.locale, service_consent_at: now, marketing_opt_in: false, marketing_consent_at: null, subscription_waitlist_opt_in: false }));
  if (lead.email !== b.email) throw new ApiError(409, 'calculation_already_requested');

  const order = await store.insertOrder({ calculation_id: calc.id, lead_id: lead.id, amount_minor: price.unit_amount, currency: price.currency });
  const ctx = { locale: b.locale, psid: opts.psid, fallbackSessionId: calc.session_hash, market: calc.market_hint_coarse };

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: b.priceId, quantity: 1 }],
    customer_email: b.email,
    client_reference_id: order.id,
    locale: STRIPE_LOCALE[b.locale],
    metadata: { order_id: order.id },
    payment_intent_data: { metadata: { order_id: order.id } },
    success_url: `${env.appUrl}/${b.locale}/success?paid=1`,
    cancel_url: `${env.appUrl}/${b.locale}/preview/${calc.id}`,
  });
  if (!session.url) throw new ApiError(502, 'checkout_unavailable');
  await store.updateOrder(order.id, { stripe_checkout_session_id: session.id });

  await trackServer('checkout_start', { price_id: b.priceId, currency: price.currency.toUpperCase() }, ctx);
  return { checkoutUrl: session.url };
}

export type WebhookResult = { handled: boolean; duplicate: boolean };

export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  deps: { schedule: (task: () => Promise<unknown>) => void },
): Promise<WebhookResult> {
  assertStripeActive();
  const env = getEnv();
  if (!signature) throw new ApiError(400, 'invalid_signature');

  const stripe = await getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret!);
  } catch {
    throw new ApiError(400, 'invalid_signature');
  }

  const store = getStore();
  const sha = createHash('sha256').update(rawBody).digest('hex');
  if ((await store.claimWebhookEvent(event.id, event.type, sha)) === 'duplicate') {
    return { handled: false, duplicate: true };
  }

  try {
    let handled = true;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.payment_status === 'paid') await fulfill(session, deps);
        else handled = false; // pago diferido: llegará async_payment_succeeded
        break;
      }
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object;
        const order = await findOrder(session);
        if (order && order.status === 'pending') await store.updateOrder(order.id, { status: 'failed' });
        await trackFailure(order, 'payment_failed');
        break;
      }
      default:
        handled = false;
    }
    await store.finishWebhookEvent(event.id, 'processed');
    return { handled, duplicate: false };
  } catch (err) {
    reportError('stripe_webhook_failed', { eventType: event.type, errorName: err instanceof Error ? err.name : 'unknown' }, { component: 'stripe' });
    await store.finishWebhookEvent(event.id, 'failed', 'processing_error');
    throw new ApiError(500, 'webhook_processing_failed'); // Stripe reintentará
  }
}

async function findOrder(session: Stripe.Checkout.Session): Promise<OrderRow | null> {
  const store = getStore();
  const bySession = await store.getOrderByCheckoutSession(session.id);
  if (bySession) return bySession;
  return session.client_reference_id ? store.getOrder(session.client_reference_id) : null;
}

async function trackFailure(order: OrderRow | null, errorClass: string): Promise<void> {
  if (!order) return;
  const calc = await getStore().getCalculation(order.calculation_id);
  if (!calc) return;
  await trackServer('purchase_fail', { error_class: errorClass }, { locale: calc.locale, fallbackSessionId: calc.session_hash });
}

async function fulfill(session: Stripe.Checkout.Session, deps: { schedule: (task: () => Promise<unknown>) => void }): Promise<void> {
  const store = getStore();
  const order = await findOrder(session);
  if (!order) {
    log.warn('stripe_order_not_found');
    throw new ApiError(500, 'order_not_found');
  }
  if (order.status === 'paid') return; // idempotente: no duplica pedido ni entrega

  const paid = await store.updateOrder(order.id, {
    status: 'paid',
    paid_at: new Date().toISOString(),
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null),
  });

  const calc = await store.getCalculation(paid.calculation_id);
  const lead = paid.lead_id ? await store.getLead(paid.lead_id) : null;
  if (!calc || !lead) throw new ApiError(500, 'order_data_missing');

  const existing = await store.getReportByLead(lead.id);
  const issued = existing ? await rotateReportToken(store, existing) : await issueReport(store, calc, lead.id, 'paid_full');
  await store.updateLead(lead.id, { status: 'paid' });

  await trackServer(
    'purchase_success',
    { price_id: getEnv().stripe.priceId ?? '', currency: paid.currency.toUpperCase(), gross_amount_minor: paid.amount_minor },
    { locale: lead.locale, fallbackSessionId: calc.session_hash, market: calc.market_hint_coarse },
  );

  deps.schedule(() => deliverReport(store, { leadId: lead.id, token: issued.token, mode: 'paid', order: paid }));
}
