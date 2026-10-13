/**
 * Proyecciones "seguras para mostrar" del resultado del motor.
 *
 * Guardrails (PRD §0, FR-06, AT-08):
 *  - El MorrowAge exacto solo se expone si 40 ≤ raw ≤ 69; fuera: `<40` / `>69`, sin valor numérico.
 *  - `delta_age` numérico solo dentro del rango de referencia.
 *  - `eta_nonage` y `delta_lp` permiten reconstruir el raw (age·exp(Δlp/β)), por lo que no salen
 *    del servidor hacia el cliente.
 *  - La vista previa gratuita contiene EXACTAMENTE `free_preview` de `spec/outputs_spec.json`.
 */
import outputsSpec from '@spec/outputs_spec.json';
import { classifyMorrowAge, round, type DriverField, type ModelOutput, type MorrowAgeStatus } from './engine';

export interface PreviewOutput {
  model_version: string;
  morrow_age_status: MorrowAgeStatus;
  morrow_age_display: string;
  morrow_age_reference_range: [number, number];
  /** Solo presente si status = WITHIN_REFERENCE_RANGE. */
  morrow_age?: number;
  /** Solo presente si status = WITHIN_REFERENCE_RANGE. */
  delta_age?: number;
  relative_hazard: number;
  top_driver: { name: DriverField; log_hazard_contribution: number };
  absolute_mortality_10y: null;
  absolute_mortality_10y_status: 'LOCKED_REQUIRES_BASELINE_SURVIVAL_RECALIBRATION';
}

export interface SafeAge {
  status: MorrowAgeStatus;
  display: string;
  /** Valor numérico: únicamente dentro de 40–69. */
  value?: number;
}

export function safeAge(raw: number, range: readonly [number, number]): SafeAge {
  const { status, display } = classifyMorrowAge(raw, range);
  return status === 'WITHIN_REFERENCE_RANGE'
    ? { status, display, value: round(raw, 1) }
    : { status, display };
}

/** Diferencia con la edad cronológica (1 decimal) solo si el resultado está dentro del rango. */
export function safeDelta(raw: number, age: number, range: readonly [number, number]): number | undefined {
  const { status } = classifyMorrowAge(raw, range);
  return status === 'WITHIN_REFERENCE_RANGE' ? round(raw - age, 1) : undefined;
}

export function toPreviewOutput(out: ModelOutput): PreviewOutput {
  const preview: PreviewOutput = {
    model_version: out.model_version,
    morrow_age_status: out.morrow_age_status,
    morrow_age_display: out.morrow_age_display,
    morrow_age_reference_range: out.morrow_age_reference_range,
    relative_hazard: out.relative_hazard,
    top_driver: out.top_driver,
    absolute_mortality_10y: null,
    absolute_mortality_10y_status: out.absolute_mortality_10y_status,
  };
  if (out.morrow_age_status === 'WITHIN_REFERENCE_RANGE') {
    preview.morrow_age = out.morrow_age;
    preview.delta_age = out.delta_age;
  }
  return preview;
}

/** Claves de la vista previa gratuita según el spec (única fuente). */
export const FREE_PREVIEW_OUTPUT_IDS: readonly string[] = outputsSpec.free_preview.includes;
export const FULL_REPORT_OUTPUT_IDS: readonly string[] = outputsSpec.full_report.includes;
/** Outputs que jamás se presentan personalizados en v1 (FR-25 / AT-28). */
export const LOCKED_OUTPUT_IDS = ['mortality_risk_10y', 'country_percentile'] as const;
