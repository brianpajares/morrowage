/**
 * Pagos con PayPal Checkout (Orders v2) — modo `MONETIZATION_MODE=paypal`.
 *
 *   /[locale]/unlock/<token> ── create-order ──► PayPal ── aprobación ──► capture (servidor)
 *                                                  │                          │
 *                                      webhook (firma verificada) ────────────┤
 *                                                                             ▼
 *      mark_paid (SQL atómico) → informe pasa a paid_full + token rotado → fulfillPaidOrder
 *
 * Reglas: el precio sale del servidor; la autorización de cada llamada es la posesión del token de
 * desbloqueo (llegó solo al buzón del cliente); se valida orden, custom_id, estado, importe, moneda
 * y merchant antes de entregar; nada se entrega por un pago PENDING, ajeno o de importe distinto.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { log } from '@/lib/log';
import { reportError } from '@/lib/observability/report-error';
import { hashToken, isPlausibleToken } from '@/lib/security/tokens';
import { trackServer } from '@/server/analytics';
import { sendEmail } from '@/server/email/send';
import { buildOwnerAlertEmail } from '@/server/email/templates';
import { ApiError } from '@/server/http';
import {
  capturePaypalOrder,
  createPaypalOrder,
  evaluateOrder,
  getPaypalOrder,
  PaypalError,
  verifyPaypalWebhook,
} from '@/server/paypal/client';
import { getStore } from '@/server/store';
import type { OrderRow, ReportRow, Store } from '@/server/store/types';
import { fulfillPaidOrder } from './fulfillment';
import { reportUrl, rotateReportToken } from './report';

type Schedule = (task: () => Promise<unknown>) => void;

export function assertPaypalActive(): void {
  if (!getEnv().paypalActive) throw new ApiError(404, 'payments_disabled');
}

const tokenSchema = z.string().refine(isPlausibleToken, 'invalid_token');

/** Resuelve el informe por el token de desbloqueo. 404 inválido · 410 caducado. */
async function reportByToken(store: Store, token: string): Promise<ReportRow> {
  const report = await store.getReportByTokenHash(hashToken(token));
  if (!report) throw new ApiError(404, 'unlock_not_found');
  if (new Date(report.token_expires_at) <= new Date()) throw new ApiError(410, 'unlock_expired');
  return report;
}

// ---- 1) Crear orden -----------------------------------------------------------------------------
const createSchema = z.strictObject({
  token: tokenSchema,
  /** Aceptación de términos y renuncia al desistimiento (producto digital de entrega inmediata). */
  withdrawalWaiver: z.literal(true),
});

export async function createPaypalOrderService(opts: { body: unknown }): Promise<{ orderId: string; paypalOrderId: string }> {
  assertPaypalActive();
  const env = getEnv();
  const parsed = createSchema.safeParse(opts.body);
  if (!parsed.success) {
    const waiver = parsed.error.issues.some((i) => i.path[0] === 'withdrawalWaiver');
    throw new ApiError(400, waiver ? 'terms_required' : 'invalid_request');
  }

  const store = getStore();
  const report = await reportByToken(store, parsed.data.token);
  if (report.access_tier === 'paid_full') throw new ApiError(409, 'already_paid');
  if (report.access_tier !== 'preview_locked' || !report.lead_id) throw new ApiError(409, 'not_locked');

  const lead = await store.getLead(report.lead_id);
  const calc = await store.getCalculation(report.calculation_id);
  if (!lead || !calc) throw new ApiError(404, 'unlock_not_found');

  const existing = await store.listOrdersByCalculation(calc.id);
  if (existing.some((o) => o.status === 'paid')) throw new ApiError(409, 'already_paid');

  // Reutiliza la orden pendiente reciente con el mismo importe (evita órdenes huérfanas por reintentos).
  const fresh = existing
    .filter(
      (o) =>
        o.provider === 'paypal' &&
        o.status === 'pending' &&
        o.paypal_order_id &&
        o.amount_minor === env.price.amountMinor &&
        o.currency === env.price.currency &&
        Date.now() - new Date(o.created_at).getTime() < 60 * 60_000,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const ctx = { locale: lead.locale, fallbackSessionId: calc.session_hash, market: calc.market_hint_coarse };
  if (fresh?.paypal_order_id) {
    await trackServer('checkout_start', { currency: env.price.currency }, ctx);
    return { orderId: fresh.id, paypalOrderId: fresh.paypal_order_id };
  }

  const order = await store.insertOrder({
    calculation_id: calc.id,
    lead_id: lead.id,
    amount_minor: env.price.amountMinor,
    currency: env.price.currency,
    provider: 'paypal',
    sandbox: env.paypal.env === 'sandbox',
    terms_accepted_at: new Date().toISOString(),
  });

  try {
    const pp = await createPaypalOrder({
      orderId: order.id,
      amountMinor: order.amount_minor,
      currency: order.currency,
      description: `MorrowAge · ${report.verification_id}`,
      brandName: 'MorrowAge',
    });
    await store.updateOrder(order.id, { paypal_order_id: pp.id });
    await trackServer('checkout_start', { currency: env.price.currency }, ctx);
    return { orderId: order.id, paypalOrderId: pp.id };
  } catch (err) {
    await store.updateOrder(order.id, { status: 'failed', last_error_class: 'paypal_create_failed' });
    reportError('paypal_create_order_failed', { errorName: err instanceof PaypalError ? `${err.status}_${err.code}` : err instanceof Error ? err.message.slice(0, 60) : 'unknown' }, { component: 'paypal' });
    throw new ApiError(502, 'paypal_unavailable');
  }
}

// ---- 2) Conciliación (captura del navegador, webhook y reintentos) -----------------------------
export interface SettleResult {
  status: 'paid' | 'already_paid' | 'pending' | 'failed' | 'invalid' | 'not_captured';
  /** Solo en la transición pending → paid de ESTA llamada (el token plano no se puede recuperar luego). */
  reportUrl?: string;
}

async function afterPaid(store: Store, order: OrderRow, schedule: Schedule): Promise<string | undefined> {
  const lead = order.lead_id ? await store.getLead(order.lead_id) : null;
  const calc = await store.getCalculation(order.calculation_id);
  const report = lead ? await store.getReportByLead(lead.id) : null;
  if (!lead || !calc || !report) {
    await store.updateOrder(order.id, { last_error_class: 'order_data_missing' });
    schedule(() => fulfillPaidOrder(store, order.id));
    return undefined;
  }

  // Pago duplicado (informe ya desbloqueado por otro pedido): no se rota el token ni se re-entrega.
  if (report.access_tier === 'paid_full') {
    schedule(() => fulfillPaidOrder(store, order.id));
    return undefined;
  }

  const issued = await rotateReportToken(store, report, new Date(), 'paid_full');
  await store.updateLead(lead.id, { status: 'paid' });
  await trackServer(
    'purchase_success',
    { currency: order.currency.toUpperCase(), gross_amount_minor: order.amount_minor },
    { locale: lead.locale, fallbackSessionId: calc.session_hash, market: calc.market_hint_coarse },
  );
  schedule(() => fulfillPaidOrder(store, order.id, { token: issued.token }));
  return reportUrl(lead.locale, issued.token);
}

async function failOrder(store: Store, order: OrderRow, errorClass: string): Promise<void> {
  if (order.status === 'pending') await store.updateOrder(order.id, { status: 'failed', last_error_class: errorClass });
  const calc = await store.getCalculation(order.calculation_id);
  if (calc) await trackServer('purchase_fail', { error_class: errorClass }, { locale: calc.locale, fallbackSessionId: calc.session_hash });
}

/**
 * Concilia un pedido con PayPal. `capture: true` captura en el servidor (flujo del navegador y evento
 * APPROVED); `false` solo consulta (evento CAPTURE.COMPLETED). Toda la validación vive aquí.
 */
export async function settleOrder(store: Store, orderId: string, opts: { capture: boolean; schedule: Schedule }): Promise<SettleResult> {
  const env = getEnv();
  const order = await store.getOrder(orderId);
  if (!order || order.provider !== 'paypal' || !order.paypal_order_id) return { status: 'invalid' };

  if (order.status === 'paid') {
    if (order.fulfillment_status !== 'delivered') opts.schedule(() => fulfillPaidOrder(store, order.id));
    return { status: 'already_paid' };
  }
  if (order.status !== 'pending') return { status: 'failed' };

  // Antes de capturar: si este cálculo ya tiene otro pedido pagado, NO se cobra una segunda vez.
  if (opts.capture) {
    const siblings = await store.listOrdersByCalculation(order.calculation_id);
    if (siblings.some((o) => o.id !== order.id && o.status === 'paid')) {
      await store.updateOrder(order.id, { status: 'failed', last_error_class: 'superseded' });
      return { status: 'already_paid' };
    }
  }

  let pp;
  try {
    pp = opts.capture ? await capturePaypalOrder(order.paypal_order_id, order.id) : await getPaypalOrder(order.paypal_order_id);
  } catch (err) {
    // Rechazos de PayPal (tarjeta, orden no aprobada) → fallo del pedido; errores de red/5xx → reintentable.
    if (err instanceof PaypalError && err.status >= 400 && err.status < 500 && err.status !== 429) {
      await failOrder(store, order, `paypal_${err.code.toLowerCase()}`.slice(0, 39));
      return { status: 'failed' };
    }
    throw new ApiError(502, 'paypal_unavailable');
  }

  const verdict = evaluateOrder({
    paypalOrderId: order.paypal_order_id,
    internalOrderId: order.id,
    expectedAmountMinor: order.amount_minor,
    expectedCurrency: order.currency,
    merchantId: env.paypal.merchantId,
    order: pp,
  });

  switch (verdict.kind) {
    case 'completed': {
      const res = await store.markOrderPaid({
        orderId: order.id,
        paypalOrderId: order.paypal_order_id,
        captureId: verdict.captureId,
        amountMinor: verdict.amountMinor,
        currency: verdict.currency,
        sandbox: env.paypal.env === 'sandbox',
      });
      if (res === 'paid') {
        const url = await afterPaid(store, { ...order, status: 'paid', paypal_capture_id: verdict.captureId }, opts.schedule);
        return { status: 'paid', ...(url ? { reportUrl: url } : {}) };
      }
      if (res === 'already_paid') return { status: 'already_paid' };
      await store.updateOrder(order.id, { last_error_class: 'mark_paid_mismatch' });
      reportError('paypal_mark_paid_mismatch', {}, { component: 'paypal' });
      return { status: 'invalid' };
    }
    case 'pending':
      await store.updateOrder(order.id, { last_error_class: 'capture_pending' });
      return { status: 'pending' }; // el webhook PAYMENT.CAPTURE.COMPLETED entregará cuando se confirme
    case 'denied':
      await failOrder(store, order, 'payment_denied');
      return { status: 'failed' };
    case 'not_captured':
      return { status: 'not_captured' };
    case 'invalid':
      await store.updateOrder(order.id, { last_error_class: `invalid_${verdict.reason}`.slice(0, 39) });
      reportError('paypal_order_invalid', { reason: verdict.reason }, { component: 'paypal' });
      await trackAlert(order, `Pago NO entregado: ${verdict.reason}`);
      return { status: 'invalid' };
  }
}

async function trackAlert(order: OrderRow, reason: string): Promise<void> {
  const owner = getEnv().ownerEmail;
  if (!owner) return;
  const mail = buildOwnerAlertEmail({
    subject: 'PAGO NO ENTREGADO · revisar',
    lines: [
      ['Motivo', reason],
      ['Pedido', order.id],
      ['PayPal order id', order.paypal_order_id ?? '—'],
      ['Importe esperado', `${(order.amount_minor / 100).toFixed(2)} ${order.currency}`],
      ['Entorno', order.sandbox ? 'SANDBOX' : 'LIVE'],
    ],
  });
  await sendEmail({ to: owner, subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `ma-${order.id}-invalid-${reason.replace(/\W+/g, '_').slice(0, 30)}`, tag: 'owner' });
}

// ---- 3) Captura iniciada por el navegador -------------------------------------------------------
const captureSchema = z.strictObject({
  token: tokenSchema,
  paypalOrderId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

export async function capturePaypalOrderService(opts: { body: unknown; schedule: Schedule }): Promise<SettleResult> {
  assertPaypalActive();
  const parsed = captureSchema.safeParse(opts.body);
  if (!parsed.success) throw new ApiError(400, 'invalid_request');

  const store = getStore();
  let report: ReportRow;
  try {
    report = await reportByToken(store, parsed.data.token);
  } catch (err) {
    // Reintento tardío del navegador: tras el pago el token de desbloqueo se rota, así que ya no existe.
    // Si ese pedido (id de PayPal, solo conocido por el comprador) ya está pagado, la respuesta es idempotente.
    if (err instanceof ApiError && err.status === 404) {
      const paid = await store.getOrderByPaypalOrderId(parsed.data.paypalOrderId);
      if (paid?.status === 'paid') return { status: 'already_paid' };
    }
    throw err;
  }
  const order = await store.getOrderByPaypalOrderId(parsed.data.paypalOrderId);
  // La orden debe pertenecer al cálculo de este informe: un token no sirve para capturar pedidos ajenos.
  if (!order || order.calculation_id !== report.calculation_id) throw new ApiError(404, 'order_not_found');

  return settleOrder(store, order.id, { capture: true, schedule: opts.schedule });
}

// ---- 4) Webhook ---------------------------------------------------------------------------------
interface PaypalEvent {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
    dispute_id?: string;
    disputed_transactions?: Array<{ seller_transaction_id?: string }>;
  };
}

export type PaypalWebhookResult = { handled: boolean; duplicate: boolean };

export async function handlePaypalWebhook(rawBody: string, headers: Headers, deps: { schedule: Schedule }): Promise<PaypalWebhookResult> {
  assertPaypalActive();

  // Sin las cabeceras de firma de PayPal ni se consulta a su API (evita que peticiones basura la saturen).
  for (const h of ['paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time', 'paypal-cert-url', 'paypal-auth-algo']) {
    if (!headers.get(h)) throw new ApiError(401, 'invalid_signature');
  }

  let valid = false;
  try {
    valid = await verifyPaypalWebhook(headers, rawBody);
  } catch {
    // No se pudo verificar (PayPal caído): 500 para que PayPal reintente; nunca se procesa sin firma.
    throw new ApiError(500, 'webhook_verification_unavailable');
  }
  if (!valid) throw new ApiError(401, 'invalid_signature');

  let event: PaypalEvent;
  try {
    event = JSON.parse(rawBody) as PaypalEvent;
  } catch {
    throw new ApiError(400, 'invalid_json');
  }
  if (!event.id || !event.event_type) throw new ApiError(400, 'invalid_event');

  const store = getStore();
  const sha = createHash('sha256').update(rawBody).digest('hex');
  if ((await store.claimWebhookEvent(event.id, event.event_type, sha)) === 'duplicate') return { handled: false, duplicate: true };

  try {
    const res = event.resource ?? {};
    const paypalOrderId = event.event_type === 'CHECKOUT.ORDER.APPROVED' ? res.id : res.supplementary_data?.related_ids?.order_id;
    const order = paypalOrderId ? await store.getOrderByPaypalOrderId(paypalOrderId) : null;
    let handled = true;

    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        // El comprador aprobó pero pudo cerrar la pestaña antes de capturar: captura el servidor.
        if (order) await settleOrder(store, order.id, { capture: true, schedule: deps.schedule });
        else handled = false;
        break;
      case 'PAYMENT.CAPTURE.COMPLETED':
        if (order) await settleOrder(store, order.id, { capture: false, schedule: deps.schedule });
        else handled = false;
        break;
      case 'PAYMENT.CAPTURE.PENDING':
        if (order && order.status === 'pending') await store.updateOrder(order.id, { last_error_class: 'capture_pending' });
        break;
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
        if (order) await failOrder(store, order, 'payment_denied');
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED':
        if (order) {
          await store.updateOrder(order.id, { status: 'refunded', last_error_class: event.event_type === 'PAYMENT.CAPTURE.REVERSED' ? 'reversed' : 'refunded' });
          await ownerNotice(order, event.event_type === 'PAYMENT.CAPTURE.REVERSED' ? 'PAGO REVERTIDO (contracargo)' : 'REEMBOLSO registrado', event.id);
        } else handled = false;
        break;
      case 'CUSTOMER.DISPUTE.CREATED':
        await disputeNotice(res.dispute_id ?? 'desconocido', event.id);
        break;
      default:
        handled = false;
    }
    await store.finishWebhookEvent(event.id, 'processed');
    return { handled, duplicate: false };
  } catch (err) {
    reportError('paypal_webhook_failed', { eventType: event.event_type, errorName: err instanceof Error ? err.name : 'unknown' }, { component: 'paypal' });
    await store.finishWebhookEvent(event.id, 'failed', 'processing_error');
    log.warn('paypal_webhook_failed', { eventType: event.event_type });
    throw new ApiError(500, 'webhook_processing_failed'); // PayPal reintentará
  }
}

async function ownerNotice(order: OrderRow, subject: string, eventId: string): Promise<void> {
  const owner = getEnv().ownerEmail;
  if (!owner) return;
  const mail = buildOwnerAlertEmail({
    subject,
    lines: [
      ['Pedido', order.id],
      ['PayPal order id', order.paypal_order_id ?? '—'],
      ['PayPal capture id', order.paypal_capture_id ?? '—'],
      ['Importe', `${(order.amount_minor / 100).toFixed(2)} ${order.currency}`],
      ['Entorno', order.sandbox ? 'SANDBOX' : 'LIVE'],
    ],
  });
  await sendEmail({ to: owner, subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `ma-${eventId}-notice`, tag: 'owner' });
}

async function disputeNotice(disputeId: string, eventId: string): Promise<void> {
  const owner = getEnv().ownerEmail;
  if (!owner) return;
  const mail = buildOwnerAlertEmail({ subject: 'DISPUTA ABIERTA EN PAYPAL', lines: [['Dispute id', disputeId]] });
  await sendEmail({ to: owner, subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `ma-${eventId}-dispute`, tag: 'owner' });
}
