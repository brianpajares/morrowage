/**
 * Adaptador tipado generado desde `spec/inputs.schema.json`.
 * El PRD (§11) prohíbe duplicar o reinterpretar rangos en componentes: la UI, la validación
 * server-side y las conversiones consumen este módulo. Un test verifica que coincide con
 * los guardrails del modelo (`drive/model/model_coefficients_v2.json`).
 */
import schema from '@spec/inputs.schema.json';
import type { Locale } from '@/lib/locales';

export const INPUT_FIELDS = [
  'age_years',
  'sleep_hours',
  'self_rated_health',
  'cigarettes_per_day',
  'reaction_time_ms',
  'waist_to_height_ratio',
  'alcohol_units_week',
  'resting_hr_bpm',
] as const;

export type InputField = (typeof INPUT_FIELDS)[number];

export const SRH_VALUES = ['excellent', 'good', 'fair', 'poor'] as const;
export type SelfRatedHealth = (typeof SRH_VALUES)[number];

export type NumericField = Exclude<InputField, 'self_rated_health'>;

export interface Inputs {
  age_years: number;
  sleep_hours: number;
  self_rated_health: SelfRatedHealth;
  cigarettes_per_day: number;
  reaction_time_ms: number;
  waist_to_height_ratio: number;
  alcohol_units_week: number;
  resting_hr_bpm: number;
}

export interface NumericFieldSpec {
  kind: 'integer' | 'number';
  min: number;
  max: number;
  unit: string;
  help: Record<Locale, string>;
  whereToFind: Record<Locale, string>;
}

export interface EnumFieldSpec {
  kind: 'enum';
  values: readonly SelfRatedHealth[];
  labels: Record<Locale, Record<SelfRatedHealth, string>>;
  help: Record<Locale, string>;
  whereToFind: Record<Locale, string>;
}

type RawProp = {
  type: string;
  minimum?: number;
  maximum?: number;
  unit?: string;
  enum?: string[];
  help: Record<Locale, string>;
  where_to_find: Record<Locale, string>;
  ui_labels?: Record<Locale, Record<SelfRatedHealth, string>>;
};

const props = schema.properties as unknown as Record<InputField, RawProp>;

function numericSpec(field: NumericField): NumericFieldSpec {
  const p = props[field];
  if (p.minimum === undefined || p.maximum === undefined) {
    throw new Error(`inputs.schema.json: ${field} sin minimum/maximum`);
  }
  return {
    kind: p.type === 'integer' ? 'integer' : 'number',
    min: p.minimum,
    max: p.maximum,
    unit: p.unit ?? '',
    help: p.help,
    whereToFind: p.where_to_find,
  };
}

export const NUMERIC_FIELDS: readonly NumericField[] = INPUT_FIELDS.filter(
  (f): f is NumericField => f !== 'self_rated_health',
);

export const NUMERIC_SPEC = Object.fromEntries(
  NUMERIC_FIELDS.map((f) => [f, numericSpec(f)]),
) as Record<NumericField, NumericFieldSpec>;

const srh = props.self_rated_health;
export const SRH_SPEC: EnumFieldSpec = {
  kind: 'enum',
  values: SRH_VALUES,
  labels: srh.ui_labels as Record<Locale, Record<SelfRatedHealth, string>>,
  help: srh.help,
  whereToFind: srh.where_to_find,
};

/** Rango [min, max] por campo numérico, derivado del schema. */
export function rangeOf(field: NumericField): readonly [number, number] {
  const s = NUMERIC_SPEC[field];
  return [s.min, s.max];
}

export const REQUIRED_FIELDS: readonly InputField[] = schema.required as InputField[];
