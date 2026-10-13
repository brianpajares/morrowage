/**
 * Entrega del informe: genera el PDF, envía el email al usuario y (en validation / tras un pago)
 * la notificación operacional al dueño con PDF (FR-10, FR-11, AT-10, AT-13).
 *
 * Reglas de privacidad: el cuerpo del email al usuario no contiene datos de salud; los datos
 * sensibles solo viajan al buzón operacional del dueño; nada de esto va a analítica/admin/logs.
 */
import { getEnv } from '@/lib/env';
import { getModelSnapshot } from '@/lib/drive/loader';
import { log } from '@/lib/log';
import { reportError } from '@/lib/observability/report-error';
import { bucketMs } from '@/lib/analytics/events';
import { estimateReportCostMicroUsd } from '@/lib/ops/cost';
import { reportUrl, buildDataForReport } from './report';
import { sendEmail, type OutgoingEmail } from '@/server/email/send';
import { buildOwnerEmail, buildUserEmail } from '@/server/email/templates';
import { renderReportPdf } from '@/reports/pdf/render';
import { trackServer, utcDay } from '@/server/analytics';
import type { OrderRow, Store } from '@/server/store/types';

export type DeliveryMode = 'initial' | 'resend' | 'paid';

export interface DeliveryOutcome {
  ok: boolean;
  errorClass?: string;
  userEmailSent: boolean;
  ownerEmailSent: boolean;
  pdfAttached: boolean;
}

export async function deliverReport(
  store: Store,
  opts: { leadId: string; token: string; mode: DeliveryMode; order?: OrderRow; now?: Date },
): Promise<DeliveryOutcome> {
  const started = Date.now();
  const env = getEnv();
  const now = opts.now ?? new Date();
  const lead = await store.getLead(opts.leadId);
  const report = lead ? await store.getReportByLead(lead.id) : null;
  if (!lead || !report) return { ok: false, errorClass: 'not_found', userEmailSent: false, ownerEmailSent: false, pdfAttached: false };
  const calc = await store.getCalculation(report.calculation_id);
  if (!calc) return { ok: false, errorClass: 'calculation_gone', userEmailSent: false, ownerEmailSent: false, pdfAttached: false };

  const ctx = { locale: lead.locale, fallbackSessionId: calc.session_hash, market: calc.market_hint_coarse };
  await store.updateLead(lead.id, { status: 'generating' });

  // 1) PDF (si falla, el informe web sigue funcionando y el usuario recibe su enlace)
  let pdfBytes: Uint8Array | undefined;
  let pdfSha: string | undefined;
  try {
    const snapshot = await getModelSnapshot();
    const data = await buildDataForReport(calc, report, lead.locale);
    if (!data) throw new Error('payload_scrubbed');
    const rendered = await renderReportPdf({
      data,
      locale: lead.locale,
      params: snapshot.params,
      sources: snapshot.sources,
      tokenExpiresAt: report.token_expires_at,
      retentionDays: env.reportRetentionDays,
    });
    pdfBytes = rendered.bytes;
    pdfSha = rendered.sha256;
    await store.updateReport(report.id, { pdf_checksum_sha256: pdfSha });
  } catch (err) {
    reportError('pdf_generation_failed', { errorName: err instanceof Error ? err.name : 'unknown' }, { component: 'delivery' });
  }

  const kind = opts.mode === 'paid' ? 'paid' : 'validation';
  const url = reportUrl(lead.locale, opts.token);
  const stamp = opts.mode === 'resend' ? String(now.getTime()) : 'first';
  const pdfName = `MorrowAge-${report.verification_id}.pdf`;
  const pdfAttachment = pdfBytes ? [{ filename: pdfName, content: pdfBytes, contentType: 'application/pdf' }] : undefined;

  // 2) Email al usuario (enlace expirable; en pagos, además con PDF)
  const userMail = buildUserEmail({
    locale: lead.locale,
    reportUrl: url,
    verificationId: report.verification_id,
    expiresAt: new Date(report.token_expires_at),
    ttlDays: Math.max(1, Math.round(env.reportTokenTtlHours / 24)),
    kind,
    deleteUrl: `${env.appUrl}/${lead.locale}/privacy/delete-request`,
  });
  const userMsg: OutgoingEmail = {
    to: lead.email,
    subject: userMail.subject,
    html: userMail.html,
    text: userMail.text,
    idempotencyKey: `ma-${lead.id}-${opts.mode}-${stamp}-user`,
    tag: opts.mode === 'resend' ? 'resend' : 'user',
    ...(kind === 'paid' && pdfAttachment ? { attachments: pdfAttachment } : {}),
  };

  // 3) Email al dueño con inputs, resultados y PDF (solo en el primer envío / pago; no en reenvíos)
  const sendOwner = opts.mode !== 'resend' && Boolean(env.ownerEmail);
  const ownerMail = buildOwnerEmail({
    kind,
    verificationId: report.verification_id,
    leadId: lead.id,
    calculationId: calc.id,
    email: lead.email,
    locale: lead.locale,
    serviceConsentAt: lead.service_consent_at,
    marketingOptIn: lead.marketing_opt_in,
    marketingConsentAt: lead.marketing_consent_at,
    waitlistOptIn: lead.subscription_waitlist_opt_in,
    inputs: calc.input_payload,
    output: calc.output_payload,
    modelVersion: calc.model_version,
    appVersion: calc.app_version,
    pdfAttached: Boolean(pdfAttachment),
    ...(opts.order ? { order: { id: opts.order.id, amountMinor: opts.order.amount_minor, currency: opts.order.currency } } : {}),
  });

  const [userRes, ownerRes] = await Promise.all([
    sendEmail(userMsg),
    sendOwner
      ? sendEmail({
          to: env.ownerEmail!,
          subject: ownerMail.subject,
          html: ownerMail.html,
          text: ownerMail.text,
          replyTo: lead.email,
          idempotencyKey: `ma-${lead.id}-${opts.mode}-${stamp}-owner`,
          tag: 'owner',
          ...(pdfAttachment ? { attachments: pdfAttachment } : {}),
        })
      : Promise.resolve(null),
  ]);

  const userOk = userRes.ok;
  const ownerOk = ownerRes === null ? true : ownerRes.ok;
  const sentAt = new Date().toISOString();

  if (userOk) {
    await store.updateReport(report.id, { delivered_at: report.delivered_at ?? sentAt, last_sent_at: sentAt });
  }
  const errorClass = !userOk ? (userRes.ok ? undefined : userRes.errorClass) : !ownerOk && ownerRes && !ownerRes.ok ? `owner_${ownerRes.errorClass}` : undefined;

  await store.updateLead(lead.id, {
    status: userOk ? (opts.mode === 'paid' ? 'paid' : 'delivered') : 'failed',
    delivery_provider_id: userRes.ok ? userRes.providerId : null,
    delivery_error_class: errorClass ?? null,
  });

  // 4) Observabilidad sin PII: eventos allowlist + contadores de coste
  const latency = bucketMs(Date.now() - started);
  if (userOk) await trackServer('report_delivery_success', { provider: 'resend', latency_bucket: latency }, ctx);
  else await trackServer('report_delivery_fail', { provider: 'resend', error_class: (userRes.ok ? 'unknown' : userRes.errorClass).slice(0, 39) }, ctx);

  try {
    const emails = 1 + (sendOwner ? 1 : 0);
    await store.incrementCounter(utcDay(), lead.locale, 'ops_reports_generated', opts.mode, 1);
    await store.incrementCounter(utcDay(), lead.locale, 'ops_report_cost_micro_usd', opts.mode, estimateReportCostMicroUsd({ emails, stripe: opts.mode === 'paid' }));
  } catch {
    log.warn('cost_counter_failed');
  }

  return { ok: userOk && ownerOk, errorClass, userEmailSent: userOk, ownerEmailSent: ownerRes !== null && ownerRes.ok, pdfAttached: Boolean(pdfAttachment) };
}
