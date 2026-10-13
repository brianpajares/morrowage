/**
 * AT-18 (checkout con flag y price permitido), AT-19 (firma inválida 400, evento duplicado sin doble
 * pedido/entrega) y FR-20: Stripe apagado por defecto. Sandbox simulado: se usa el verificador de
 * firmas REAL del SDK con un secreto de prueba; solo las llamadas de red a Stripe están sustituidas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NextServer from 'next/server';
import Stripe from 'stripe';
import { POST as calculatePost } from '@/app/api/calculate/route';
import { POST as leadsPost } from '@/app/api/leads/route';
import { POST as checkoutPost } from '@/app/api/stripe/checkout/route';
import { POST as webhookPost } from '@/app/api/stripe/webhook/route';
import { testMailbox } from '@/server/email/send';
import { setStripeForTests } from '@/server/services/stripe';
import { TEST_TURNSTILE_TOKEN } from '@/lib/security/turnstile';
import { freshEnv, jsonReq, ORIGIN, sessionFrom, stubEnv, TC01, type TestEnv } from '../../tests/helpers';

const scheduled: Array<() => Promise<unknown>> = [];
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof NextServer>()),
  after: (task: () => Promise<unknown>) => void scheduled.push(task),
}));

const SECRET = 'whsec_test_secret_0123456789';
const PRICE = 'price_test123ABC';
const real = new Stripe('sk_test_dummy_key_for_unit_tests');
const EMAIL = 'compradora.sintetica@morrowage.test';

let t: TestEnv;
let restore: () => void;
let created: Array<Record<string, unknown>>;

function fakeStripe(): Stripe {
  return {
    prices: { retrieve: async () => ({ active: true, unit_amount: 1900, currency: 'usd' }) },
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          created.push(params);
          return { id: 'cs_test_1', url: 'https://checkout.stripe.test/pay/cs_test_1' };
        },
      },
    },
    webhooks: real.webhooks,
  } as unknown as Stripe;
}

function enable() {
  restore = stubEnv({
    MONETIZATION_MODE: 'stripe',
    STRIPE_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_dummy_key_for_unit_tests',
    STRIPE_WEBHOOK_SECRET: SECRET,
    STRIPE_PRICE_REPORT_USD: PRICE,
  });
  setStripeForTests(fakeStripe());
}

async function calc() {
  const res = await calculatePost(jsonReq('/api/calculate', { inputs: TC01, locale: 'en', scopeAccepted: true }, { 'x-turnstile-token': TEST_TURNSTILE_TOKEN }));
  return { ...(await res.json()), sid: sessionFrom(res) } as { calculationId: string; sid: string };
}

function checkout(c: { calculationId: string; sid: string }, priceId = PRICE) {
  return checkoutPost(jsonReq('/api/stripe/checkout', { calculationId: c.calculationId, email: EMAIL, locale: 'en', priceId, serviceConsent: true }, { cookie: `ma_sid=${c.sid}` }));
}

function event(id: string, type: string, session: Record<string, unknown>) {
  const payload = JSON.stringify({ id, object: 'event', api_version: '2025-01-01', created: 1_790_000_000, type, data: { object: { object: 'checkout.session', ...session } } });
  const signature = real.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return new Request(`${ORIGIN}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': signature, 'content-type': 'application/json' }, body: payload });
}

beforeEach(() => {
  t = freshEnv();
  scheduled.length = 0;
  created = [];
  restore = () => undefined;
});
afterEach(() => {
  restore();
  setStripeForTests(undefined);
});

async function runAll() {
  while (scheduled.length) await scheduled.shift()!();
}

describe('FR-20 · Stripe apagado por defecto', () => {
  it('con MONETIZATION_MODE=validation el checkout y el webhook responden 404', async () => {
    const c = await calc();
    expect((await checkout(c)).status).toBe(404);
    expect((await webhookPost(event('evt_x', 'checkout.session.completed', { id: 'cs_x' }))).status).toBe(404);
  });

  it('MONETIZATION_MODE=stripe sin STRIPE_ENABLED=true sigue apagado', async () => {
    const off = stubEnv({ MONETIZATION_MODE: 'stripe', STRIPE_ENABLED: 'false', STRIPE_SECRET_KEY: 'sk_test_dummy_key_for_unit_tests', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_REPORT_USD: PRICE });
    try {
      const c = await calc();
      expect((await checkout(c)).status).toBe(404);
    } finally {
      off();
    }
  });
});

describe('AT-18 · Checkout (stripe-only)', () => {
  it('crea una Checkout Session solo con el price permitido y registra el pedido', async () => {
    enable();
    const c = await calc();
    const wrong = await checkout(c, 'price_otro_distinto');
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).code).toBe('price_not_allowed');
    expect(created).toHaveLength(0);

    const ok = await checkout(c);
    expect(ok.status).toBe(201);
    expect((await ok.json()).checkoutUrl).toBe('https://checkout.stripe.test/pay/cs_test_1');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ mode: 'payment', line_items: [{ price: PRICE, quantity: 1 }], customer_email: EMAIL, locale: 'en' });

    const [order] = [...t.store.orders.values()];
    expect(order).toMatchObject({ status: 'pending', amount_minor: 1900, currency: 'usd', stripe_checkout_session_id: 'cs_test_1' });
    expect(created[0]!.client_reference_id).toBe(order!.id);
    // Sin cobro previo, sin entrega previa.
    expect(testMailbox.all()).toHaveLength(0);
  });

  it('en modo stripe el flujo gratuito de leads queda deshabilitado', async () => {
    enable();
    const c = await calc();
    const res = await leadsPost(jsonReq('/api/leads', { calculationId: c.calculationId, email: EMAIL, locale: 'en', serviceConsent: true }, { cookie: `ma_sid=${c.sid}` }));
    expect(res.status).toBe(409);
  });

  it('exige la sesión del navegador que creó el cálculo', async () => {
    enable();
    const c = await calc();
    const res = await checkoutPost(jsonReq('/api/stripe/checkout', { calculationId: c.calculationId, email: EMAIL, locale: 'en', priceId: PRICE }, { cookie: 'ma_sid=ajena-000000000000000000' }));
    expect(res.status).toBe(403);
  });
});

describe('AT-19 · Webhook firmado e idempotente (stripe-only)', () => {
  async function paidSetup() {
    enable();
    const c = await calc();
    await checkout(c);
    const [order] = [...t.store.orders.values()];
    return { c, order: order! };
  }
  const completed = (orderId: string, extra: Record<string, unknown> = {}) => ({
    id: 'cs_test_1',
    payment_status: 'paid',
    client_reference_id: orderId,
    payment_intent: 'pi_test_1',
    ...extra,
  });

  it('firma inválida o ausente → 400', async () => {
    const { order } = await paidSetup();
    const good = event('evt_1', 'checkout.session.completed', completed(order.id));
    const body = await good.text();
    const bad = new Request(`${ORIGIN}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=deadbeef' }, body });
    expect((await webhookPost(bad)).status).toBe(400);
    const missing = new Request(`${ORIGIN}/api/stripe/webhook`, { method: 'POST', body });
    expect((await webhookPost(missing)).status).toBe(400);
    expect(t.store.orders.get(order.id)!.status).toBe('pending');
  });

  it('pago confirmado: pedido pagado, informe paid_full, PDF al comprador y copia al dueño', async () => {
    const { order } = await paidSetup();
    const res = await webhookPost(event('evt_1', 'checkout.session.completed', completed(order.id)));
    expect(res.status).toBe(200);
    await runAll();

    expect(t.store.orders.get(order.id)).toMatchObject({ status: 'paid', stripe_payment_intent_id: 'pi_test_1' });
    expect(t.store.orders.get(order.id)!.paid_at).toBeTruthy();
    const [report] = [...t.store.reports.values()];
    expect(report!.access_tier).toBe('paid_full');
    const [lead] = [...t.store.leads.values()];
    expect(lead!.status).toBe('paid');

    const buyer = testMailbox.to(EMAIL);
    expect(buyer).toHaveLength(1);
    expect(buyer[0]!.subject).toBe('Payment confirmed · your MorrowAge report');
    expect(buyer[0]!.attachments?.[0]?.contentType).toBe('application/pdf');
    const owner = testMailbox.to('owner@morrowage.test');
    expect(owner).toHaveLength(1);
    expect(owner[0]!.subject).toBe(`[MorrowAge] Solicitud de informe ${report!.verification_id}`);
    expect(owner[0]!.html).toContain('Compra (Stripe)');
    expect(owner[0]!.attachments?.[0]?.contentType).toBe('application/pdf');
  });

  it('evento duplicado (mismo event.id) no duplica pedido ni entrega', async () => {
    const { order } = await paidSetup();
    const first = await webhookPost(event('evt_dup', 'checkout.session.completed', completed(order.id)));
    expect((await first.json()).duplicate).toBe(false);
    await runAll();
    const second = await webhookPost(event('evt_dup', 'checkout.session.completed', completed(order.id)));
    expect(second.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);
    await runAll();
    expect(t.store.orders.size).toBe(1);
    expect(t.store.reports.size).toBe(1);
    expect(testMailbox.to(EMAIL)).toHaveLength(1);
    expect(testMailbox.to('owner@morrowage.test')).toHaveLength(1);
  });

  it('otro event.id para el mismo pedido ya pagado tampoco entrega dos veces', async () => {
    const { order } = await paidSetup();
    await webhookPost(event('evt_a', 'checkout.session.completed', completed(order.id)));
    await runAll();
    await webhookPost(event('evt_b', 'checkout.session.async_payment_succeeded', completed(order.id)));
    await runAll();
    expect(testMailbox.to(EMAIL)).toHaveLength(1);
    expect(t.store.reports.size).toBe(1);
  });

  it('un fallo de procesamiento responde 500 y el reintento de Stripe sí se procesa', async () => {
    const { order } = await paidSetup();
    const spy = vi.spyOn(t.store, 'updateOrder').mockRejectedValueOnce(new Error('db_down'));
    const failed = await webhookPost(event('evt_retry', 'checkout.session.completed', completed(order.id)));
    expect(failed.status).toBe(500);
    expect(t.store.webhookEvents.get('evt_retry')!.status).toBe('failed');
    spy.mockRestore();

    const retried = await webhookPost(event('evt_retry', 'checkout.session.completed', completed(order.id)));
    expect(retried.status).toBe(200);
    expect((await retried.json()).duplicate).toBe(false);
    await runAll();
    expect(t.store.orders.get(order.id)!.status).toBe('paid');
    expect(testMailbox.to(EMAIL)).toHaveLength(1);
  });

  it('pago fallido o sesión expirada marca el pedido como failed y no entrega nada', async () => {
    const { order } = await paidSetup();
    await webhookPost(event('evt_f', 'checkout.session.expired', { id: 'cs_test_1', client_reference_id: order.id }));
    await runAll();
    expect(t.store.orders.get(order.id)!.status).toBe('failed');
    expect(testMailbox.all()).toHaveLength(0);
  });

  it('no usa req.json(): la verificación depende del cuerpo RAW exacto', async () => {
    const { order } = await paidSetup();
    const ev = event('evt_raw', 'checkout.session.completed', completed(order.id));
    const raw = await ev.text();
    const sig = ev.headers.get('stripe-signature')!;
    const tampered = new Request(`${ORIGIN}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': sig }, body: raw.replace('paid', 'unpaid') });
    expect((await webhookPost(tampered)).status).toBe(400);
  });
});
