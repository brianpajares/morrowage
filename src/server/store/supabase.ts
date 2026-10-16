import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/lib/locales';
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
  type LeadStatus,
  type MarkPaidResult,
  type OrderInsert,
  type OrderRow,
  type SalesSummary,
  type PurgeResult,
  type ReportInsert,
  type ReportRow,
  type Store,
} from './types';

interface PgError {
  code?: string;
  message: string;
  details?: string | null;
}

function fail(error: PgError, op: string): never {
  if (error.code === '23505') throw new UniqueViolationError(/\(([^)]+)\)/.exec(error.details ?? '')?.[1] ?? op);
  // Solo el código y la operación: el mensaje de PostgREST puede incluir valores de filas.
  throw new Error(`db_error:${op}:${error.code ?? 'unknown'}`);
}

const CURSOR_RE = /^(\d{4}-\d{2}-\d{2}T[0-9:.+Z-]+)\|([0-9a-f-]{36})$/i;

export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-application-name': 'morrowage-server' } },
    });
  }

  async insertCalculation(row: CalculationInsert): Promise<CalculationRow> {
    const { data, error } = await this.db.from('calculations').insert(row).select().single();
    if (error) fail(error, 'insert_calculation');
    return data as CalculationRow;
  }
  async getCalculation(id: string) {
    const { data, error } = await this.db.from('calculations').select('*').eq('id', id).maybeSingle();
    if (error) fail(error, 'get_calculation');
    return (data as CalculationRow | null) ?? null;
  }

  async getLead(id: string) {
    const { data, error } = await this.db.from('leads').select('*').eq('id', id).maybeSingle();
    if (error) fail(error, 'get_lead');
    return (data as LeadRow | null) ?? null;
  }
  async findLeadByCalculation(calculationId: string) {
    const { data, error } = await this.db
      .from('leads')
      .select('*')
      .eq('calculation_id', calculationId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) fail(error, 'find_lead');
    return (data as LeadRow | null) ?? null;
  }
  async insertLead(row: LeadInsert) {
    const { data, error } = await this.db.from('leads').insert({ ...row, email: row.email.toLowerCase() }).select().single();
    if (error) fail(error, 'insert_lead');
    return data as LeadRow;
  }
  async updateLead(id: string, patch: Parameters<Store['updateLead']>[1]) {
    const { data, error } = await this.db.from('leads').update(patch).eq('id', id).select().single();
    if (error) fail(error, 'update_lead');
    return data as LeadRow;
  }

  async insertReport(row: ReportInsert) {
    const { data, error } = await this.db.from('reports').insert(row).select().single();
    if (error) fail(error, 'insert_report');
    return data as ReportRow;
  }
  async getReport(id: string) {
    const { data, error } = await this.db.from('reports').select('*').eq('id', id).maybeSingle();
    if (error) fail(error, 'get_report');
    return (data as ReportRow | null) ?? null;
  }
  async getReportByTokenHash(hash: string) {
    const { data, error } = await this.db.from('reports').select('*').eq('token_hash', hash).maybeSingle();
    if (error) fail(error, 'get_report_by_token');
    return (data as ReportRow | null) ?? null;
  }
  async getReportByLead(leadId: string) {
    const { data, error } = await this.db
      .from('reports')
      .select('*')
      .eq('lead_id', leadId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail(error, 'get_report_by_lead');
    return (data as ReportRow | null) ?? null;
  }
  async updateReport(id: string, patch: Parameters<Store['updateReport']>[1]) {
    const { data, error } = await this.db.from('reports').update(patch).eq('id', id).select().single();
    if (error) fail(error, 'update_report');
    return data as ReportRow;
  }

  async listLeadsSafe(opts: { status?: LeadStatus; cursor?: string | null; limit: number }) {
    let q = this.db
      .from('admin_leads_safe')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(opts.limit + 1);
    if (opts.status) q = q.eq('status', opts.status);
    if (opts.cursor) {
      const m = CURSOR_RE.exec(opts.cursor);
      if (!m) throw new Error('invalid_cursor');
      // Ambas partes pasaron una regex estricta: no hay inyección en el filtro PostgREST.
      q = q.or(`created_at.lt.${m[1]},and(created_at.eq.${m[1]},id.lt.${m[2]})`);
    }
    const { data, error } = await q;
    if (error) fail(error, 'list_leads');
    const rows = (data ?? []) as AdminLeadSafe[];
    const items = rows.slice(0, opts.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > opts.limit && last ? `${last.created_at}|${last.id}` : null };
  }

  async leadCounts(): Promise<LeadCounts> {
    const { data, error } = await this.db.from('leads').select('status,locale,marketing_opt_in,subscription_waitlist_opt_in');
    if (error) fail(error, 'lead_counts');
    const rows = (data ?? []) as Array<Pick<LeadRow, 'status' | 'locale' | 'marketing_opt_in' | 'subscription_waitlist_opt_in'>>;
    const byStatus: Record<string, number> = {};
    const byLocale: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byLocale[r.locale] = (byLocale[r.locale] ?? 0) + 1;
    }
    return {
      total: rows.length,
      byStatus,
      byLocale,
      marketingOptIns: rows.filter((r) => r.marketing_opt_in).length,
      waitlistOptIns: rows.filter((r) => r.subscription_waitlist_opt_in).length,
    };
  }

  async incrementCounter(day: string, locale: Locale, event: string, dim: string, by = 1) {
    const { error } = await this.db.rpc('increment_funnel_counter', {
      p_day: day,
      p_locale: locale,
      p_event: event,
      p_dim: dim,
      p_by: by,
    });
    if (error) fail(error, 'increment_counter');
  }
  async funnelCounters(sinceDay: string) {
    const { data, error } = await this.db.from('funnel_counters').select('*').gte('day', sinceDay);
    if (error) fail(error, 'funnel_counters');
    return ((data ?? []) as Array<FunnelCounterRow & { count: number | string }>).map((r) => ({ ...r, count: Number(r.count) }));
  }

  async insertDeletionRequest(row: Pick<DeletionRequestRow, 'email' | 'locale' | 'verification_id'>) {
    const { data, error } = await this.db
      .from('deletion_requests')
      .insert({ ...row, email: row.email.toLowerCase() })
      .select()
      .single();
    if (error) fail(error, 'insert_deletion_request');
    return data as DeletionRequestRow;
  }

  async listDeletionRequests(limit: number) {
    const { data, error } = await this.db.from('deletion_requests').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) fail(error, 'list_deletion_requests');
    return (data ?? []) as DeletionRequestRow[];
  }
  async getDeletionRequest(id: string) {
    const { data, error } = await this.db.from('deletion_requests').select('*').eq('id', id).maybeSingle();
    if (error) fail(error, 'get_deletion_request');
    return (data as DeletionRequestRow | null) ?? null;
  }
  async updateDeletionRequest(id: string, patch: Parameters<Store['updateDeletionRequest']>[1]) {
    const { data, error } = await this.db.from('deletion_requests').update(patch).eq('id', id).select().single();
    if (error) fail(error, 'update_deletion_request');
    return data as DeletionRequestRow;
  }
  async eraseByEmail(email: string): Promise<EraseResult> {
    const { data: leads, error } = await this.db.from('leads').select('calculation_id').eq('email', email.toLowerCase());
    if (error) fail(error, 'erase_find');
    const ids = [...new Set(((leads ?? []) as Array<{ calculation_id: string }>).map((l) => l.calculation_id))];
    if (ids.length === 0) return { calculations: 0, heldForLegal: 0 };
    const { data: orders, error: oErr } = await this.db.from('orders').select('calculation_id').in('calculation_id', ids);
    if (oErr) fail(oErr, 'erase_orders');
    const held = new Set(((orders ?? []) as Array<{ calculation_id: string }>).map((o) => o.calculation_id));
    const deletable = ids.filter((id) => !held.has(id));
    if (deletable.length > 0) {
      const { error: dErr } = await this.db.from('calculations').delete().in('id', deletable);
      if (dErr) fail(dErr, 'erase_delete');
    }
    if (held.size > 0) {
      const { error: sErr } = await this.db
        .from('calculations')
        .update({ input_payload: {}, output_payload: {} })
        .in('id', [...held]);
      if (sErr) fail(sErr, 'erase_scrub');
    }
    return { calculations: deletable.length, heldForLegal: held.size };
  }
  async listLeadsForRetry(opts: { olderThan: Date; newerThan: Date; limit: number }) {
    const { data, error } = await this.db
      .from('leads')
      .select('*')
      .in('status', ['requested', 'failed'])
      .lt('created_at', opts.olderThan.toISOString())
      .gt('created_at', opts.newerThan.toISOString())
      .order('created_at', { ascending: true })
      .limit(opts.limit);
    if (error) fail(error, 'leads_for_retry');
    return (data ?? []) as LeadRow[];
  }

  async isAdmin(userId: string) {
    const { data, error } = await this.db.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
    if (error) fail(error, 'is_admin');
    return Boolean(data);
  }
  async insertAuditLog(row: Parameters<Store['insertAuditLog']>[0]) {
    const { error } = await this.db.from('admin_audit_log').insert({ ...row, metadata_safe: row.metadata_safe ?? {} });
    if (error) fail(error, 'audit_log');
  }

  async insertOrder(row: OrderInsert) {
    const { data, error } = await this.db.from('orders').insert(row).select().single();
    if (error) fail(error, 'insert_order');
    return data as OrderRow;
  }
  async getOrder(id: string) {
    const { data, error } = await this.db.from('orders').select('*').eq('id', id).maybeSingle();
    if (error) fail(error, 'get_order');
    return (data as OrderRow | null) ?? null;
  }
  async getOrderByCheckoutSession(sessionId: string) {
    const { data, error } = await this.db.from('orders').select('*').eq('stripe_checkout_session_id', sessionId).maybeSingle();
    if (error) fail(error, 'get_order_by_session');
    return (data as OrderRow | null) ?? null;
  }
  async updateOrder(id: string, patch: Parameters<Store['updateOrder']>[1]) {
    const { data, error } = await this.db.from('orders').update(patch).eq('id', id).select().single();
    if (error) fail(error, 'update_order');
    return data as OrderRow;
  }

  async getOrderByPaypalOrderId(paypalOrderId: string) {
    const { data, error } = await this.db.from('orders').select('*').eq('paypal_order_id', paypalOrderId).maybeSingle();
    if (error) fail(error, 'get_order_by_paypal');
    return (data as OrderRow | null) ?? null;
  }
  async listOrdersByCalculation(calculationId: string) {
    const { data, error } = await this.db.from('orders').select('*').eq('calculation_id', calculationId);
    if (error) fail(error, 'list_orders_by_calc');
    return (data ?? []) as OrderRow[];
  }
  async markOrderPaid(i: { orderId: string; paypalOrderId: string; captureId: string; amountMinor: number; currency: string; sandbox: boolean }): Promise<MarkPaidResult> {
    const { data, error } = await this.db.rpc('ma_order_mark_paid', {
      p_order: i.orderId,
      p_paypal_order: i.paypalOrderId,
      p_capture: i.captureId,
      p_amount: i.amountMinor,
      p_currency: i.currency,
      p_sandbox: i.sandbox,
    });
    if (error) fail(error, 'mark_order_paid');
    return data === 'paid' || data === 'already_paid' ? data : 'mismatch';
  }
  async claimOrderFulfillment(orderId: string, staleMinutes = 10) {
    const { data, error } = await this.db.rpc('ma_order_claim_fulfillment', { p_order: orderId, p_stale_minutes: staleMinutes });
    if (error) fail(error, 'claim_fulfillment');
    return data === true;
  }
  async listOrdersForFulfillmentRetry(opts: { olderThan: Date; limit: number }) {
    const { data, error } = await this.db
      .from('orders')
      .select('*')
      .eq('provider', 'paypal')
      .eq('status', 'paid')
      .neq('fulfillment_status', 'delivered')
      .lt('updated_at', opts.olderThan.toISOString())
      .order('paid_at', { ascending: true })
      .limit(opts.limit);
    if (error) fail(error, 'orders_for_retry');
    return (data ?? []) as OrderRow[];
  }
  async salesSummary(): Promise<SalesSummary> {
    const { data, error } = await this.db.from('orders').select('amount_minor,sandbox,fulfillment_status').eq('provider', 'paypal').eq('status', 'paid');
    if (error) fail(error, 'sales_summary');
    const rows = (data ?? []) as Array<Pick<OrderRow, 'amount_minor' | 'sandbox' | 'fulfillment_status'>>;
    return {
      paidOrders: rows.length,
      paidAmountMinor: rows.reduce((n, r) => n + r.amount_minor, 0),
      sandboxOrders: rows.filter((r) => r.sandbox).length,
      pendingFulfillment: rows.filter((r) => r.fulfillment_status !== 'delivered').length,
    };
  }

  async claimWebhookEvent(eventId: string, eventType: string, payloadSha256: string) {
    const { error } = await this.db
      .from('stripe_webhook_events')
      .insert({ event_id: eventId, event_type: eventType, payload_sha256: payloadSha256, status: 'processing' });
    if (!error) return 'claimed' as const;
    if (error.code !== '23505') fail(error, 'claim_webhook');

    // Ya existe: solo se reprocesa si falló antes o quedó "processing" por más de 10 minutos.
    const { data, error: selErr } = await this.db
      .from('stripe_webhook_events')
      .select('status,received_at')
      .eq('event_id', eventId)
      .maybeSingle();
    if (selErr) fail(selErr, 'claim_webhook_select');
    const row = data as { status: string; received_at: string } | null;
    const stale = row?.status === 'processing' && Date.now() - new Date(row.received_at).getTime() > 10 * 60_000;
    if (row && (row.status === 'failed' || stale)) {
      const { data: upd, error: updErr } = await this.db
        .from('stripe_webhook_events')
        .update({ status: 'processing', received_at: new Date().toISOString(), error_class: null })
        .eq('event_id', eventId)
        .eq('status', row.status)
        .select('event_id');
      if (updErr) fail(updErr, 'claim_webhook_update');
      // Compare-and-set: si otra instancia lo reclamó antes, no hay filas y se trata como duplicado.
      if ((upd ?? []).length > 0) return 'claimed' as const;
    }
    return 'duplicate' as const;
  }
  async finishWebhookEvent(eventId: string, status: 'processed' | 'failed', errorClass?: string) {
    const { error } = await this.db
      .from('stripe_webhook_events')
      .update({ status, processed_at: new Date().toISOString(), error_class: errorClass ?? null })
      .eq('event_id', eventId);
    if (error) fail(error, 'finish_webhook');
  }

  async purgeExpired(now: Date): Promise<PurgeResult> {
    const { data, error } = await this.db.rpc('purge_expired_data', { p_now: now.toISOString() });
    if (error) fail(error, 'purge');
    const r = (data ?? {}) as Partial<PurgeResult>;
    return { calculations: r.calculations ?? 0, scrubbed: r.scrubbed ?? 0 };
  }

  async ping() {
    const { error } = await this.db.from('admin_users').select('user_id', { head: true, count: 'exact' }).limit(1);
    return !error;
  }
}
