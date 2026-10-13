import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBundledModelParams } from './bundled';
import { calculate, sensitivityTerms } from './engine';
import { NUMERIC_FIELDS, NUMERIC_SPEC, SRH_VALUES, rangeOf } from './input-spec';
import { assertInputs, InputValidationError, validateInputs } from './validate';
import { safeAge, safeDelta, toPreviewOutput, FREE_PREVIEW_OUTPUT_IDS } from './display';
import {
  alcoholToUkUnits,
  cmToIn,
  inToCm,
  parseDecimal,
  waistToHeightRatio,
} from './units';
import { defaultScenarios, runScenarios, scenarioBounds, ScenarioError } from './scenarios';
import { readParametros } from '../../../scripts/lib/xlsx-min';

const params = getBundledModelParams();
const base = {
  age_years: 52,
  sleep_hours: 7,
  self_rated_health: 'good' as const,
  cigarettes_per_day: 0,
  reaction_time_ms: 540,
  waist_to_height_ratio: 0.52,
  alcohol_units_week: 7,
  resting_hr_bpm: 68,
};

describe('AT-03 · validación server-side contra inputs.schema.json', () => {
  it('acepta un payload válido', () => {
    expect(validateInputs(base).ok).toBe(true);
  });

  it('rechaza faltantes (required)', () => {
    for (const key of Object.keys(base)) {
      const { [key]: _omit, ...rest } = base as Record<string, unknown>;
      const r = validateInputs(rest);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[key as keyof typeof r.errors]).toBe('required');
    }
  });

  it('rechaza min/max de cada campo numérico (no recorta)', () => {
    for (const field of NUMERIC_FIELDS) {
      const [min, max] = rangeOf(field);
      const eps = NUMERIC_SPEC[field].kind === 'integer' ? 1 : 0.0001;
      expect(validateInputs({ ...base, [field]: min - eps }).ok).toBe(false);
      expect(validateInputs({ ...base, [field]: max + eps }).ok).toBe(false);
      expect(validateInputs({ ...base, [field]: min }).ok).toBe(true);
      expect(validateInputs({ ...base, [field]: max }).ok).toBe(true);
    }
  });

  it('la edad fuera de 40–69 se reporta como out_of_scope', () => {
    for (const age of [39, 70, 18, 120]) {
      const r = validateInputs({ ...base, age_years: age });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.age_years).toBe('out_of_scope');
    }
  });

  it('exige enteros en edad, cigarrillos y pulso', () => {
    for (const field of ['age_years', 'cigarettes_per_day', 'resting_hr_bpm'] as const) {
      const r = validateInputs({ ...base, [field]: base[field] + 0.5 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[field]).toBe('not_integer');
    }
  });

  it('rechaza NaN, infinito, strings numéricos, null y booleanos', () => {
    for (const bad of [NaN, Infinity, -Infinity, '7', null, true, {}, []]) {
      expect(validateInputs({ ...base, sleep_hours: bad }).ok).toBe(false);
    }
  });

  it('valida el enum de salud autopercibida', () => {
    for (const v of SRH_VALUES) expect(validateInputs({ ...base, self_rated_health: v }).ok).toBe(true);
    for (const v of ['very_good', 'GOOD', '', 1, null]) {
      expect(validateInputs({ ...base, self_rated_health: v }).ok).toBe(false);
    }
  });

  it('rechaza campos extra (additionalProperties=false) y payloads no objeto', () => {
    expect(validateInputs({ ...base, email: 'a@b.c' }).ok).toBe(false);
    expect(validateInputs(null).ok).toBe(false);
    expect(validateInputs([]).ok).toBe(false);
    expect(() => assertInputs({})).toThrow(InputValidationError);
  });

  it('los mensajes de error nunca contienen el valor enviado', () => {
    const r = validateInputs({ ...base, sleep_hours: 99.123 });
    expect(JSON.stringify(r)).not.toContain('99.123');
  });
});

describe('contrato · inputs.schema.json ↔ modelo', () => {
  it('los guardrails del modelo coinciden con el schema de inputs', () => {
    for (const field of NUMERIC_FIELDS) {
      expect(params.guardrails[field], field).toEqual(rangeOf(field));
    }
  });
});

describe('contrato · base_morrowage.xlsx ↔ model_coefficients_v2.json', () => {
  it('la hoja Parametros describe exactamente el mismo modelo que el JSON canónico', () => {
    const xlsx = fs.readFileSync(path.resolve(__dirname, '../../../drive/base/base_morrowage.xlsx'));
    const p = readParametros(new Uint8Array(xlsx));
    const num = (k: string) => Number(p[k]);
    expect(num('beta_log_age')).toBe(params.beta.logAge);
    expect(num('beta_sleep')).toBe(params.beta.sleep);
    expect(num('beta_srh_good')).toBe(params.beta.srh.good);
    expect(num('beta_srh_fair')).toBe(params.beta.srh.fair);
    expect(num('beta_srh_poor')).toBe(params.beta.srh.poor);
    expect(num('beta_cigs')).toBe(params.beta.cigs);
    expect(num('beta_reaction')).toBe(params.beta.reaction);
    expect(num('beta_wthr')).toBe(params.beta.wthr);
    expect(num('beta_alcohol')).toBe(params.beta.alcohol);
    expect(num('beta_rhr')).toBe(params.beta.rhr);
    expect(num('ref_sleep')).toBe(params.ref.sleep);
    expect(num('ref_srh_coef')).toBeCloseTo(params.ref.srhCoef, 12);
    expect(num('ref_cigs')).toBe(params.ref.cigs);
    expect(num('ref_reaction')).toBe(params.ref.reaction);
    expect(num('ref_wthr')).toBe(params.ref.wthr);
    expect(num('ref_alcohol')).toBe(params.ref.alcohol);
    expect(num('ref_rhr')).toBe(params.ref.rhr);
    expect(num('ref_nonage_lp')).toBeCloseTo(params.ref.nonAgeLp, 12);
    expect(num('sens_sleep')).toBe(params.sensitivityDeltas.sleep_hours);
    expect(num('sens_reaction')).toBe(params.sensitivityDeltas.reaction_time_ms);
    expect(num('sens_wthr')).toBe(params.sensitivityDeltas.waist_to_height_ratio);
    expect(num('sens_alcohol')).toBe(params.sensitivityDeltas.alcohol_units_week);
    expect(num('sens_rhr')).toBe(params.sensitivityDeltas.resting_hr_bpm);
  });
});

describe('sensibilidad bounds-aware', () => {
  it('no genera escenarios imposibles: alcohol=0 no baja de 0, pulso=130 no sube de 130', () => {
    const inputs = assertInputs({ ...base, alcohol_units_week: 0, resting_hr_bpm: 130 });
    const terms = Object.fromEntries(sensitivityTerms(inputs, params).map((t) => [t.field, t]));
    expect(terms.alcohol_units_week!.down).toBe(0);
    expect(terms.alcohol_units_week!.clipped).toBe(true);
    expect(terms.resting_hr_bpm!.up).toBe(0);
    expect(terms.resting_hr_bpm!.clipped).toBe(true);
    const out = calculate(inputs, params);
    expect(out.measurement_sensitivity.morrow_age_low).toBeLessThan(out.morrow_age);
    expect(out.measurement_sensitivity.type).toBe('measurement_scenario_not_confidence_interval');
  });
});

describe('AT-08 · guardrail de display', () => {
  it('safeAge censura fuera de 40–69 y no expone valor', () => {
    const range = params.referenceAgeRange;
    expect(safeAge(38.86, range)).toEqual({ status: 'BELOW_REFERENCE_RANGE', display: '<40' });
    expect(safeAge(777.2, range)).toEqual({ status: 'ABOVE_REFERENCE_RANGE', display: '>69' });
    expect(safeAge(47.698551, range)).toEqual({
      status: 'WITHIN_REFERENCE_RANGE',
      display: '47.7',
      value: 47.7,
    });
    expect(safeDelta(777, 60, range)).toBeUndefined();
    expect(safeDelta(47.7, 52, range)).toBe(-4.3);
  });

  it('la vista previa excluye raw, delta, eta/Δlp, drivers y sensibilidad cuando está fuera de rango', () => {
    const out = calculate({ ...base, age_years: 45, self_rated_health: 'excellent', reaction_time_ms: 500, waist_to_height_ratio: 0.48, alcohol_units_week: 5, resting_hr_bpm: 62, sleep_hours: 7.5 }, params);
    expect(out.morrow_age_status).toBe('BELOW_REFERENCE_RANGE');
    const preview = toPreviewOutput(out);
    const json = JSON.stringify(preview);
    expect(preview.morrow_age).toBeUndefined();
    expect(preview.delta_age).toBeUndefined();
    expect(json).not.toContain(String(out.morrow_age));
    expect(json).not.toContain('eta_nonage');
    expect(json).not.toContain('delta_lp');
    expect(json).not.toContain('drivers');
    expect(json).not.toContain('measurement_sensitivity');
    expect(preview.morrow_age_display).toBe('<40');
  });

  it('AT-07: la vista previa contiene los elementos free_preview y no los de pago', () => {
    const preview = toPreviewOutput(calculate(base, params));
    expect(FREE_PREVIEW_OUTPUT_IDS).toEqual([
      'morrow_age_display',
      'morrow_age_status',
      'relative_hazard',
      'preview_chart',
      'preview_driver',
    ]);
    expect(preview).toHaveProperty('morrow_age_display');
    expect(preview).toHaveProperty('morrow_age_status');
    expect(preview).toHaveProperty('relative_hazard');
    expect(preview).toHaveProperty('top_driver');
    for (const locked of ['measurement_sensitivity', 'drivers', 'scenarios']) {
      expect(preview).not.toHaveProperty(locked);
    }
  });
});

describe('AT-04 · conversiones de unidades', () => {
  it('cm/cm y in/in dan la misma relación cintura/altura (deriva < 1e-6)', () => {
    const wCm = 94;
    const hCm = 180;
    const a = waistToHeightRatio(wCm, hCm)!;
    const b = waistToHeightRatio(cmToIn(wCm), cmToIn(hCm))!;
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
    expect(inToCm(cmToIn(180))).toBeCloseTo(180, 10);
  });

  it('alcohol local → unidades UK (US ×1.75, gramos /8)', () => {
    expect(alcoholToUkUnits(7, 'us_drinks')).toBeCloseTo(12.25, 10);
    expect(alcoholToUkUnits(14, 'uk_units')).toBe(14);
    expect(alcoholToUkUnits(112, 'grams')).toBe(14);
    expect(alcoholToUkUnits(0, 'us_drinks')).toBe(0);
  });

  it('rechaza cintura/altura no positivas o no finitas', () => {
    expect(waistToHeightRatio(0, 170)).toBeNull();
    expect(waistToHeightRatio(80, -1)).toBeNull();
    expect(waistToHeightRatio(NaN, 170)).toBeNull();
  });

  it('parseDecimal acepta coma/punto y rechaza ruido', () => {
    expect(parseDecimal('7,5')).toBe(7.5);
    expect(parseDecimal('7.5')).toBe(7.5);
    expect(parseDecimal(' 1.234,5 ')).toBe(1234.5);
    expect(parseDecimal('1,234.5')).toBe(1234.5);
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1e3')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('Infinity')).toBeNull();
  });
});

describe('AT-24 · escenarios what-if', () => {
  const inputs = assertInputs({
    ...base,
    cigarettes_per_day: 10,
    alcohol_units_week: 20,
    waist_to_height_ratio: 0.6,
    resting_hr_bpm: 80,
  });

  it('solo ofrece reducciones y nunca sueño, salud ni edad', () => {
    const bounds = scenarioBounds(inputs, params);
    expect(bounds.map((b) => b.field).sort()).toEqual([
      'alcohol_units_week',
      'cigarettes_per_day',
      'resting_hr_bpm',
      'waist_to_height_ratio',
    ]);
    for (const b of bounds) expect(b.max).toBe(inputs[b.field]);
    expect(bounds.map((b) => b.field as string)).not.toContain('sleep_hours');
  });

  it('no ofrece campos sin margen (0 cigarrillos, 0 alcohol)', () => {
    const none = assertInputs({ ...base, cigarettes_per_day: 0, alcohol_units_week: 0 });
    expect(scenarioBounds(none, params).map((b) => b.field)).not.toContain('cigarettes_per_day');
    expect(scenarioBounds(none, params).map((b) => b.field)).not.toContain('alcohol_units_week');
  });

  it('rechaza aumentar consumos, más de 3 escenarios, duplicados y campos no permitidos', () => {
    expect(() => runScenarios(inputs, [{ field: 'cigarettes_per_day', to: 15 }], params)).toThrow(ScenarioError);
    expect(() => runScenarios(inputs, [{ field: 'alcohol_units_week', to: 25 }], params)).toThrow(ScenarioError);
    expect(() =>
      runScenarios(
        inputs,
        [
          { field: 'cigarettes_per_day', to: 5 },
          { field: 'alcohol_units_week', to: 10 },
          { field: 'waist_to_height_ratio', to: 0.55 },
          { field: 'resting_hr_bpm', to: 70 },
        ],
        params,
      ),
    ).toThrow(/too_many/);
    expect(() =>
      runScenarios(inputs, [{ field: 'cigarettes_per_day', to: 5 }, { field: 'cigarettes_per_day', to: 2 }], params),
    ).toThrow(/duplicate/);
    expect(() => runScenarios(inputs, [{ field: 'sleep_hours' as never, to: 5 }], params)).toThrow(/not_allowed/);
    expect(() => runScenarios(inputs, [{ field: 'cigarettes_per_day', to: 2.5 }], params)).toThrow(ScenarioError);
  });

  it('un escenario de reducción nunca aumenta el MorrowAge', () => {
    const [r] = runScenarios(inputs, [{ field: 'cigarettes_per_day', to: 0 }], params);
    expect(r?.scenario.value).toBeLessThan(r!.baseline.value ?? Infinity);
    expect(r?.difference).toBeLessThan(0);
  });

  it('defaultScenarios devuelve ≤3 cambios válidos y deterministas', () => {
    const a = defaultScenarios(inputs, params);
    const b = defaultScenarios(inputs, params);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(() => runScenarios(inputs, a, params)).not.toThrow();
  });
});
