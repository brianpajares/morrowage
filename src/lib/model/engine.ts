/**
 * Motor MorrowAge v2.1 — traducción directa de `model/engine_reference.py` (sin LLM).
 *
 *   η_nonage   = Σ β_j · x_j  (7 términos no-edad)
 *   Δlp        = η_nonage − η_ref_nonage
 *   HR         = exp(Δlp)
 *   MorrowAge  = age · exp(Δlp / β_log_age)
 *
 * El valor `morrow_age` crudo existe solo para auditoría/QA: la UI/PDF/email de usuario
 * usan siempre `display.ts` (exacto solo en 40–69; `<40` / `>69` fuera).
 */
import type { Inputs, NumericField, SelfRatedHealth } from './input-spec';
import { assertInputs } from './validate';
import type { ModelParams, SensitivityField } from './params';

export type MorrowAgeStatus =
  | 'WITHIN_REFERENCE_RANGE'
  | 'BELOW_REFERENCE_RANGE'
  | 'ABOVE_REFERENCE_RANGE';

export const DRIVER_FIELDS = [
  'sleep_hours',
  'self_rated_health',
  'cigarettes_per_day',
  'reaction_time_ms',
  'waist_to_height_ratio',
  'alcohol_units_week',
  'resting_hr_bpm',
] as const;
export type DriverField = (typeof DRIVER_FIELDS)[number];

export interface ModelOutput {
  model_version: string;
  morrow_age: number;
  morrow_age_status: MorrowAgeStatus;
  morrow_age_display: string;
  morrow_age_reference_range: [number, number];
  delta_age: number;
  relative_hazard: number;
  eta_nonage: number;
  delta_lp: number;
  top_driver: { name: DriverField; log_hazard_contribution: number };
  drivers: Record<DriverField, number>;
  measurement_sensitivity: {
    type: 'measurement_scenario_not_confidence_interval';
    bounds_aware: true;
    morrow_age_low: number;
    morrow_age_base: number;
    morrow_age_high: number;
  };
  absolute_mortality_10y: null;
  absolute_mortality_10y_status: 'LOCKED_REQUIRES_BASELINE_SURVIVAL_RECALIBRATION';
}

/** round(x, n) con redondeo decimal exacto (equivalente a Python `round`, salvo empates binarios exactos). */
export function round(x: number, digits: number): number {
  const r = Number(x.toFixed(digits));
  return r === 0 ? 0 : r; // normaliza -0
}

function srhCoef(params: ModelParams, value: SelfRatedHealth): number {
  return params.beta.srh[value];
}

export function classifyMorrowAge(
  raw: number,
  range: readonly [number, number],
): { status: MorrowAgeStatus; display: string } {
  const [min, max] = range;
  if (raw < min) return { status: 'BELOW_REFERENCE_RANGE', display: `<${min}` };
  if (raw > max) return { status: 'ABOVE_REFERENCE_RANGE', display: `>${max}` };
  return { status: 'WITHIN_REFERENCE_RANGE', display: raw.toFixed(1) };
}

const SENS_FIELDS: ReadonlyArray<
  readonly [SensitivityField & NumericField, 'sleep' | 'reaction' | 'wthr' | 'alcohol' | 'rhr']
> = [
  ['sleep_hours', 'sleep'],
  ['reaction_time_ms', 'reaction'],
  ['waist_to_height_ratio', 'wthr'],
  ['alcohol_units_week', 'alcohol'],
  ['resting_hr_bpm', 'rhr'],
];

export interface SensitivityTerm {
  field: SensitivityField;
  /** Perturbación solicitada (spec) en unidades del input. */
  requested: number;
  /** Perturbación efectivamente aplicada hacia abajo / hacia arriba tras recortar al guardrail. */
  down: number;
  up: number;
  /** true si el guardrail recortó alguna dirección. */
  clipped: boolean;
}

/** Perturbaciones bounds-aware por variable: Δdown=min(Δ, x−min), Δup=min(Δ, max−x). */
export function sensitivityTerms(inputs: Inputs, params: ModelParams): SensitivityTerm[] {
  return SENS_FIELDS.map(([field]) => {
    const [lo, hi] = params.guardrails[field];
    const value = inputs[field];
    const requested = params.sensitivityDeltas[field];
    const down = Math.min(requested, Math.max(0, value - lo));
    const up = Math.min(requested, Math.max(0, hi - value));
    return { field, requested, down, up, clipped: down < requested || up < requested };
  });
}

/** Cálculo puro y determinista. Lanza `InputValidationError` si los inputs no cumplen el schema. */
export function calculate(rawInputs: unknown, params: ModelParams): ModelOutput {
  const inputs: Inputs = assertInputs(rawInputs);
  const { beta, ref } = params;
  const srh = srhCoef(params, inputs.self_rated_health);

  const contributions: Record<DriverField, number> = {
    sleep_hours: beta.sleep * (inputs.sleep_hours - ref.sleep),
    self_rated_health: srh - ref.srhCoef,
    cigarettes_per_day: beta.cigs * (inputs.cigarettes_per_day - ref.cigs),
    reaction_time_ms: beta.reaction * (inputs.reaction_time_ms - ref.reaction),
    waist_to_height_ratio: beta.wthr * (inputs.waist_to_height_ratio - ref.wthr),
    alcohol_units_week: beta.alcohol * (inputs.alcohol_units_week - ref.alcohol),
    resting_hr_bpm: beta.rhr * (inputs.resting_hr_bpm - ref.rhr),
  };

  const etaNonage =
    beta.sleep * inputs.sleep_hours +
    srh +
    beta.cigs * inputs.cigarettes_per_day +
    beta.reaction * inputs.reaction_time_ms +
    beta.wthr * inputs.waist_to_height_ratio +
    beta.alcohol * inputs.alcohol_units_week +
    beta.rhr * inputs.resting_hr_bpm;

  const deltaLp = etaNonage - ref.nonAgeLp;
  const betaAge = beta.logAge;
  const age = inputs.age_years;
  const relativeHazard = Math.exp(deltaLp);
  const morrowAge = age * Math.exp(deltaLp / betaAge);
  const deltaAge = morrowAge - age;

  // Sensibilidad de medición bounds-aware: cada perturbación se recorta al guardrail. No es un IC.
  let sensLowLp = 0;
  let sensHighLp = 0;
  sensitivityTerms(inputs, params).forEach((term, i) => {
    const betaKey = SENS_FIELDS[i]![1];
    sensLowLp += beta[betaKey] * term.down;
    sensHighLp += beta[betaKey] * term.up;
  });
  const sensLow = age * Math.exp((deltaLp - sensLowLp) / betaAge);
  const sensHigh = age * Math.exp((deltaLp + sensHighLp) / betaAge);

  // Primer máximo en orden de inserción (igual que Python `max` con empates).
  let topName: DriverField = DRIVER_FIELDS[0];
  let topAbs = -Infinity;
  for (const name of DRIVER_FIELDS) {
    const a = Math.abs(contributions[name]);
    if (a > topAbs) {
      topAbs = a;
      topName = name;
    }
  }

  const { status, display } = classifyMorrowAge(morrowAge, params.referenceAgeRange);

  const drivers = {} as Record<DriverField, number>;
  for (const name of DRIVER_FIELDS) drivers[name] = round(contributions[name], 9);

  return {
    model_version: params.version,
    morrow_age: round(morrowAge, 6),
    morrow_age_status: status,
    morrow_age_display: display,
    morrow_age_reference_range: [params.referenceAgeRange[0], params.referenceAgeRange[1]],
    delta_age: round(deltaAge, 6),
    relative_hazard: round(relativeHazard, 6),
    eta_nonage: round(etaNonage, 9),
    delta_lp: round(deltaLp, 9),
    top_driver: { name: topName, log_hazard_contribution: round(contributions[topName], 9) },
    drivers,
    measurement_sensitivity: {
      type: 'measurement_scenario_not_confidence_interval',
      bounds_aware: true,
      morrow_age_low: round(sensLow, 6),
      morrow_age_base: round(morrowAge, 6),
      morrow_age_high: round(sensHigh, 6),
    },
    absolute_mortality_10y: null,
    absolute_mortality_10y_status: 'LOCKED_REQUIRES_BASELINE_SURVIVAL_RECALIBRATION',
  };
}
