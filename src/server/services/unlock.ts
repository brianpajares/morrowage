/**
 * Contexto de la página de desbloqueo `/[locale]/unlock/<token>`.
 * Solo expone lo que el usuario ya vio gratis (MorrowAge con guardrails <40/>69 y su edad) y su email
 * enmascarado: nunca inputs de salud, contribuciones ni el informe completo.
 */
import { maskEmail } from '@/lib/email-address';
import { toPreviewOutput } from '@/lib/model/display';
import { hashToken, isPlausibleToken } from '@/lib/security/tokens';
import type { Store } from '@/server/store/types';

export type UnlockContext =
  | {
      status: 'ok';
      emailMasked: string;
      verificationId: string;
      chronological: number;
      resultDisplay: string;
      expiresAt: string;
    }
  /** Ya desbloqueado (o informe gratuito): el token abre el informe. */
  | { status: 'open_report' }
  | { status: 'expired' }
  | { status: 'not_found' };

export async function getUnlockContext(store: Store, token: string, now: Date = new Date()): Promise<UnlockContext> {
  if (!isPlausibleToken(token)) return { status: 'not_found' };
  const report = await store.getReportByTokenHash(hashToken(token));
  if (!report) return { status: 'not_found' };
  if (new Date(report.token_expires_at) <= now) return { status: 'expired' };
  if (report.access_tier !== 'preview_locked') return { status: 'open_report' };

  const calc = await store.getCalculation(report.calculation_id);
  const lead = report.lead_id ? await store.getLead(report.lead_id) : null;
  // Tras la retención solo queda el payload vaciado: ya no hay nada que desbloquear.
  if (!calc || !lead || !calc.input_payload || !('age_years' in calc.input_payload)) return { status: 'expired' };

  return {
    status: 'ok',
    emailMasked: maskEmail(lead.email),
    verificationId: report.verification_id,
    chronological: calc.input_payload.age_years,
    resultDisplay: toPreviewOutput(calc.output_payload).morrow_age_display,
    expiresAt: report.token_expires_at,
  };
}
