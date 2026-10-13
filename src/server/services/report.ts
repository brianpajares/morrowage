/**
 * Emisión y consulta de informes por token (FR-13, FR-26, AT-11, AT-27).
 * El token plano solo existe en memoria durante la emisión y en el enlace entregado al usuario;
 * en DB únicamente vive su SHA-256.
 */
import { getEnv } from '@/lib/env';
import { getModelSnapshot } from '@/lib/drive/loader';
import { buildReportData, PACKAGE_VERSION } from '@/lib/report/build';
import type { AccessTier, ReportData } from '@/lib/report/types';
import type { Locale } from '@/lib/locales';
import { generateReportToken, generateVerificationId, hashToken, isPlausibleToken } from '@/lib/security/tokens';
import {
  UniqueViolationError,
  type CalculationRow,
  type ReportRow,
  type Store,
} from '@/server/store/types';

export interface IssuedReport {
  report: ReportRow;
  /** Token plano: entregar al usuario y descartar. */
  token: string;
}

export function reportUrl(locale: Locale, token: string): string {
  return `${getEnv().appUrl}/${locale}/report/${token}`;
}

export function tokenExpiry(now: Date): Date {
  return new Date(now.getTime() + getEnv().reportTokenTtlHours * 3_600_000);
}

export async function issueReport(
  store: Store,
  calc: CalculationRow,
  leadId: string | null,
  tier: AccessTier,
  now: Date = new Date(),
): Promise<IssuedReport> {
  const expires = tokenExpiry(now);
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateReportToken();
    try {
      const report = await store.insertReport({
        lead_id: leadId,
        calculation_id: calc.id,
        verification_id: generateVerificationId(now),
        access_tier: tier,
        token_hash: hashToken(token),
        token_expires_at: expires.toISOString(),
        package_version: PACKAGE_VERSION,
      });
      return { report, token };
    } catch (err) {
      if (err instanceof UniqueViolationError) continue; // colisión de Verification ID/token: reintenta
      throw err;
    }
  }
  throw new Error('report_id_collision');
}

/** Rota el token (reenvío admin / reintento): invalida el enlace anterior y extiende la expiración. */
export async function rotateReportToken(store: Store, report: ReportRow, now: Date = new Date()): Promise<IssuedReport> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = generateReportToken();
    try {
      const updated = await store.updateReport(report.id, {
        token_hash: hashToken(token),
        token_expires_at: tokenExpiry(now).toISOString(),
      });
      return { report: updated, token };
    } catch (err) {
      if (err instanceof UniqueViolationError) continue;
      throw err;
    }
  }
  throw new Error('token_collision');
}

export async function buildDataForReport(calc: CalculationRow, report: ReportRow, locale?: Locale): Promise<ReportData | null> {
  // Tras la retención solo queda el payload vaciado: no hay informe que construir.
  if (!calc.input_payload || !('age_years' in calc.input_payload)) return null;
  const snapshot = await getModelSnapshot();
  return buildReportData({
    inputs: calc.input_payload,
    output: calc.output_payload,
    params: snapshot.params,
    verificationId: report.verification_id,
    appVersion: calc.app_version,
    accessTier: report.access_tier,
    locale: locale ?? calc.locale,
    generatedAt: report.generated_at,
  });
}

export type ReportLookup =
  | { status: 'ok'; report: ReportRow; calc: CalculationRow; data: ReportData; expiresAt: string }
  | { status: 'expired' }
  | { status: 'not_found' };

export async function lookupReport(store: Store, token: string, now: Date = new Date()): Promise<ReportLookup> {
  if (!isPlausibleToken(token)) return { status: 'not_found' };
  const report = await store.getReportByTokenHash(hashToken(token));
  if (!report) return { status: 'not_found' };
  if (new Date(report.token_expires_at) <= now) return { status: 'expired' };
  const calc = await store.getCalculation(report.calculation_id);
  if (!calc) return { status: 'not_found' };
  const data = await buildDataForReport(calc, report);
  if (!data) return { status: 'expired' };
  return { status: 'ok', report, calc, data, expiresAt: report.token_expires_at };
}
