import type { ModelOutput } from '@/lib/model/engine';
import type { Inputs } from '@/lib/model/input-spec';
import type { Locale } from '@/lib/locales';

export type LeadStatus = 'requested' | 'generating' | 'delivered' | 'failed' | 'paid' | 'deleted';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type DeletionStatus = 'received' | 'verifying' | 'completed' | 'rejected_legal_hold';
export type AccessTier = 'validation_full' | 'paid_full';

export interface CalculationRow {
  id: string;
  session_hash: string;
  locale: Locale;
  market_hint_coarse: string | null;
  /** Datos de salud: solo retención operativa corta; nunca leíbles por anon/auth/admin-frontend. */
  input_payload: Inputs;
  output_payload: ModelOutput;
  model_version: string;
  app_version: string;
  scope_accepted_at: string;
  created_at: string;
  expires_at: string;
}
export type CalculationInsert = Omit<CalculationRow, 'id' | 'created_at'> & { id?: string };

export interface LeadRow {
  id: string;
  calculation_id: string;
  email: string;
  locale: Locale;
  service_consent_at: string;
  marketing_opt_in: boolean;
  marketing_consent_at: string | null;
  subscription_waitlist_opt_in: boolean;
  status: LeadStatus;
  delivery_provider_id: string | null;
  delivery_error_class: string | null;
  created_at: string;
  updated_at: string;
}
export type LeadInsert = Omit<LeadRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'delivery_provider_id' | 'delivery_error_class'> &
  Partial<Pick<LeadRow, 'status'>>;

export interface ReportRow {
  id: string;
  lead_id: string | null;
  calculation_id: string;
  verification_id: string;
  access_tier: AccessTier;
  token_hash: string;
  token_expires_at: string;
  generated_at: string;
  delivered_at: string | null;
  last_sent_at: string | null;
  pdf_checksum_sha256: string | null;
  package_version: string;
}
export type ReportInsert = Omit<ReportRow, 'id' | 'generated_at' | 'delivered_at' | 'last_sent_at' | 'pdf_checksum_sha256'>;

export interface OrderRow {
  id: string;
  lead_id: string | null;
  calculation_id: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_minor: number;
  currency: string;
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
}
export type OrderInsert = Pick<OrderRow, 'calculation_id' | 'amount_minor' | 'currency'> & Partial<Pick<OrderRow, 'lead_id' | 'stripe_checkout_session_id' | 'status'>>;

export interface DeletionRequestRow {
  id: string;
  email: string;
  locale: Locale;
  verification_id: string | null;
  status: DeletionStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

/** Proyección `admin_leads_safe`: sin inputs, sin resultado crudo, sin token/URL. */
export interface AdminLeadSafe {
  id: string;
  email: string;
  locale: Locale;
  marketing_opt_in: boolean;
  subscription_waitlist_opt_in: boolean;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  report_id: string | null;
  verification_id: string | null;
  delivered_at: string | null;
  last_sent_at: string | null;
}

export interface FunnelCounterRow {
  day: string;
  locale: Locale;
  event: string;
  dim: string;
  count: number;
}

export interface LeadCounts {
  total: number;
  byStatus: Record<string, number>;
  byLocale: Record<string, number>;
  marketingOptIns: number;
  waitlistOptIns: number;
}

export interface PurgeResult {
  calculations: number;
  scrubbed: number;
}

export interface EraseResult {
  calculations: number;
  heldForLegal: number;
}

export class UniqueViolationError extends Error {
  constructor(readonly constraint: string) {
    super(`unique_violation:${constraint}`);
    this.name = 'UniqueViolationError';
  }
}

export interface Store {
  readonly kind: 'supabase' | 'memory';

  insertCalculation(row: CalculationInsert): Promise<CalculationRow>;
  getCalculation(id: string): Promise<CalculationRow | null>;

  getLead(id: string): Promise<LeadRow | null>;
  findLeadByCalculation(calculationId: string): Promise<LeadRow | null>;
  insertLead(row: LeadInsert): Promise<LeadRow>;
  updateLead(id: string, patch: Partial<Pick<LeadRow, 'status' | 'delivery_provider_id' | 'delivery_error_class'>>): Promise<LeadRow>;

  insertReport(row: ReportInsert): Promise<ReportRow>;
  getReport(id: string): Promise<ReportRow | null>;
  getReportByTokenHash(hash: string): Promise<ReportRow | null>;
  getReportByLead(leadId: string): Promise<ReportRow | null>;
  updateReport(
    id: string,
    patch: Partial<Pick<ReportRow, 'token_hash' | 'token_expires_at' | 'delivered_at' | 'last_sent_at' | 'pdf_checksum_sha256'>>,
  ): Promise<ReportRow>;

  listLeadsSafe(opts: { status?: LeadStatus; cursor?: string | null; limit: number }): Promise<{
    items: AdminLeadSafe[];
    nextCursor: string | null;
  }>;
  leadCounts(): Promise<LeadCounts>;

  incrementCounter(day: string, locale: Locale, event: string, dim: string, by?: number): Promise<void>;
  funnelCounters(sinceDay: string): Promise<FunnelCounterRow[]>;

  insertDeletionRequest(row: Pick<DeletionRequestRow, 'email' | 'locale' | 'verification_id'>): Promise<DeletionRequestRow>;
  listDeletionRequests(limit: number): Promise<DeletionRequestRow[]>;
  getDeletionRequest(id: string): Promise<DeletionRequestRow | null>;
  updateDeletionRequest(
    id: string,
    patch: Partial<Pick<DeletionRequestRow, 'status' | 'resolved_at' | 'resolution_note'>>,
  ): Promise<DeletionRequestRow>;
  /** Borra cálculos/leads/informes de un email; lo que tiene pedidos queda retenido por obligación contable. */
  eraseByEmail(email: string): Promise<EraseResult>;
  /** Leads cuya entrega no se completó (para el reintento programado). */
  listLeadsForRetry(opts: { olderThan: Date; newerThan: Date; limit: number }): Promise<LeadRow[]>;

  isAdmin(userId: string): Promise<boolean>;
  insertAuditLog(row: { admin_user_id: string; action: string; target_type: string; target_id: string | null; metadata_safe?: Record<string, unknown> }): Promise<void>;

  insertOrder(row: OrderInsert): Promise<OrderRow>;
  getOrder(id: string): Promise<OrderRow | null>;
  getOrderByCheckoutSession(sessionId: string): Promise<OrderRow | null>;
  updateOrder(
    id: string,
    patch: Partial<Pick<OrderRow, 'status' | 'stripe_checkout_session_id' | 'stripe_payment_intent_id' | 'paid_at' | 'lead_id'>>,
  ): Promise<OrderRow>;

  /** Idempotencia de webhooks: 'duplicate' si el event_id ya existe. */
  claimWebhookEvent(eventId: string, eventType: string, payloadSha256: string): Promise<'claimed' | 'duplicate'>;
  finishWebhookEvent(eventId: string, status: 'processed' | 'failed', errorClass?: string): Promise<void>;

  purgeExpired(now: Date): Promise<PurgeResult>;
  ping(): Promise<boolean>;
}
