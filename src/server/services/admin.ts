/**
 * Servicios del panel admin (FR-14, AT-16, AT-17). Autenticación con Supabase Auth (cookie de
 * sesión o Bearer JWT) + pertenencia a `admin_users`. Los datos se leen con service role SOLO tras
 * autorizar y únicamente de la proyección segura: sin inputs, resultados crudos ni tokens/URLs.
 */
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { getEnv } from '@/lib/env';
import { summarizeFunnel, type FunnelSummary } from '@/lib/ops/funnel';
import { safeEqual } from '@/lib/security/tokens';
import { ApiError, parseCookies } from '@/server/http';
import { getStore } from '@/server/store';
import type { AdminLeadSafe, DeletionRequestRow, LeadStatus } from '@/server/store/types';
import { deliverReport } from './delivery';
import { rotateReportToken } from './report';

export interface AdminIdentity {
  userId: string;
  email: string | null;
}

async function userFromRequest(req: Request): Promise<{ id: string; email: string | null } | null> {
  const env = getEnv();

  // Identidad simulada SOLO con APP_ENV=test (nunca en producción: getEnv lo prohíbe).
  if (env.appEnv === 'test') {
    const id = req.headers.get('x-test-user');
    return id ? { id, email: `${id}@morrowage.test` } : null;
  }

  const { supabaseUrl, supabaseAnonKey } = env;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
  if (bearer) {
    const anon = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.auth.getUser(bearer);
    return error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null };
  }

  const jar = parseCookies(req.headers.get('cookie'));
  const all = Object.entries(jar).map(([name, value]) => ({ name, value }));
  if (!all.some((c) => c.name.startsWith('sb-'))) return null;
  const supa = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { getAll: () => all, setAll: () => undefined } });
  const { data, error } = await supa.auth.getUser();
  return error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null };
}

/** 401 si no hay sesión; 403 si hay sesión pero no es admin. */
export async function requireAdmin(req: Request): Promise<AdminIdentity> {
  const user = await userFromRequest(req);
  if (!user) throw new ApiError(401, 'unauthorized');
  if (!(await getStore().isAdmin(user.id))) throw new ApiError(403, 'forbidden');
  return { userId: user.id, email: user.email };
}

export async function listLeads(opts: { status?: LeadStatus; cursor?: string | null; limit?: number }) {
  const { items, nextCursor } = await getStore().listLeadsSafe({ status: opts.status, cursor: opts.cursor ?? null, limit: Math.min(opts.limit ?? 50, 100) });
  return { items: items.map(toAdminLead), nextCursor };
}

export interface AdminLeadView {
  id: string;
  email: string;
  locale: string;
  status: string;
  marketingOptIn: boolean;
  subscriptionWaitlistOptIn: boolean;
  createdAt: string;
  lastSentAt: string | null;
  reportId: string | null;
  verificationId: string | null;
}

/** Whitelist explícita de campos: lo que no está aquí no puede filtrarse al panel. */
function toAdminLead(r: AdminLeadSafe): AdminLeadView {
  return {
    id: r.id,
    email: r.email,
    locale: r.locale,
    status: r.status,
    marketingOptIn: r.marketing_opt_in,
    subscriptionWaitlistOptIn: r.subscription_waitlist_opt_in,
    createdAt: r.created_at,
    lastSentAt: r.last_sent_at,
    reportId: r.report_id,
    verificationId: r.verification_id,
  };
}

export async function funnel(windowDays = 14): Promise<FunnelSummary> {
  const store = getStore();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const [counters, leads] = await Promise.all([store.funnelCounters(since), store.leadCounts()]);
  return summarizeFunnel(counters, leads, windowDays);
}

/** Resumen de ventas (PayPal): solo importes y contadores; sin emails ni datos de salud. */
export async function sales() {
  return getStore().salesSummary();
}

export async function resendReport(admin: AdminIdentity, reportId: string, deps: { schedule: (t: () => Promise<unknown>) => void }) {
  const store = getStore();
  const report = await store.getReport(reportId);
  if (!report || !report.lead_id) throw new ApiError(404, 'report_not_found');
  const lead = await store.getLead(report.lead_id);
  if (!lead || lead.status === 'deleted') throw new ApiError(404, 'report_not_found');

  // Se rota el token (el enlace anterior deja de valer) y se reproduce el correo de entrega.
  const issued = await rotateReportToken(store, report);
  await store.insertAuditLog({ admin_user_id: admin.userId, action: 'report.resend', target_type: 'report', target_id: report.id });
  deps.schedule(() => deliverReport(store, { leadId: lead.id, token: issued.token, mode: 'resend' }));
  return { status: 'accepted' as const };
}

export async function listDeletionRequests(): Promise<DeletionRequestRow[]> {
  return getStore().listDeletionRequests(50);
}

/** Ejecuta el borrado de un solicitante: elimina cálculos/leads/informes, salvo retención legal (pedidos). */
export async function resolveDeletion(admin: AdminIdentity, requestId: string) {
  const store = getStore();
  const req = await store.getDeletionRequest(requestId);
  if (!req) throw new ApiError(404, 'not_found');
  if (req.status === 'completed' || req.status === 'rejected_legal_hold') return req;

  const res = await store.eraseByEmail(req.email);
  const status = res.heldForLegal > 0 && res.calculations === 0 ? 'rejected_legal_hold' : 'completed';
  const note = `borrado: ${res.calculations} cálculos; retenidos por obligación legal: ${res.heldForLegal}`;
  const updated = await store.updateDeletionRequest(requestId, { status, resolved_at: new Date().toISOString(), resolution_note: note });
  await store.insertAuditLog({ admin_user_id: admin.userId, action: 'deletion.resolve', target_type: 'deletion_request', target_id: requestId, metadata_safe: { status } });
  return updated;
}

export function isCronAuthorized(req: Request): boolean {
  const secret = getEnv().cronSecret;
  return Boolean(secret) && safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`);
}
