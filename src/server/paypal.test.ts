/**
 * Pagos con PayPal (modo `paypal`). PayPal simulado con un `fetch` falso (probado con mocks; el
 * Sandbox real se verifica aparte, ver docs/PAYPAL_SETUP.md). Escenarios del playbook §9:
 *  1) pago COMPLETED → PDF completo al cliente + «VENTA CONFIRMADA» al dueño;  2) pago abandonado;
 *  3) PENDING / importe / moneda / merchant / custom_id ajenos → no se entrega;  4) webhooks: firma
 *  falsa y duplicados;  5) concurrencia y caída del correo con reintento por cron;  6) token de
 *  desbloqueo;  7) vista previa: la API no devuelve el informe y el PDF no filtra valores.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NextServer from 'next/server';
import { POST as calculatePost } from '@/app/api/calculate/route';
import { POST as leadsPost } from '@/app/api/leads/route';
import { POST as createOrderPost } from '@/app/api/paypal/create-order/route';
import { POST as capturePost } from '@/app/api/paypal/capture/route';
import { POST as webhookPost } from '@/app/api/paypal/webhook/route';
import { GET as reportGet } from '@/app/api/report/[token]/route';
import { GET as reportPdfGet } from '@/app/api/report/[token]/pdf/route';
import { GET as healthGet } from '@/app/api/health/route';
import { getEnv } from '@/lib/env';
import { TEST_TURNSTILE_TOKEN } from '@/lib/security/turnstile';
import { hashToken } from '@/lib/security/tokens';
import { resetPaypalTokenCache } from '@/server/paypal/client';
import { testMailbox } from '@/server/email/send';
import { cleanupJob } from '@/server/services/cron';
import { getUnlockContext } from '@/server/services/unlock';
import { freshEnv, getReq, jsonReq, ORIGIN, sessionFrom, stubEnv, TC01, type TestEnv } from '../../tests/helpers';

const scheduled: Array<() => Promise<unknown>> = [];
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof NextServer>()),
  after: (task: () => Promise<unknown>) => void scheduled.push(task),
}));

const OWNER = 'owner@morrowage.test';
const MERCHANT = 'MERCHANT0001';

// ---- PayPal falso ------------------------------------------------------------------------------
interface FakeOrder {
  id: string;
  unit: { reference_id: string; custom_id: string; invoice_id: string; amount: { currency_code: string; value: string } };
  status: string;
  capture?: { id: string; status: string; value: string; currency: string; custom_id: string };
}

class FakePaypal {
  orders = new Map<string, FakeOrder>();
  calls: string[] = [];
  n = 0;
  /** Estado con el que PayPal responde a la captura. */
  captureStatus: 'COMPLETED' | 'PENDING' | 'DENIED' = 'COMPLETED';
  /** Manipulaciones que simulan un pago «raro». */
  tamper: { amount?: string; currency?: string; merchant?: string; customId?: string } = {};
  webhookValid = true;
  verifyDown = false;
  createFails = false;

  respond(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }

  view(o: FakeOrder) {
    return {
      id: o.id,
      status: o.status,
      purchase_units: [
        {
          reference_id: o.unit.reference_id,
          custom_id: o.unit.custom_id,
          invoice_id: o.unit.invoice_id,
          amount: o.unit.amount,
          payee: { merchant_id: this.tamper.merchant ?? MERCHANT },
          ...(o.capture
            ? { payments: { captures: [{ id: o.capture.id, status: o.capture.status, custom_id: o.capture.custom_id, amount: { currency_code: o.capture.currency, value: o.capture.value } }] } }
            : {}),
        },
      ],
    };
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const path = new URL(url).pathname;
    this.calls.push(`${init?.method ?? 'GET'} ${path}`);
    if (!url.startsWith('https://api-m.sandbox.paypal.com') && !url.startsWith('https://api-m.paypal.com')) {
      throw new Error(`red no simulada: ${url}`);
    }
    if (path === '/v1/oauth2/token') return this.respond(200, { access_token: 'tok_test', expires_in: 3000 });

    if (path === '/v2/checkout/orders' && init?.method === 'POST') {
      if (this.createFails) return this.respond(500, { name: 'INTERNAL_SERVER_ERROR' });
      const body = JSON.parse(String(init.body)) as { purchase_units: Array<{ reference_id: string; custom_id: string; invoice_id: string; amount: { currency_code: string; value: string } }> };
      const id = `PPORDER${String(++this.n).padStart(4, '0')}XYZ`;
      this.orders.set(id, { id, unit: body.purchase_units[0]!, status: 'CREATED' });
      return this.respond(201, { id, status: 'CREATED' });
    }

    const m = /^\/v2\/checkout\/orders\/([^/]+)(\/capture)?$/.exec(path);
    if (m) {
      const o = this.orders.get(m[1]!);
      if (!o) return this.respond(404, { name: 'RESOURCE_NOT_FOUND' });
      if (m[2]) {
        if (o.capture) return this.respond(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] });
        o.capture = {
          id: `CAP${o.id}`,
          status: this.captureStatus,
          value: this.tamper.amount ?? o.unit.amount.value,
          currency: this.tamper.currency ?? o.unit.amount.currency_code,
          custom_id: this.tamper.customId ?? o.unit.custom_id,
        };
        o.status = this.captureStatus === 'COMPLETED' ? 'COMPLETED' : 'APPROVED';
        if (this.tamper.customId) o.unit = { ...o.unit, custom_id: this.tamper.customId };
        return this.respond(201, this.view(o));
      }
      return this.respond(200, this.view(o));
    }

    if (path === '/v1/notifications/verify-webhook-signature') {
      if (this.verifyDown) return this.respond(500, { name: 'INTERNAL_SERVER_ERROR' });
      const sent = JSON.parse(String(init?.body)) as { transmission_sig: string; webhook_id: string };
      const ok = this.webhookValid && sent.transmission_sig === 'valid-sig' && sent.webhook_id === 'WH-TEST-0001';
      return this.respond(200, { verification_status: ok ? 'SUCCESS' : 'FAILURE' });
    }
    return this.respond(404, { name: 'NOT_FOUND' });
  };
}

// ---- Helpers -----------------------------------------------------------------------------------
let t: TestEnv;
let pp: FakePaypal;
let restoreEnv: () => void;

const PAYPAL_ENV = {
  MONETIZATION_MODE: 'paypal',
  STRIPE_ENABLED: 'false',
  PAYPAL_ENV: 'sandbox',
  PAYPAL_CLIENT_ID: 'sb_client_id_test',
  PAYPAL_CLIENT_SECRET: 'sb_secret_test',
  PAYPAL_WEBHOOK_ID: 'WH-TEST-0001',
  PAYMENTS_LIVE_APPROVED: 'false',
  REPORT_PRICE_USD: '19.00',
};

async function runAll() {
  while (scheduled.length) await scheduled.shift()!();
}

interface Buyer {
  email: string;
  token: string;
  unlockUrl: string;
  leadId: string;
  calculationId: string;
  sid: string;
}

async function startLead(email: string, locale: 'es' | 'en' | 'pt' = 'es'): Promise<Buyer> {
  const c = await calculatePost(jsonReq('/api/calculate', { inputs: TC01, locale, scopeAccepted: true }, { 'x-turnstile-token': TEST_TURNSTILE_TOKEN }));
  const calc = (await c.json()) as { calculationId: string };
  const sid = sessionFrom(c);
  const res = await leadsPost(
    jsonReq('/api/leads', { calculationId: calc.calculationId, email, locale, serviceConsent: true }, { cookie: `ma_sid=${sid}`, 'x-turnstile-token': TEST_TURNSTILE_TOKEN }),
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { leadId: string; mode: string; unlockUrl: string };
  expect(body.mode).toBe('paywall');
  await runAll();
  return { email, token: body.unlockUrl.split('/').pop()!, unlockUrl: body.unlockUrl, leadId: body.leadId, calculationId: calc.calculationId, sid };
}

const createOrder = (token: string, extra: Record<string, unknown> = {}) =>
  createOrderPost(jsonReq('/api/paypal/create-order', { token, withdrawalWaiver: true, ...extra }));
const capture = (token: string, paypalOrderId: string) => capturePost(jsonReq('/api/paypal/capture', { token, paypalOrderId }));

async function approve(b: Buyer): Promise<{ orderId: string; paypalOrderId: string }> {
  const res = await createOrder(b.token);
  expect(res.status).toBe(201);
  return (await res.json()) as { orderId: string; paypalOrderId: string };
}

function webhook(id: string, type: string, resource: Record<string, unknown>, sig = 'valid-sig') {
  return new Request(`${ORIGIN}/api/paypal/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'paypal-transmission-id': `tid-${id}`,
      'paypal-transmission-time': '2026-10-16T12:00:00Z',
      'paypal-transmission-sig': sig,
      'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-TEST',
      'paypal-auth-algo': 'SHA256withRSA',
    },
    body: JSON.stringify({ id, event_type: type, resource }),
  });
}

const salesTo = (email: string) => testMailbox.to(email).filter((m) => m.attachments?.some((a) => !a.filename.includes('vista-previa')));
const sales = () => testMailbox.to(OWNER).filter((m) => m.subject.includes('VENTA CONFIRMADA'));

beforeEach(() => {
  t = freshEnv();
  scheduled.length = 0;
  pp = new FakePaypal();
  resetPaypalTokenCache();
  vi.stubGlobal('fetch', pp.fetch);
  restoreEnv = stubEnv(PAYPAL_ENV);
});
afterEach(() => {
  restoreEnv();
  vi.unstubAllGlobals();
});

// ---- Pruebas -----------------------------------------------------------------------------------
describe('modo de pago · configuración y apagado seguro', () => {
  it('con credenciales completas y MONETIZATION_MODE=paypal está activo (Sandbox)', () => {
    const e = getEnv();
    expect(e.paypalActive).toBe(true);
    expect(e.paypal.env).toBe('sandbox');
    expect(e.price).toEqual({ amountMinor: 1900, currency: 'USD' });
  });

  it('LIVE exige DOS interruptores: PAYPAL_ENV=live y PAYMENTS_LIVE_APPROVED=true', async () => {
    const off = stubEnv({ PAYPAL_ENV: 'live', PAYMENTS_LIVE_APPROVED: 'false' });
    try {
      expect(getEnv().paypalActive).toBe(false);
      expect(getEnv().paypal.liveBlocked).toBe(true);
      const health = await (await healthGet(getReq('/api/health'))).json();
      expect(health.payments).toMatchObject({ enabled: false, env: 'live', live_blocked: true });
    } finally {
      off();
    }
    const on = stubEnv({ PAYPAL_ENV: 'live', PAYMENTS_LIVE_APPROVED: 'true' });
    try {
      expect(getEnv().paypalActive).toBe(true);
    } finally {
      on();
    }
  });

  it('sin MONETIZATION_MODE=paypal o con credenciales incompletas la app NO se rompe: informe completo gratis', async () => {
    for (const vars of [{ MONETIZATION_MODE: 'validation' }, { PAYPAL_CLIENT_SECRET: undefined }, { PAYPAL_WEBHOOK_ID: undefined }]) {
      const off = stubEnv(vars);
      try {
        expect(getEnv().paypalActive).toBe(false);
        const c = await calculatePost(jsonReq('/api/calculate', { inputs: TC01, locale: 'es', scopeAccepted: true }, { 'x-turnstile-token': TEST_TURNSTILE_TOKEN }));
        const calc = (await c.json()) as { calculationId: string };
        const res = await leadsPost(
          jsonReq('/api/leads', { calculationId: calc.calculationId, email: 'gratis@morrowage.test', locale: 'es', serviceConsent: true }, { cookie: `ma_sid=${sessionFrom(c)}`, 'x-turnstile-token': TEST_TURNSTILE_TOKEN }),
        );
        const body = await res.json();
        expect(body).toMatchObject({ mode: 'report' });
        expect(body.reportUrl).toContain('/es/report/');
        expect((await createOrder('x'.repeat(43))).status).toBe(404); // pagos desactivados
        await runAll();
        testMailbox.clear();
      } finally {
        off();
      }
    }
  });
});

describe('vista previa (antes de pagar)', () => {
  it('la API responde SOLO con el enlace de desbloqueo y el informe completo no viaja al navegador', async () => {
    const b = await startLead('previa@morrowage.test');
    expect(b.unlockUrl).toContain('/es/unlock/');
    // el informe y el PDF completos están bloqueados hasta pagar (402) y no devuelven datos
    const r = await reportGet(getReq(`/api/report/${b.token}`), { params: Promise.resolve({ token: b.token }) });
    expect(r.status).toBe(402);
    expect(JSON.stringify(await r.json())).not.toMatch(/drivers|sensitivity|whatIf|input/);
    const pdf = await reportPdfGet(getReq(`/api/report/${b.token}/pdf`), { params: Promise.resolve({ token: b.token }) });
    expect(pdf.status).toBe(402);
  });

  it('correo al cliente: vista previa difuminada + botón Desbloquear; el dueño recibe el PDF COMPLETO', async () => {
    const b = await startLead('previa@morrowage.test', 'es');
    const user = testMailbox.to(b.email);
    expect(user).toHaveLength(1);
    expect(user[0]!.subject).toContain('vista previa');
    expect(user[0]!.html).toContain(b.unlockUrl);
    expect(user[0]!.html).toContain('US$19');
    expect(user[0]!.attachments).toHaveLength(1);
    expect(user[0]!.attachments![0]!.filename).toMatch(/-vista-previa\.pdf$/);
    expect(Buffer.from(user[0]!.attachments![0]!.content.slice(0, 5)).toString()).toBe('%PDF-');

    const owner = testMailbox.to(OWNER);
    expect(owner).toHaveLength(1);
    expect(owner[0]!.subject).toMatch(/^\[MorrowAge\] Solicitud de informe MA-/);
    expect(owner[0]!.html).toContain('pendiente de pago');
    expect(owner[0]!.attachments![0]!.filename).toMatch(/-COMPLETO\.pdf$/);
    // el PDF completo del dueño es mucho más grande que la vista previa
    expect(owner[0]!.attachments![0]!.content.length).toBeGreaterThan(user[0]!.attachments![0]!.content.length);
    expect(pp.calls).toEqual([]); // nada se cobra ni se llama a PayPal al pedir la vista previa
  });

  it('pagina de desbloqueo: contexto sin datos de salud; token inválido → not_found; informe pagado → open_report', async () => {
    const b = await startLead('previa@morrowage.test');
    const ok = await getUnlockContext(t.store, b.token);
    expect(ok).toMatchObject({ status: 'ok', emailMasked: 'p***@morrowage.test', chronological: 52, resultDisplay: '47.7' });
    expect(JSON.stringify(ok)).not.toMatch(/sleep|reaction|waist|drivers|hazard/);
    expect((await getUnlockContext(t.store, 'x'.repeat(43))).status).toBe('not_found');
    expect((await getUnlockContext(t.store, 'corto')).status).toBe('not_found');
  });
});

describe('1 · pago COMPLETED de US$19', () => {
  it('captura en el servidor, entrega el PDF completo al cliente y avisa «VENTA CONFIRMADA» al dueño', async () => {
    const b = await startLead('compradora@morrowage.test', 'es');
    testMailbox.clear();
    const { orderId, paypalOrderId } = await approve(b);

    // el precio y la moneda salieron del servidor
    const created = pp.orders.get(paypalOrderId)!;
    expect(created.unit.amount).toEqual({ currency_code: 'USD', value: '19.00' });
    expect(created.unit.custom_id).toBe(orderId);
    expect(created.unit.invoice_id).toMatch(/^MA-[0-9A-F]{20}$/);

    const res = await capture(b.token, paypalOrderId);
    expect(res.status).toBe(200);
    const out = (await res.json()) as { status: string; reportUrl?: string };
    expect(out.status).toBe('paid');
    expect(out.reportUrl).toContain('/es/report/');
    await runAll();

    // cliente: informe completo en PDF adjunto
    const mails = testMailbox.to(b.email);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toContain('Pago confirmado');
    expect(mails[0]!.attachments![0]!.filename).toMatch(/^MorrowAge-MA-\d{2}-[0-9A-F]{6}\.pdf$/);
    expect(Buffer.from(mails[0]!.attachments![0]!.content.slice(0, 5)).toString()).toBe('%PDF-');
    expect(mails[0]!.html).toContain(out.reportUrl!);

    // dueño: aviso de venta con el asunto exacto
    const sale = sales();
    expect(sale).toHaveLength(1);
    expect(sale[0]!.subject).toMatch(/^MorrowAge \| VENTA CONFIRMADA US\$19 \| MA-\d{2}-[0-9A-F]{6} \| ENTREGADO \| SANDBOX$/);
    expect(sale[0]!.html).toContain('SANDBOX');
    expect(sale[0]!.html).not.toMatch(/sleep_hours|reaction_time|waist_to_height/); // sin datos de salud

    const order = (await t.store.getOrder(orderId))!;
    expect(order).toMatchObject({ status: 'paid', fulfillment_status: 'delivered', sandbox: true, provider: 'paypal', amount_minor: 1900 });
    expect(order.paypal_capture_id).toBe(`CAP${paypalOrderId}`);

    // el informe pasó a pagado: el token nuevo abre el informe completo; el de desbloqueo ya no
    const newToken = out.reportUrl!.split('/').pop()!;
    const full = await reportGet(getReq(`/api/report/${newToken}`), { params: Promise.resolve({ token: newToken }) });
    expect(full.status).toBe(200);
    expect((await full.json()).accessTier).toBe('paid_full');
    expect((await getUnlockContext(t.store, b.token)).status).toBe('not_found');
    expect((await getUnlockContext(t.store, newToken)).status).toBe('open_report');
  });

  it('una segunda captura del mismo pedido no duplica la entrega (idempotente)', async () => {
    const b = await startLead('compradora@morrowage.test');
    testMailbox.clear();
    const { paypalOrderId } = await approve(b);
    expect(((await (await capture(b.token, paypalOrderId)).json()) as { status: string }).status).toBe('paid');
    // reintento del navegador: ya está pagado, no hay URL nueva ni correos extra
    const again = (await (await capture(b.token, paypalOrderId)).json()) as { status: string; reportUrl?: string };
    expect(again.status).toBe('already_paid');
    expect(again.reportUrl).toBeUndefined();
    await runAll();
    expect(testMailbox.to(b.email)).toHaveLength(1);
    expect(sales()).toHaveLength(1);
  });
});

describe('2 · pago abandonado', () => {
  it('crear la orden y no pagar no entrega nada', async () => {
    const b = await startLead('indecisa@morrowage.test');
    testMailbox.clear();
    await approve(b);
    await runAll();
    expect(testMailbox.all()).toHaveLength(0);
    expect((await t.store.getReportByLead(b.leadId))!.access_tier).toBe('preview_locked');
  });

  it('crear la orden dos veces reutiliza la pendiente (sin órdenes huérfanas)', async () => {
    const b = await startLead('indecisa@morrowage.test');
    const a = await approve(b);
    const c = await approve(b);
    expect(c.paypalOrderId).toBe(a.paypalOrderId);
    expect(pp.orders.size).toBe(1);
  });

  it('sin aceptar términos y renuncia al desistimiento no se crea la orden', async () => {
    const b = await startLead('indecisa@morrowage.test');
    const res = await createOrderPost(jsonReq('/api/paypal/create-order', { token: b.token, withdrawalWaiver: false }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('terms_required');
    expect(pp.orders.size).toBe(0);
  });
});

describe('3 · pagos que NO deben entregar nada', () => {
  async function paidAttempt(setup: () => void) {
    const b = await startLead('rara@morrowage.test');
    testMailbox.clear();
    const { orderId, paypalOrderId } = await approve(b);
    setup();
    const res = await capture(b.token, paypalOrderId);
    await runAll();
    return { b, orderId, paypalOrderId, status: ((await res.json()) as { status: string }).status };
  }

  it.each([
    ['importe 9.99', () => (pp.tamper = { amount: '9.99' }), 'invalid'],
    ['moneda EUR', () => (pp.tamper = { currency: 'EUR' }), 'invalid'],
    ['custom_id ajeno', () => (pp.tamper = { customId: 'otro-pedido' }), 'invalid'],
  ] as const)('%s → no se marca pagado ni se entrega', async (_name, setup, expected) => {
    const r = await paidAttempt(setup);
    expect(r.status).toBe(expected);
    expect(testMailbox.to(r.b.email)).toHaveLength(0);
    expect(sales()).toHaveLength(0);
    const order = (await t.store.getOrder(r.orderId))!;
    expect(order.status).toBe('pending');
    expect(order.last_error_class).toMatch(/^invalid_/);
    expect((await t.store.getReportByLead(r.b.leadId))!.access_tier).toBe('preview_locked');
    // el dueño recibe una alerta (sin datos de salud) para revisar el cobro
    expect(testMailbox.to(OWNER).some((m) => m.subject.includes('PAGO NO ENTREGADO'))).toBe(true);
  });

  it('otro merchant (con PAYPAL_MERCHANT_ID configurado) → no se entrega', async () => {
    const off = stubEnv({ PAYPAL_MERCHANT_ID: MERCHANT });
    try {
      const r = await paidAttempt(() => (pp.tamper = { merchant: 'OTHERMERCHANT' }));
      expect(r.status).toBe('invalid');
      expect(testMailbox.to(r.b.email)).toHaveLength(0);
    } finally {
      off();
    }
    // con el merchant correcto sí se entrega
    const off2 = stubEnv({ PAYPAL_MERCHANT_ID: MERCHANT });
    try {
      pp.tamper = {};
      const ok = await paidAttempt(() => undefined);
      expect(ok.status).toBe('paid');
    } finally {
      off2();
    }
  });

  it('pago DENIED → pedido fallido y nada se entrega', async () => {
    const r = await paidAttempt(() => (pp.captureStatus = 'DENIED'));
    expect(r.status).toBe('failed');
    expect((await t.store.getOrder(r.orderId))!.status).toBe('failed');
    expect(testMailbox.to(r.b.email)).toHaveLength(0);
  });

  it('PENDING no entrega; el webhook PAYMENT.CAPTURE.COMPLETED (firmado) entrega después', async () => {
    const r = await paidAttempt(() => (pp.captureStatus = 'PENDING'));
    expect(r.status).toBe('pending');
    expect(testMailbox.to(r.b.email)).toHaveLength(0);
    expect((await t.store.getOrder(r.orderId))!.status).toBe('pending');

    // PayPal confirma la captura más tarde
    pp.orders.get(r.paypalOrderId)!.capture!.status = 'COMPLETED';
    const res = await webhookPost(webhook('WH-EVT-1', 'PAYMENT.CAPTURE.COMPLETED', { id: `CAP${r.paypalOrderId}`, supplementary_data: { related_ids: { order_id: r.paypalOrderId } } }));
    expect(res.status).toBe(200);
    await runAll();
    expect(testMailbox.to(r.b.email)).toHaveLength(1);
    expect(sales()).toHaveLength(1);
    expect((await t.store.getOrder(r.orderId))!.status).toBe('paid');
  });
});

describe('4 · webhooks', () => {
  it('firma falsa → 401 y no se entrega nada', async () => {
    const b = await startLead('fraude@morrowage.test');
    testMailbox.clear();
    const { paypalOrderId } = await approve(b);
    pp.captureStatus = 'COMPLETED';
    const res = await webhookPost(webhook('WH-EVT-F', 'CHECKOUT.ORDER.APPROVED', { id: paypalOrderId }, 'firma-falsa'));
    expect(res.status).toBe(401);
    await runAll();
    expect(testMailbox.all()).toHaveLength(0);
    expect(pp.calls.some((c) => c.includes('/capture'))).toBe(false);
  });

  it('sin cabeceras de firma → 401 sin llamar siquiera a la API de PayPal', async () => {
    const res = await webhookPost(new Request(`${ORIGIN}/api/paypal/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'WH-X', event_type: 'CHECKOUT.ORDER.APPROVED', resource: {} }) }));
    expect(res.status).toBe(401);
    expect(pp.calls).toEqual([]);
  });

  it('PayPal no verificable (caída) → 500 para que PayPal reintente; no se procesa', async () => {
    const b = await startLead('caida@morrowage.test');
    await approve(b);
    pp.verifyDown = true;
    const res = await webhookPost(webhook('WH-EVT-D', 'CHECKOUT.ORDER.APPROVED', { id: 'X' }));
    expect(res.status).toBe(500);
  });

  it('CHECKOUT.ORDER.APPROVED: si el comprador cerró la pestaña, el servidor captura y entrega', async () => {
    const b = await startLead('cerro@morrowage.test');
    testMailbox.clear();
    const { paypalOrderId } = await approve(b);
    const res = await webhookPost(webhook('WH-EVT-A', 'CHECKOUT.ORDER.APPROVED', { id: paypalOrderId }));
    expect(res.status).toBe(200);
    await runAll();
    expect(testMailbox.to(b.email)).toHaveLength(1);
    expect(sales()[0]!.subject).toContain('ENTREGADO');
  });

  it('eventos duplicados → una sola entrega; y la captura del navegador tras el webhook no duplica', async () => {
    const b = await startLead('doble@morrowage.test');
    testMailbox.clear();
    const { paypalOrderId } = await approve(b);
    const evt = () => webhook('WH-EVT-DUP', 'CHECKOUT.ORDER.APPROVED', { id: paypalOrderId });
    const [r1, r2] = await Promise.all([webhookPost(evt()), webhookPost(evt())]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect([(await r1.json()).duplicate, (await r2.json()).duplicate].sort()).toEqual([false, true]);
    await capture(b.token, paypalOrderId); // el navegador llega tarde
    await runAll();
    expect(testMailbox.to(b.email)).toHaveLength(1);
    expect(sales()).toHaveLength(1);
  });

  it('PAYMENT.CAPTURE.REFUNDED marca el pedido como reembolsado y avisa al dueño', async () => {
    const b = await startLead('reembolso@morrowage.test');
    const { orderId, paypalOrderId } = await approve(b);
    await capture(b.token, paypalOrderId);
    await runAll();
    testMailbox.clear();
    const res = await webhookPost(webhook('WH-EVT-R', 'PAYMENT.CAPTURE.REFUNDED', { id: 'R1', supplementary_data: { related_ids: { order_id: paypalOrderId } } }));
    expect(res.status).toBe(200);
    expect((await t.store.getOrder(orderId))!.status).toBe('refunded');
    expect(testMailbox.to(OWNER).some((m) => m.subject.includes('REEMBOLSO'))).toBe(true);
  });
});

describe('5 · concurrencia y caída del correo', () => {
  it('dos compradores a la vez reciben cada uno SU informe', async () => {
    const a = await startLead('ana@morrowage.test');
    const b = await startLead('beto@morrowage.test');
    testMailbox.clear();
    const [oa, ob] = [await approve(a), await approve(b)];
    const [ra, rb] = await Promise.all([capture(a.token, oa.paypalOrderId), capture(b.token, ob.paypalOrderId)]);
    expect(((await ra.json()) as { status: string }).status).toBe('paid');
    expect(((await rb.json()) as { status: string }).status).toBe('paid');
    await runAll();
    expect(salesTo(a.email)).toHaveLength(1);
    expect(salesTo(b.email)).toHaveLength(1);
    expect(salesTo(a.email)[0]!.html).not.toContain(b.email);
    expect(sales()).toHaveLength(2);
  });

  it('un token no sirve para capturar el pedido de OTRO comprador', async () => {
    const a = await startLead('ana@morrowage.test');
    const b = await startLead('beto@morrowage.test');
    const ob = await approve(b);
    const res = await capture(a.token, ob.paypalOrderId);
    expect(res.status).toBe(404);
    expect((await t.store.getOrder(ob.orderId))!.status).toBe('pending');
    expect(pp.calls.some((c) => c.includes('/capture'))).toBe(false);
  });

  it('si cae el correo, el pedido queda pagado/«failed» y el cron reintenta sin duplicar', async () => {
    const b = await startLead('reintento@morrowage.test');
    testMailbox.clear();
    const { orderId, paypalOrderId } = await approve(b);
    testMailbox.failNext('resend_403_validation_error', { tag: 'user' });
    await capture(b.token, paypalOrderId);
    await runAll();

    let order = (await t.store.getOrder(orderId))!;
    expect(order.status).toBe('paid');
    expect(order.fulfillment_status).toBe('failed');
    expect(order.last_error_class).toBe('user_email_failed');
    expect(testMailbox.to(b.email)).toHaveLength(0);
    expect(sales()[0]!.subject).toContain('ENTREGA PENDIENTE');

    // el cron diario reintenta (más de 10 min después)
    const res = await cleanupJob(new Date(Date.now() + 11 * 60_000));
    expect(res.ordersRetried).toBe(1);
    order = (await t.store.getOrder(orderId))!;
    expect(order.fulfillment_status).toBe('delivered');
    expect(testMailbox.to(b.email)).toHaveLength(1);
    expect(sales().at(-1)!.subject).toContain('ENTREGADO');

    // un segundo cron no vuelve a entregar
    await cleanupJob(new Date(Date.now() + 30 * 60_000));
    expect(testMailbox.to(b.email)).toHaveLength(1);
  });

  it('si solo falla el aviso al dueño, el reintento NO reenvía el correo al cliente', async () => {
    const b = await startLead('soloowner@morrowage.test');
    testMailbox.clear();
    const { orderId, paypalOrderId } = await approve(b);
    testMailbox.failNext('resend_403_validation_error', { tag: 'owner' });
    await capture(b.token, paypalOrderId);
    await runAll();
    expect((await t.store.getOrder(orderId))!.last_error_class).toBe('owner_email_failed');
    expect(testMailbox.to(b.email)).toHaveLength(1);

    await cleanupJob(new Date(Date.now() + 11 * 60_000));
    expect(testMailbox.to(b.email)).toHaveLength(1); // sin duplicados
    expect(sales()).toHaveLength(1);
    expect((await t.store.getOrder(orderId))!.fulfillment_status).toBe('delivered');
  });

  it('la entrega se reclama en exclusiva: dos procesos simultáneos entregan UNA vez', async () => {
    const b = await startLead('exclusiva@morrowage.test');
    testMailbox.clear();
    const { orderId, paypalOrderId } = await approve(b);
    await capture(b.token, paypalOrderId);
    const { fulfillPaidOrder } = await import('@/server/services/fulfillment');
    scheduled.length = 0;
    const order = (await t.store.getOrder(orderId))!;
    await t.store.updateOrder(orderId, { fulfillment_status: 'not_started' });
    void order;
    const [x, y] = await Promise.all([fulfillPaidOrder(t.store, orderId), fulfillPaidOrder(t.store, orderId)]);
    expect([x.claimed, y.claimed].sort()).toEqual([false, true]);
    expect(testMailbox.to(b.email)).toHaveLength(1);
  });
});

describe('6 · token de desbloqueo', () => {
  it('token inexistente → 404; manipulado → 404; caducado → 410', async () => {
    const b = await startLead('token@morrowage.test');
    expect((await createOrder('A'.repeat(43))).status).toBe(404);
    expect((await createOrder(b.token.slice(0, -1) + (b.token.endsWith('A') ? 'B' : 'A'))).status).toBe(404);
    expect((await createOrder('corto')).status).toBe(400);

    const report = (await t.store.getReportByTokenHash(hashToken(b.token)))!;
    await t.store.updateReport(report.id, { token_expires_at: new Date(Date.now() - 1000).toISOString() });
    const res = await createOrder(b.token);
    expect(res.status).toBe(410);
    expect((await getUnlockContext(t.store, b.token)).status).toBe('expired');
  });

  it('el enlace de desbloqueo dura lo que la retención (30 días), no 7', async () => {
    const b = await startLead('token@morrowage.test');
    const report = (await t.store.getReportByTokenHash(hashToken(b.token)))!;
    const days = (new Date(report.token_expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30.01);
  });

  it('si PayPal falla al crear la orden: 502, el pedido queda fallido y no hay cobro', async () => {
    const b = await startLead('caidapp@morrowage.test');
    pp.createFails = true;
    const res = await createOrder(b.token);
    expect(res.status).toBe(502);
    const orders = await t.store.listOrdersByCalculation(b.calculationId);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ status: 'failed', last_error_class: 'paypal_create_failed' });
  });
});

describe('7 · protección frente a doble cobro y pagos duplicados', () => {
  it('con un pedido ya pagado no se crea ni se captura otro', async () => {
    const b = await startLead('doblecobro@morrowage.test');
    const first = await approve(b);
    // segunda orden abierta ANTES de pagar la primera (dos pestañas)
    pp.n += 0;
    const orderTwoRes = await (async () => {
      // fuerza una segunda orden pendiente distinta (la primera se «envejece» fuera de la ventana de reutilización)
      const o = (await t.store.getOrder(first.orderId))!;
      await t.store.updateOrder(o.id, { status: 'failed' });
      return approve(b);
    })();
    expect(orderTwoRes.paypalOrderId).not.toBe(first.paypalOrderId);
    await capture(b.token, orderTwoRes.paypalOrderId);
    await runAll();
    testMailbox.clear();
    // un nuevo intento de crear orden tras haber pagado → 409 (ya pagado); el token fue rotado → 404 también es válido
    const again = await createOrder(b.token);
    expect([404, 409]).toContain(again.status);
    expect(testMailbox.all()).toHaveLength(0);
  });
});

describe('8 · observabilidad', () => {
  it('/api/health público: integraciones y pagos sin secretos', async () => {
    const res = await healthGet(getReq('/api/health'));
    const body = await res.json();
    expect(body.payments).toMatchObject({ enabled: true, mode: 'paypal', env: 'sandbox', client_id: 'sb_client_id_test', live_blocked: false, webhook_configured: true, price_usd: 19 });
    expect(body.integrations).toMatchObject({ paypal: true, resend_api_key: 'missing', deployment: 'local' });
    expect(JSON.stringify(body)).not.toContain('sb_secret_test');
    expect(JSON.stringify(body)).not.toContain('WH-TEST-0001');
  });

  it('los logs y reportes de error no contienen email, token ni claves', async () => {
    const b = await startLead('privada@morrowage.test');
    const { paypalOrderId } = await approve(b);
    await capture(b.token, paypalOrderId);
    await runAll();
    const joined = JSON.stringify(t.reports);
    for (const forbidden of [b.email, b.token, 'sb_secret_test']) expect(joined).not.toContain(forbidden);
  });
});
