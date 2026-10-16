/**
 * Entrega de un pedido PayPal pagado (playbook §2): PDF completo al cliente + aviso
 * «VENTA CONFIRMADA» al dueño. Idempotente y segura frente a concurrencia:
 *  - `claimOrderFulfillment` (SQL atómico) da la entrega en exclusiva a UN proceso a la vez, aunque
 *    coincidan la captura del navegador, el webhook y el cron;
 *  - los correos llevan Idempotency-Key por pedido (Resend no duplica en 24 h);
 *  - si el correo al cliente falla queda `failed` y el cron lo reintenta; si solo falla el aviso al
 *    dueño, el reintento envía únicamente ese aviso (el cliente no recibe dos correos).
 */
import { getEnv } from '@/lib/env';
import { getModelSnapshot } from '@/lib/drive/loader';
import { log } from '@/lib/log';
import { reportError } from '@/lib/observability/report-error';
import { bucketMs } from '@/lib/analytics/events';
import { estimateReportCostMicroUsd } from '@/lib/ops/cost';
import { renderReportPdf } from '@/reports/pdf/render';
import { sendEmail } from '@/server/email/send';
import { buildOwnerAlertEmail, buildSaleEmail, buildUserEmail } from '@/server/email/templates';
import { trackServer, utcDay } from '@/server/analytics';
import type { Store } from '@/server/store/types';
import { buildDataForReport, reportUrl, rotateReportToken } from './report';

export interface FulfillOutcome {
  /** false si otro proceso ya tenía la entrega (no es un error). */
  claimed: boolean;
  delivered: boolean;
  userEmailSent: boolean;
  ownerEmailSent: boolean;
}

const NOT_CLAIMED: FulfillOutcome = { claimed: false, delivered: false, userEmailSent: false, ownerEmailSent: false };

export async function fulfillPaidOrder(store: Store, orderId: string, opts: { token?: string; now?: Date } = {}): Promise<FulfillOutcome> {
  const env = getEnv();
  const now = opts.now ?? new Date();
  const started = Date.now();

  if (!(await store.claimOrderFulfillment(orderId))) return NOT_CLAIMED;

  const order = await store.getOrder(orderId);
  const lead = order?.lead_id ? await store.getLead(order.lead_id) : null;
  const report = lead ? await store.getReportByLead(lead.id) : null;
  const calc = order ? await store.getCalculation(order.calculation_id) : null;
  if (!order || !lead || !report || !calc) {
    await store.updateOrder(orderId, { fulfillment_status: 'failed', last_error_class: 'order_data_missing' });
    reportError('fulfillment_data_missing', {}, { component: 'fulfillment' });
    return { ...NOT_CLAIMED, claimed: true };
  }

  const ctx = { locale: lead.locale, fallbackSessionId: calc.session_hash, market: calc.market_hint_coarse };

  // Pago duplicado (dos pedidos pagados para el mismo cálculo): no se vuelve a entregar; avisa al dueño.
  const siblings = await store.listOrdersByCalculation(order.calculation_id);
  if (siblings.some((o) => o.id !== order.id && o.status === 'paid' && o.fulfillment_status === 'delivered')) {
    if (env.ownerEmail) {
      const alert = buildOwnerAlertEmail({
        subject: `PAGO DUPLICADO · reembolsar ${order.id}`,
        lines: [
          ['Pedido duplicado', order.id],
          ['PayPal order id', order.paypal_order_id ?? '—'],
          ['PayPal capture id', order.paypal_capture_id ?? '—'],
          ['Importe', `${(order.amount_minor / 100).toFixed(2)} ${order.currency}`],
          ['Verification ID', report.verification_id],
          ['Entorno', order.sandbox ? 'SANDBOX' : 'LIVE'],
        ],
      });
      await sendEmail({ to: env.ownerEmail, subject: alert.subject, html: alert.html, text: alert.text, idempotencyKey: `ma-${order.id}-duplicate`, tag: 'owner' });
    }
    await store.updateOrder(orderId, { fulfillment_status: 'delivered', last_error_class: 'duplicate_payment' });
    return { claimed: true, delivered: true, userEmailSent: false, ownerEmailSent: Boolean(env.ownerEmail) };
  }

  const ownerOnly = order.last_error_class === 'owner_email_failed';
  let userOk = ownerOnly;
  let pdfNote: string | undefined;

  if (!ownerOnly) {
    // 1) Token vigente del informe pagado (si el caller no lo trae, se rota: el enlace anterior caduca).
    let token = opts.token;
    if (!token) token = (await rotateReportToken(store, report, now, 'paid_full')).token;

    // 2) PDF completo
    let pdf: Uint8Array | undefined;
    try {
      const snapshot = await getModelSnapshot();
      const fresh = await store.getReport(report.id);
      const data = fresh ? await buildDataForReport(calc, fresh, lead.locale) : null;
      if (!data) throw new Error('payload_scrubbed');
      pdf = (
        await renderReportPdf({ data, locale: lead.locale, params: snapshot.params, sources: snapshot.sources, tokenExpiresAt: fresh!.token_expires_at, retentionDays: env.reportRetentionDays })
      ).bytes;
    } catch (err) {
      pdfNote = 'No se pudo generar el PDF adjunto; el cliente recibió el enlace al informe web.';
      reportError('pdf_generation_failed', { errorName: err instanceof Error ? err.name : 'unknown' }, { component: 'fulfillment' });
    }

    // 3) Correo al cliente
    const refreshed = (await store.getReport(report.id)) ?? report;
    const mail = buildUserEmail({
      locale: lead.locale,
      reportUrl: reportUrl(lead.locale, token),
      verificationId: report.verification_id,
      expiresAt: new Date(refreshed.token_expires_at),
      ttlDays: env.reportRetentionDays,
      kind: 'paid',
      deleteUrl: `${env.appUrl}/${lead.locale}/privacy/delete-request`,
    });
    const res = await sendEmail({
      to: lead.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      idempotencyKey: `ma-${order.id}-paid-user-${order.fulfillment_attempts}`,
      tag: 'user',
      ...(pdf ? { attachments: [{ filename: `MorrowAge-${report.verification_id}.pdf`, content: pdf, contentType: 'application/pdf' }] } : {}),
    });
    userOk = res.ok;
    if (res.ok) {
      const sentAt = new Date().toISOString();
      await store.updateReport(report.id, { delivered_at: refreshed.delivered_at ?? sentAt, last_sent_at: sentAt });
      await store.updateLead(lead.id, { status: 'paid', delivery_provider_id: res.providerId, delivery_error_class: null });
      await trackServer('report_delivery_success', { provider: 'resend', latency_bucket: bucketMs(Date.now() - started) }, ctx);
    } else {
      await store.updateLead(lead.id, { delivery_error_class: res.errorClass });
      await trackServer('report_delivery_fail', { provider: 'resend', error_class: res.errorClass.slice(0, 39) }, ctx);
    }
  }

  // 4) Aviso de venta al dueño (tras intentar entregar, para reflejar el estado real)
  let ownerOk = true;
  if (env.ownerEmail) {
    const sale = buildSaleEmail({
      verificationId: report.verification_id,
      orderId: order.id,
      paypalOrderId: order.paypal_order_id,
      captureId: order.paypal_capture_id,
      amountMinor: order.amount_minor,
      currency: order.currency,
      sandbox: order.sandbox,
      delivered: userOk,
      email: lead.email,
      paidAt: order.paid_at,
      ...(pdfNote ? { deliveryNote: pdfNote } : {}),
    });
    const res = await sendEmail({
      to: env.ownerEmail,
      subject: sale.subject,
      html: sale.html,
      text: sale.text,
      replyTo: lead.email,
      idempotencyKey: `ma-${order.id}-sale-${userOk ? 'ok' : 'pending'}-${order.fulfillment_attempts}`,
      tag: 'owner',
    });
    ownerOk = res.ok;
  }

  const delivered = userOk && ownerOk;
  await store.updateOrder(order.id, {
    fulfillment_status: delivered ? 'delivered' : 'failed',
    last_error_class: delivered ? null : !userOk ? 'user_email_failed' : 'owner_email_failed',
  });

  try {
    await store.incrementCounter(utcDay(), lead.locale, 'ops_reports_generated', 'paid', 1);
    await store.incrementCounter(utcDay(), lead.locale, 'ops_report_cost_micro_usd', 'paid', estimateReportCostMicroUsd({ emails: 2, stripe: true }));
  } catch {
    log.warn('cost_counter_failed');
  }

  return { claimed: true, delivered, userEmailSent: userOk, ownerEmailSent: ownerOk };
}
