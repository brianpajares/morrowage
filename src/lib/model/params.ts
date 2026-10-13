/**
 * Parámetros del modelo v2.1. Fuente única de números: `drive/model/model_coefficients_v2.json`
 * (mismo archivo que se sincroniza a Google Drive y se verifica por SHA-256). Este módulo solo
 * lo valida y lo traduce a la forma que consume el motor; no contiene coeficientes propios.
 */
import { z } from 'zod';
import type { NumericField } from './input-spec';

const range = z.tuple([z.number(), z.number()]);
const finite = z.number().finite();

const fileSchema = z.object({
  version: z.string().min(1),
  model: z.string().min(1),
  source: z.string().url(),
  license: z.string(),
  coefficients: z.object({
    beta_log_age: finite.positive(),
    beta_sleep: finite,
    beta_srh_excellent: finite,
    beta_srh_good: finite,
    beta_srh_fair: finite,
    beta_srh_poor: finite,
    beta_cigs: finite,
    beta_reaction: finite,
    beta_wthr: finite,
    beta_alcohol: finite,
    beta_rhr: finite,
  }),
  benchmark: z.object({
    sleep_hours: finite,
    self_rated_health_coef: finite,
    cigarettes_per_day: finite,
    reaction_time_ms: finite,
    waist_to_height_ratio: finite,
    alcohol_units_week: finite,
    resting_hr_bpm: finite,
    non_age_lp: finite,
  }),
  operational_guardrails: z.object({
    age_years: range,
    sleep_hours: range,
    cigarettes_per_day: range,
    reaction_time_ms: range,
    waist_to_height_ratio: range,
    alcohol_units_week: range,
    resting_hr_bpm: range,
  }),
  sensitivity: z.object({
    method: z.literal('bounds_aware'),
    default_deltas: z.object({
      sleep_hours: finite.nonnegative(),
      reaction_time_ms: finite.nonnegative(),
      waist_to_height_ratio: finite.nonnegative(),
      alcohol_units_week: finite.nonnegative(),
      resting_hr_bpm: finite.nonnegative(),
    }),
    note: z.string(),
  }),
  output_display: z.object({
    reference_age_range: range,
    outside: z.string(),
  }),
});

export type ModelCoefficientsFile = z.infer<typeof fileSchema>;

export type SensitivityField =
  | 'sleep_hours'
  | 'reaction_time_ms'
  | 'waist_to_height_ratio'
  | 'alcohol_units_week'
  | 'resting_hr_bpm';

export interface ModelParams {
  version: string;
  source: string;
  license: string;
  beta: {
    logAge: number;
    sleep: number;
    srh: { excellent: number; good: number; fair: number; poor: number };
    cigs: number;
    reaction: number;
    wthr: number;
    alcohol: number;
    rhr: number;
  };
  ref: {
    sleep: number;
    srhCoef: number;
    cigs: number;
    reaction: number;
    wthr: number;
    alcohol: number;
    rhr: number;
    nonAgeLp: number;
  };
  guardrails: Record<NumericField, readonly [number, number]>;
  sensitivityDeltas: Record<SensitivityField, number>;
  referenceAgeRange: readonly [number, number];
}

export function parseModelParams(json: unknown): ModelParams {
  const f = fileSchema.parse(json);
  const c = f.coefficients;
  const b = f.benchmark;
  return {
    version: f.version,
    source: f.source,
    license: f.license,
    beta: {
      logAge: c.beta_log_age,
      sleep: c.beta_sleep,
      srh: {
        excellent: c.beta_srh_excellent,
        good: c.beta_srh_good,
        fair: c.beta_srh_fair,
        poor: c.beta_srh_poor,
      },
      cigs: c.beta_cigs,
      reaction: c.beta_reaction,
      wthr: c.beta_wthr,
      alcohol: c.beta_alcohol,
      rhr: c.beta_rhr,
    },
    ref: {
      sleep: b.sleep_hours,
      srhCoef: b.self_rated_health_coef,
      cigs: b.cigarettes_per_day,
      reaction: b.reaction_time_ms,
      wthr: b.waist_to_height_ratio,
      alcohol: b.alcohol_units_week,
      rhr: b.resting_hr_bpm,
      nonAgeLp: b.non_age_lp,
    },
    guardrails: f.operational_guardrails,
    sensitivityDeltas: f.sensitivity.default_deltas,
    referenceAgeRange: f.output_display.reference_age_range,
  };
}
