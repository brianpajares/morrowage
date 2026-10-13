/**
 * Store en memoria. SOLO para tests y desarrollo local sin Supabase (ver `getStore`).
 * Respeta las mismas restricciones de unicidad que el esquema SQL.
 */
import { randomUUID } from 'node:crypto';
import {
  UniqueViolationError,
  type AdminLeadSafe,
  type CalculationInsert,
  type CalculationRow,
  type DeletionRequestRow,
  type EraseResult,
  type FunnelCounterRow,
  type LeadCounts,
  type LeadInsert,
  type LeadRow,
  type OrderInsert,
  type OrderRow,
  type PurgeResult,
  type ReportInsert,
  type ReportRow,
  type Store,
} from './types';
import type { Locale } from '@/lib/locales';

const nowIso = () => new Date().toISOString();

export class MemoryStore implements Store {
  readonly kind = 'memory' as const;

  calculations = new Map<string, CalculationRow>();
  leads = new Map<string, LeadRow>();
  reports = new Map<string, ReportRow>();
  orders = new Map<string, OrderRow>();
  deletionRequests: DeletionRequestRow[] = [];
  admins = new Set<string>();
  auditLog: Array<Record<string, unknown>> = [];
  webhookEvents = new Map<string, { status: string; type: string; receivedAt: number }>();
  counters = new Map<string, FunnelCounterRow>();

  async insertCalculation(row: CalculationInsert): Promise<CalculationRow> {
    const rec: CalculationRow = { ...row, id: row.id ?? randomUUID(), created_at: nowIso() };
    this.calculations.set(rec.id, rec);
    return rec;
  }
  async getCalculation(id: string) {
    return this.calculations.get(id) ?? null;
  }

  async getLead(id: string) {
    return this.leads.get(id) ?? null;
  }
  async findLeadByCalculation(calculationId: string) {
    return [...this.leads.values()].find((l) => l.calculation_id === calculationId) ?? null;
  }
  async insertLead(row: LeadInsert): Promise<LeadRow> {
    if (!this.calculations.has(row.calculation_id)) throw new Error('fk_violation:calculation');
    const ts = nowIso();
    const rec: LeadRow = {
      ...row,
      email: row.email.toLowerCase(),
      id: randomUUID(),
      status: row.status ?? 'requested',
      delivery_provider_id: null,
      delivery_error_class: null,
      created_at: ts,
      updated_at: ts,
    };
    this.leads.set(rec.id, rec);
    return rec;
  }
  async updateLead(id: string, patch: Parameters<Store['updateLead']>[1]) {
    const cur = this.leads.get(id);
    if (!cur) throw new Error('not_found:lead');
    const next = { ...cur, ...patch, updated_at: nowIso() };
    this.leads.set(id, next);
    return next;
  }

  async insertReport(row: ReportInsert): Promise<ReportRow> {
    for (const r of this.reports.values()) {
      if (r.verification_id === row.verification_id) throw new UniqueViolationError('reports_verification_id_key');
      if (r.token_hash === row.token_hash) throw new UniqueViolationError('reports_token_hash_key');
    }
    const rec: ReportRow = {
      ...row,
      id: randomUUID(),
      generated_at: nowIso(),
      delivered_at: null,
      last_sent_at: null,
      pdf_checksum_sha256: null,
    };
    this.reports.set(rec.id, rec);
    return rec;
  }
  async getReport(id: string) {
    return this.reports.get(id) ?? null;
  }
  async getReportByTokenHash(hash: string) {
    return [...this.reports.values()].find((r) => r.token_hash === hash) ?? null;
  }
  async getReportByLead(leadId: string) {
    return [...this.reports.values()].find((r) => r.lead_id === leadId) ?? null;
  }
  async updateReport(id: string, patch: Parameters<Store['updateReport']>[1]) {
    const cur = this.reports.get(id);
    if (!cur) throw new Error('not_found:report');
    if (patch.token_hash) {
      for (const r of this.reports.values()) {
        if (r.id !== id && r.token_hash === patch.token_hash) throw new UniqueViolationError('reports_token_hash_key');
      }
    }
    const next = { ...cur, ...patch };
    this.reports.set(id, next);
    return next;
  }

  async listLeadsSafe(opts: { status?: LeadRow['status']; cursor?: string | null; limit: number }) {
    const rows: AdminLeadSafe[] = [...this.leads.values()]
      .filter((l) => !opts.status || l.status === opts.status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
      .map((l) => {
        const r = [...this.reports.values()].find((x) => x.lead_id === l.id);
        return {
          id: l.id,
          email: l.email,
          locale: l.locale,
          marketing_opt_in: l.marketing_opt_in,
          subscription_waitlist_opt_in: l.subscription_waitlist_opt_in,
          status: l.status,
          created_at: l.created_at,
          updated_at: l.updated_at,
          report_id: r?.id ?? null,
          verification_id: r?.verification_id ?? null,
          delivered_at: r?.delivered_at ?? null,
          last_sent_at: r?.last_sent_at ?? null,
        };
      });
    const start = opts.cursor ? Math.max(0, rows.findIndex((r) => `${r.created_at}|${r.id}` === opts.cursor) + 1) : 0;
    const page = rows.slice(start, start + opts.limit);
    const last = page.at(-1);
    const hasMore = start + opts.limit < rows.length;
    return { items: page, nextCursor: hasMore && last ? `${last.created_at}|${last.id}` : null };
  }

  async leadCounts(): Promise<LeadCounts> {
    const all = [...this.leads.values()];
    const byStatus: Record<string, number> = {};
    const byLocale: Record<string, number> = {};
    for (const l of all) {
      byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
      byLocale[l.locale] = (byLocale[l.locale] ?? 0) + 1;
    }
    return {
      total: all.length,
      byStatus,
      byLocale,
      marketingOptIns: all.filter((l) => l.marketing_opt_in).length,
      waitlistOptIns: all.filter((l) => l.subscription_waitlist_opt_in).length,
    };
  }

  async incrementCounter(day: string, locale: Locale, event: string, dim: string, by = 1) {
    const key = `${day}|${locale}|${event}|${dim}`;
    const cur = this.counters.get(key);
    this.counters.set(key, { day, locale, event, dim, count: (cur?.count ?? 0) + by });
  }
  async funnelCounters(sinceDay: string) {
    return [...this.counters.values()].filter((c) => c.day >= sinceDay);
  }

  async insertDeletionRequest(row: Pick<DeletionRequestRow, 'email' | 'locale' | 'verification_id'>) {
    const rec: DeletionRequestRow = {
      id: randomUUID(),
      email: row.email.toLowerCase(),
      locale: row.locale,
      verification_id: row.verification_id,
      status: 'received',
      created_at: nowIso(),
      resolved_at: null,
      resolution_note: null,
    };
    this.deletionRequests.push(rec);
    return rec;
  }

  async listDeletionRequests(limit: number) {
    return [...this.deletionRequests].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  }
  async getDeletionRequest(id: string) {
    return this.deletionRequests.find((d) => d.id === id) ?? null;
  }
  async updateDeletionRequest(id: string, patch: Parameters<Store['updateDeletionRequest']>[1]) {
    const cur = this.deletionRequests.find((d) => d.id === id);
    if (!cur) throw new Error('not_found:deletion_request');
    Object.assign(cur, patch);
    return cur;
  }
  async eraseByEmail(email: string): Promise<EraseResult> {
    const e = email.toLowerCase();
    const calcIds = new Set([...this.leads.values()].filter((l) => l.email === e).map((l) => l.calculation_id));
    const withOrders = new Set([...this.orders.values()].map((o) => o.calculation_id));
    let calculations = 0;
    let heldForLegal = 0;
    for (const id of calcIds) {
      if (withOrders.has(id)) {
        heldForLegal++;
        const c = this.calculations.get(id);
        if (c) {
          c.input_payload = {} as CalculationRow['input_payload'];
          c.output_payload = {} as CalculationRow['output_payload'];
        }
        continue;
      }
      this.calculations.delete(id);
      for (const l of [...this.leads.values()]) if (l.calculation_id === id) this.leads.delete(l.id);
      for (const r of [...this.reports.values()]) if (r.calculation_id === id) this.reports.delete(r.id);
      calculations++;
    }
    return { calculations, heldForLegal };
  }
  async listLeadsForRetry(opts: { olderThan: Date; newerThan: Date; limit: number }) {
    return [...this.leads.values()]
      .filter((l) => (l.status === 'requested' || l.status === 'failed') && new Date(l.created_at) < opts.olderThan && new Date(l.created_at) > opts.newerThan)
      .slice(0, opts.limit);
  }

  async isAdmin(userId: string) {
    return this.admins.has(userId);
  }
  async insertAuditLog(row: { admin_user_id: string; action: string; target_type: string; target_id: string | null; metadata_safe?: Record<string, unknown> }) {
    this.auditLog.push({ ...row, created_at: nowIso() });
  }

  async insertOrder(row: OrderInsert): Promise<OrderRow> {
    if (row.stripe_checkout_session_id) {
      for (const o of this.orders.values()) {
        if (o.stripe_checkout_session_id === row.stripe_checkout_session_id) throw new UniqueViolationError('orders_stripe_checkout_session_id_key');
      }
    }
    const ts = nowIso();
    const rec: OrderRow = {
      id: randomUUID(),
      lead_id: row.lead_id ?? null,
      calculation_id: row.calculation_id,
      stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
      stripe_payment_intent_id: null,
      amount_minor: row.amount_minor,
      currency: row.currency,
      status: row.status ?? 'pending',
      created_at: ts,
      paid_at: null,
      updated_at: ts,
    };
    this.orders.set(rec.id, rec);
    return rec;
  }
  async getOrder(id: string) {
    return this.orders.get(id) ?? null;
  }
  async getOrderByCheckoutSession(sessionId: string) {
    return [...this.orders.values()].find((o) => o.stripe_checkout_session_id === sessionId) ?? null;
  }
  async updateOrder(id: string, patch: Parameters<Store['updateOrder']>[1]) {
    const cur = this.orders.get(id);
    if (!cur) throw new Error('not_found:order');
    const next = { ...cur, ...patch, updated_at: nowIso() };
    this.orders.set(id, next);
    return next;
  }

  async claimWebhookEvent(eventId: string, eventType: string) {
    const cur = this.webhookEvents.get(eventId);
    const stale = cur && cur.status === 'processing' && Date.now() - cur.receivedAt > 10 * 60_000;
    if (cur && cur.status !== 'failed' && !stale) return 'duplicate' as const;
    this.webhookEvents.set(eventId, { status: 'processing', type: eventType, receivedAt: Date.now() });
    return 'claimed' as const;
  }
  async finishWebhookEvent(eventId: string, status: 'processed' | 'failed') {
    const cur = this.webhookEvents.get(eventId);
    if (cur) cur.status = status;
  }

  async purgeExpired(now: Date): Promise<PurgeResult> {
    let calculations = 0;
    let scrubbed = 0;
    const withOrders = new Set([...this.orders.values()].map((o) => o.calculation_id));
    for (const c of [...this.calculations.values()]) {
      if (new Date(c.expires_at) >= now) continue;
      if (withOrders.has(c.id)) {
        c.input_payload = {} as CalculationRow['input_payload'];
        c.output_payload = {} as CalculationRow['output_payload'];
        scrubbed++;
        continue;
      }
      this.calculations.delete(c.id);
      for (const l of [...this.leads.values()]) if (l.calculation_id === c.id) this.leads.delete(l.id);
      for (const r of [...this.reports.values()]) if (r.calculation_id === c.id) this.reports.delete(r.id);
      calculations++;
    }
    return { calculations, scrubbed };
  }

  async ping() {
    return true;
  }
}
