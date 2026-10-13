/**
 * Telemetría de coste por informe (AT-34, NFR-07). Parámetros desde `spec/monetizacion.json`.
 * En `validation` el objetivo es ≤ US$0.05 por informe fuera de planes fijos.
 */
import monetization from '@spec/monetizacion.json';

export const VALIDATION_COST_TARGET_USD = 0.05;
export const STRIPE_COST_TARGET_USD = 1;

const est = monetization.cost_estimate;

export interface ReportCostInput {
  /** Emails enviados para este informe (usuario + dueño = 2 en validation). */
  emails: number;
  /** true si el cobro pasó por Stripe (suma comisión). */
  stripe?: boolean;
}

/** Coste incremental estimado en USD (email asignado + holgura de cómputo [+ comisión Stripe]). */
export function estimateReportCostUsd({ emails, stripe = false }: ReportCostInput): number {
  const cost = emails * est.transactional_email_usd + est.compute_allowance_usd + (stripe ? est.stripe_domestic_card_fee_usd : 0);
  return Math.round(cost * 1e6) / 1e6;
}

/** Micro-USD enteros, para acumular en contadores bigint sin pérdidas de coma flotante. */
export function estimateReportCostMicroUsd(input: ReportCostInput): number {
  return Math.round(estimateReportCostUsd(input) * 1e6);
}
