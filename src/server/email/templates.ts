/**
 * Plantillas transaccionales (FR-10, FR-11, §18). HTML con estilos inline + versión texto.
 *  - Usuario: ES/EN/PT; solo enlace expirable (sin datos de salud en el cuerpo).
 *  - Owner (validation): operacional, en español; contiene inputs, resultados y PDF (sensible).
 *    Nunca va a analítica/admin/logs: este módulo solo construye el mensaje.
 */
import { createTranslator, type AbstractIntlMessages } from 'next-intl';
import { INTL_TAG, type Locale } from '@/lib/locales';
import { getMessages } from '@/messages';
import type { ModelOutput } from '@/lib/model/engine';
import type { Inputs } from '@/lib/model/input-spec';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

type Translate = (key: string, values?: Record<string, string | number>) => string;

function tr(locale: Locale, namespace: string): Translate {
  return createTranslator({
    locale,
    messages: getMessages(locale) as unknown as AbstractIntlMessages,
    namespace,
  }) as unknown as Translate;
}

const BRAND = '#0F766E';

function shell(opts: { lang: string; title: string; preheader: string; body: string; footer: string }): string {
  return `<!doctype html>
<html lang="${esc(opts.lang)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(opts.title)}</title></head>
<body style="margin:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F172A;">
<span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #CBD5E1;border-radius:16px;overflow:hidden;">
<tr><td style="background:${BRAND};padding:20px 28px;color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:-0.02em;">MorrowAge</td></tr>
<tr><td style="padding:28px;">${opts.body}</td></tr>
<tr><td style="padding:0 28px 28px;color:#475569;font-size:12px;line-height:1.5;border-top:1px solid #E2E8F0;">${opts.footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:${BRAND};border-radius:12px;">
<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;color:#FFFFFF;font-weight:700;font-size:16px;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export interface UserEmailInput {
  locale: Locale;
  reportUrl: string;
  verificationId: string;
  expiresAt: Date;
  ttlDays: number;
  kind: 'validation' | 'paid';
  deleteUrl: string;
}

export function buildUserEmail(i: UserEmailInput): EmailContent {
  const c = tr(i.locale, 'emails.common');
  const u = tr(i.locale, i.kind === 'paid' ? 'emails.paid' : 'emails.user');
  const date = formatDate(i.expiresAt, i.locale);
  const subject = u('subject');
  const preheader = u('preheader', { days: i.ttlDays });
  const expiry = c('expiry', { days: i.ttlDays, date });
  const pdfNote = i.kind === 'paid' ? tr(i.locale, 'emails.paid')('pdfAttached') : c('pdfNote');

  const body = `
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;letter-spacing:-0.02em;">${esc(u('title'))}</h1>
<p style="margin:0 0 8px;font-size:16px;line-height:1.6;">${esc(u('intro'))}</p>
${button(i.reportUrl, c('openReport'))}
<p style="margin:0 0 6px;font-size:13px;color:#475569;">${esc(c('linkFallback'))}</p>
<p style="margin:0 0 18px;font-size:13px;word-break:break-all;"><a href="${esc(i.reportUrl)}" style="color:${BRAND};">${esc(i.reportUrl)}</a></p>
<p style="margin:0 0 10px;font-size:14px;line-height:1.6;">${esc(expiry)}</p>
<p style="margin:0 0 10px;font-size:14px;line-height:1.6;">${esc(pdfNote)}</p>
<p style="margin:0 0 10px;font-size:14px;line-height:1.6;"><strong>${esc(c('verificationId'))}:</strong> ${esc(i.verificationId)}</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#475569;">${esc(c('notBio'))}</p>`;

  const footer = `${esc(c('whyReceived'))}<br>${esc(c('deleteData', { url: i.deleteUrl }))}<br><br>${esc(c('disclaimer'))}`;

  const text = [
    u('title'),
    '',
    u('intro'),
    '',
    `${c('openReport')}: ${i.reportUrl}`,
    '',
    expiry,
    pdfNote,
    `${c('verificationId')}: ${i.verificationId}`,
    '',
    c('notBio'),
    '',
    '--',
    c('whyReceived'),
    c('deleteData', { url: i.deleteUrl }),
    c('disclaimer'),
  ].join('\n');

  return { subject, html: shell({ lang: i.locale, title: u('title'), preheader, body, footer }), text };
}

export interface OwnerEmailInput {
  kind: 'validation' | 'paid';
  verificationId: string;
  leadId: string;
  calculationId: string;
  email: string;
  locale: Locale;
  serviceConsentAt: string;
  marketingOptIn: boolean;
  marketingConsentAt: string | null;
  waitlistOptIn: boolean;
  inputs: Inputs;
  output: ModelOutput;
  modelVersion: string;
  appVersion: string;
  pdfAttached: boolean;
  order?: { id: string; amountMinor: number; currency: string };
}

export const OWNER_SUBJECT_PREFIX = '[MorrowAge] Solicitud de informe';

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 10px;border-bottom:1px solid #E2E8F0;color:#475569;font-size:13px;width:44%;">${esc(label)}</td><td style="padding:6px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;font-family:ui-monospace,Menlo,Consolas,monospace;">${esc(value)}</td></tr>`;
}

function section(title: string, rows: Array<[string, string]>): string {
  return `<h2 style="margin:22px 0 8px;font-size:16px;">${esc(title)}</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:8px;border-collapse:separate;">${rows.map(([k, v]) => row(k, v)).join('')}</table>`;
}

/** Correo operacional al dueño. Asunto exacto: `[MorrowAge] Solicitud de informe <id>` (AT-13). */
export function buildOwnerEmail(i: OwnerEmailInput): EmailContent {
  const subject = `${OWNER_SUBJECT_PREFIX} ${i.verificationId}`;
  const o = i.output;

  const meta: Array<[string, string]> = [
    ['Tipo', i.kind === 'paid' ? 'Compra (Stripe)' : 'Validation (gratis)'],
    ['Verification ID', i.verificationId],
    ['Lead ID', i.leadId],
    ['Calculation ID', i.calculationId],
    ['Email del usuario', i.email],
    ['Idioma (locale)', i.locale],
    ['Consentimiento de servicio', i.serviceConsentAt],
    ['Marketing opt-in', i.marketingOptIn ? `sí (${i.marketingConsentAt ?? 'sin fecha'})` : 'no'],
    ['Lista de espera suscripción', i.waitlistOptIn ? 'sí' : 'no'],
    ['Versión modelo / app', `${i.modelVersion} / ${i.appVersion}`],
  ];
  if (i.order) meta.push(['Pedido', `${i.order.id} · ${(i.order.amountMinor / 100).toFixed(2)} ${i.order.currency.toUpperCase()}`]);

  const inputRows = (Object.entries(i.inputs) as Array<[string, string | number]>).map(([k, v]): [string, string] => [k, String(v)]);
  const resultRows: Array<[string, string]> = [
    ['morrow_age (RAW, solo auditoría)', String(o.morrow_age)],
    ['morrow_age_display (lo que ve el usuario)', o.morrow_age_display],
    ['morrow_age_status', o.morrow_age_status],
    ['delta_age (RAW)', String(o.delta_age)],
    ['relative_hazard', String(o.relative_hazard)],
    ['eta_nonage', String(o.eta_nonage)],
    ['delta_lp', String(o.delta_lp)],
    ['top_driver', `${o.top_driver.name} (${o.top_driver.log_hazard_contribution})`],
    ...(Object.entries(o.drivers) as Array<[string, number]>).map(([k, v]): [string, string] => [`driver · ${k}`, String(v)]),
    ['sensibilidad low / base / high (RAW)', `${o.measurement_sensitivity.morrow_age_low} / ${o.measurement_sensitivity.morrow_age_base} / ${o.measurement_sensitivity.morrow_age_high}`],
    ['mortalidad absoluta 10 años', 'BLOQUEADA (no disponible en v1)'],
  ];

  const body = `
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;">Solicitud de informe ${esc(i.verificationId)}</h1>
<p style="margin:0 0 12px;padding:12px 14px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;font-size:13px;line-height:1.5;color:#78350F;"><strong>Dato sensible.</strong> Contiene email y datos de salud del usuario. Buzón operacional de acceso mínimo: no reenviar, no copiar a analítica ni a herramientas de soporte. Retención operativa limitada.</p>
${section('Solicitud', meta)}
${section('Inputs canónicos', inputRows)}
${section('Resultados (incluye valores RAW de auditoría)', resultRows)}
<p style="margin:18px 0 0;font-size:13px;color:#475569;">${i.pdfAttached ? 'El PDF completo del informe va adjunto.' : 'No se pudo generar el PDF adjunto; el informe web sigue disponible. Reenvía desde /admin.'}</p>`;

  const footer = 'MorrowAge · notificación operacional (validation). No responder a este mensaje.';

  const text = [
    `Solicitud de informe ${i.verificationId}`,
    '',
    'DATO SENSIBLE: contiene email y datos de salud. Buzón operacional de acceso mínimo.',
    '',
    '== Solicitud ==',
    ...meta.map(([k, v]) => `${k}: ${v}`),
    '',
    '== Inputs canónicos ==',
    ...inputRows.map(([k, v]) => `${k}: ${v}`),
    '',
    '== Resultados (RAW de auditoría) ==',
    ...resultRows.map(([k, v]) => `${k}: ${v}`),
    '',
    i.pdfAttached ? 'PDF completo adjunto.' : 'PDF no adjunto (fallo de generación).',
  ].join('\n');

  return { subject, html: shell({ lang: 'es', title: subject, preheader: `Solicitud ${i.verificationId}`, body, footer }), text };
}
