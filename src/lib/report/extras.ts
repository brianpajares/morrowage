/**
 * Datos derivados para las secciones ampliadas del informe (perfil frente al benchmark, preguntas
 * para el profesional). Función pura y determinista; sirve igual al informe web y al PDF.
 * Solo usa valores ya presentes en `ReportData` (sin raw fuera de 40–69, sin eta/Δlp).
 */
import { DRIVER_FIELDS, type DriverField } from '@/lib/model/engine';
import { rangeOf, type NumericField, type SelfRatedHealth } from '@/lib/model/input-spec';
import type { ReportData } from './types';

/** Campos con guía de medición (todos los drivers; la edad no se «mide»). */
export const GUIDE_FIELDS = DRIVER_FIELDS;

export { FULL_REPORT_PAGES } from './constants';

export interface ProfileRow {
  field: DriverField;
  userValue: number | SelfRatedHealth;
  benchmarkValue: number | null;
  /** `category` = salud autopercibida (no hay posición numérica). */
  position: 'above' | 'below' | 'near' | 'category';
  min?: number;
  max?: number;
  /** Posición normalizada 0–1 dentro del rango del dato. */
  userFrac?: number;
  benchFrac?: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Orden canónico del modelo (no por peso) para que la tabla sea estable y fácil de recorrer. */
export function buildProfileRows(data: ReportData): ProfileRow[] {
  return DRIVER_FIELDS.map((field): ProfileRow => {
    const d = data.drivers.find((x) => x.field === field)!;
    if (field === 'self_rated_health' || d.benchmarkValue === null) {
      return { field, userValue: d.userValue, benchmarkValue: null, position: 'category' };
    }
    const [min, max] = rangeOf(field as NumericField);
    const user = d.userValue as number;
    const span = max - min;
    const diff = user - d.benchmarkValue;
    return {
      field,
      userValue: user,
      benchmarkValue: d.benchmarkValue,
      position: Math.abs(diff) <= span * 0.05 ? 'near' : diff > 0 ? 'above' : 'below',
      min,
      max,
      userFrac: clamp01((user - min) / span),
      benchFrac: clamp01((d.benchmarkValue - min) / span),
    };
  });
}

/** Las dos asociaciones de mayor peso (datos para «preguntar»; no son causas ni consejos). */
export function topDriverFields(data: ReportData, n = 2): DriverField[] {
  return data.drivers.slice(0, n).map((d) => d.field);
}
