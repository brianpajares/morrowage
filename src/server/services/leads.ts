/**
 * POST /api/leads — modo validation (FR-08, FR-09, AT-09, AT-10).
 * Crea el lead con consentimiento de servicio, emite el informe (token hasheado) y programa la
 * entrega (PDF + email usuario + email dueño) fuera de la petición para mantener p95 < 2 s.
 * El marketing y la lista de espera son opt-ins separados y opcionales.
 */
import { z } from 'zod';
import { emailSchema } from '@/lib/validation';
import { getEnv } from '@/lib/env';
import { LOCALES } from '@/lib/locales';
import { hashForKey, hashSession, safeEqual } from '@/lib/security/tokens';
import { POLICIES } from '@/lib/security/ratelimit';
import { trackServer } from '@/server/analytics';
import { ApiError, enforceRateLimit } from '@/server/http';
import { deliverReport } from './delivery';
import { issueReport, reportUrl, rotateReportToken } from './report';
import { getStore } from '@/server/store';

const bodySchema = z.strictObject({
  calculationId: z.uuid(),
  email: emailSchema,
  locale: z.enum(LOCALES),
  serviceConsent: z.literal(true),
  marketingOptIn: z.boolean().default(false),
  subscriptionWaitlistOptIn: z.boolean().default(false),
});

export interface CreateLeadResult {
  leadId: string;
  status: 'accepted';
  reportUrl: string;
}

export async function createLeadService(
  opts: { body: unknown; sessionId?: string; psid?: string; deviceClass?: 'mobile' | 'tablet' | 'desktop' },
  deps: { schedule: (task: () => Promise<unknown>) => void },
): Promise<CreateLeadResult> {
  const env = getEnv();
  if (env.stripeActive) throw new ApiError(409, 'leads_disabled');

  const parsed = bodySchema.safeParse(opts.body);
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((i) => i.path[0] === 'email');
    const consentIssue = parsed.error.issues.some((i) => i.path[0] === 'serviceConsent');
    throw new ApiError(400, emailIssue ? 'invalid_email' : consentIssue ? 'consent_required' : 'invalid_request');
  }
  const b = parsed.data;
  await enforceRateLimit(POLICIES.leadsPerEmail, hashForKey(b.email, env.sessionPepper));

  const store = getStore();
  const calc = await store.getCalculation(b.calculationId);
  if (!calc || new Date(calc.expires_at) <= new Date()) throw new ApiError(404, 'calculation_not_found');

  // El cálculo solo puede reclamarlo el navegador que lo creó (cookie HttpOnly → hash de sesión).
  if (!opts.sessionId || !safeEqual(hashSession(opts.sessionId, env.sessionPepper), calc.session_hash)) {
    throw new ApiError(403, 'session_mismatch');
  }

  const ctx = { locale: b.locale, psid: opts.psid, fallbackSessionId: calc.session_hash, market: calc.market_hint_coarse, deviceClass: opts.deviceClass };
  const now = new Date();

  let lead = await store.findLeadByCalculation(calc.id);
  if (lead && lead.email !== b.email) throw new ApiError(409, 'calculation_already_requested');

  if (!lead) {
    lead = await store.insertLead({
      calculation_id: calc.id,
      email: b.email,
      locale: b.locale,
      service_consent_at: now.toISOString(),
      marketing_opt_in: b.marketingOptIn,
      marketing_consent_at: b.marketingOptIn ? now.toISOString() : null,
      subscription_waitlist_opt_in: b.subscriptionWaitlistOptIn,
    });
    await trackServer('email_submit', { marketing_opt_in: b.marketingOptIn }, ctx);
  }

  // Idempotente: si el informe ya existe se rota el token (el enlace anterior deja de valer).
  const existing = await store.getReportByLead(lead.id);
  const issued = existing ? await rotateReportToken(store, existing, now) : await issueReport(store, calc, lead.id, 'validation_full', now);

  const leadId = lead.id;
  deps.schedule(() => deliverReport(store, { leadId, token: issued.token, mode: 'initial', now }));

  return { leadId, status: 'accepted', reportUrl: reportUrl(lead.locale, issued.token) };
}
