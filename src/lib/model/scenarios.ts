/**
 * Escenarios "what-if" educativos (US-17, AT-24, `ux/report_layout.md` p.5).
 *
 * Guardrails de producto (registrados en DECISIONS.md):
 *  - Máximo 3 escenarios por informe, un input distinto en cada uno, siempre dentro de los
 *    guardrails del modelo.
 *  - Solo se ofrecen cambios hacia MENOS en variables que el usuario puede reconocer como
 *    modificables (cigarrillos, alcohol, cintura/altura, pulso en reposo). Nunca se ofrece
 *    fumar más, beber más ni dormir menos/más: el signo del coeficiente de sueño es una
 *    asociación lineal no causal y no se convierte en consejo.
 *  - El resultado se presenta con el mismo censor `<40`/`>69`; la diferencia solo se informa si
 *    baseline y escenario están dentro del rango de referencia.
 */
import { calculate, round } from './engine';
import type { Inputs } from './input-spec';
import type { ModelParams } from './params';
import { safeAge, type SafeAge } from './display';

export const MAX_SCENARIOS = 3;

export const SCENARIO_FIELDS = [
  'cigarettes_per_day',
  'alcohol_units_week',
  'waist_to_height_ratio',
  'resting_hr_bpm',
] as const;
export type ScenarioField = (typeof SCENARIO_FIELDS)[number];

/** Reducción máxima plausible por escenario (guardrail de producto preliminar). */
const MAX_DECREASE: Partial<Record<ScenarioField, number>> = {
  waist_to_height_ratio: 0.1,
  resting_hr_bpm: 15,
};

const STEP: Record<ScenarioField, number> = {
  cigarettes_per_day: 1,
  alcohol_units_week: 0.5,
  waist_to_height_ratio: 0.005,
  resting_hr_bpm: 1,
};

const INTEGER_FIELDS: readonly ScenarioField[] = ['cigarettes_per_day', 'resting_hr_bpm'];

export interface ScenarioBounds {
  field: ScenarioField;
  min: number;
  max: number;
  step: number;
  integer: boolean;
}

export interface ScenarioChange {
  field: ScenarioField;
  to: number;
}

export interface ScenarioResult {
  field: ScenarioField;
  from: number;
  to: number;
  baseline: SafeAge;
  scenario: SafeAge;
  /** Diferencia en años (1 decimal) solo si baseline y escenario están dentro de 40–69. */
  difference?: number;
}

export type ScenarioErrorCode =
  | 'too_many_scenarios'
  | 'duplicate_field'
  | 'field_not_allowed'
  | 'out_of_bounds'
  | 'not_a_number';

export class ScenarioError extends Error {
  readonly code: ScenarioErrorCode;
  constructor(code: ScenarioErrorCode) {
    super(code);
    this.name = 'ScenarioError';
    this.code = code;
  }
}

/** Límites por campo; se omiten los campos sin margen para reducir (p. ej. 0 cigarrillos). */
export function scenarioBounds(inputs: Inputs, params: ModelParams): ScenarioBounds[] {
  const bounds: ScenarioBounds[] = [];
  for (const field of SCENARIO_FIELDS) {
    const [gMin] = params.guardrails[field];
    const current = inputs[field];
    const floor = Math.max(gMin, current - (MAX_DECREASE[field] ?? Infinity));
    const integer = INTEGER_FIELDS.includes(field);
    const min = integer ? Math.ceil(floor) : round(floor, 3);
    if (min < current) {
      bounds.push({ field, min, max: current, step: STEP[field], integer });
    }
  }
  return bounds;
}

export function runScenarios(
  inputs: Inputs,
  changes: readonly ScenarioChange[],
  params: ModelParams,
): ScenarioResult[] {
  if (changes.length > MAX_SCENARIOS) throw new ScenarioError('too_many_scenarios');
  const seen = new Set<ScenarioField>();
  const bounds = new Map(scenarioBounds(inputs, params).map((b) => [b.field, b]));
  const baselineRaw = calculate(inputs, params).morrow_age;
  const range = params.referenceAgeRange;
  const baseline = safeAge(baselineRaw, range);

  return changes.map((change) => {
    if (!(SCENARIO_FIELDS as readonly string[]).includes(change.field)) {
      throw new ScenarioError('field_not_allowed');
    }
    if (seen.has(change.field)) throw new ScenarioError('duplicate_field');
    seen.add(change.field);
    if (typeof change.to !== 'number' || !Number.isFinite(change.to)) {
      throw new ScenarioError('not_a_number');
    }
    const b = bounds.get(change.field);
    // Con tolerancia mínima para errores de coma flotante en el control deslizante.
    if (!b || change.to < b.min - 1e-9 || change.to > b.max + 1e-9) {
      throw new ScenarioError('out_of_bounds');
    }
    if (b.integer && !Number.isInteger(change.to)) throw new ScenarioError('out_of_bounds');

    const scenarioInputs: Inputs = { ...inputs, [change.field]: change.to };
    const raw = calculate(scenarioInputs, params).morrow_age;
    const scenario = safeAge(raw, range);
    const result: ScenarioResult = {
      field: change.field,
      from: inputs[change.field],
      to: change.to,
      baseline,
      scenario,
    };
    if (baseline.value !== undefined && scenario.value !== undefined) {
      result.difference = round(scenario.value - baseline.value, 1);
    }
    return result;
  });
}

/**
 * Escenarios por defecto para el PDF (el usuario elige los suyos en el informe web).
 * Determinista: cada candidato es una reducción "plausible" y se ordenan por impacto absoluto.
 */
export function defaultScenarios(inputs: Inputs, params: ModelParams): ScenarioChange[] {
  const candidates: ScenarioChange[] = [];
  for (const b of scenarioBounds(inputs, params)) {
    let target: number;
    switch (b.field) {
      case 'cigarettes_per_day':
        target = 0;
        break;
      case 'alcohol_units_week':
        target = round(inputs.alcohol_units_week / 2, 1);
        break;
      case 'waist_to_height_ratio':
        target = round(Math.max(b.min, inputs.waist_to_height_ratio - 0.02), 3);
        break;
      case 'resting_hr_bpm':
        target = Math.max(b.min, inputs.resting_hr_bpm - 5);
        break;
    }
    target = Math.min(b.max, Math.max(b.min, target));
    if (target < b.max) candidates.push({ field: b.field, to: target });
  }

  const baseRaw = calculate(inputs, params).morrow_age;
  const scored = candidates.map((c) => ({
    change: c,
    impact: Math.abs(calculate({ ...inputs, [c.field]: c.to }, params).morrow_age - baseRaw),
  }));
  scored.sort((a, b) => b.impact - a.impact || SCENARIO_FIELDS.indexOf(a.change.field) - SCENARIO_FIELDS.indexOf(b.change.field));
  return scored.slice(0, MAX_SCENARIOS).map((s) => s.change);
}
