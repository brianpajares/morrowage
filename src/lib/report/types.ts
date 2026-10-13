import type { Locale } from '@/lib/locales';
import type { DriverField, MorrowAgeStatus } from '@/lib/model/engine';
import type { SafeAge } from '@/lib/model/display';
import type { Inputs, SelfRatedHealth } from '@/lib/model/input-spec';
import type { ModelParams, SensitivityField } from '@/lib/model/params';
import type { ScenarioBounds, ScenarioResult } from '@/lib/model/scenarios';

export type AccessTier = 'validation_full' | 'paid_full';

export interface ReportDriverRow {
  field: DriverField;
  /** Valor del usuario (para self_rated_health, la categoría). */
  userValue: number | SelfRatedHealth;
  /** Valor del benchmark; `null` para self_rated_health (media ponderada UKB, no es una categoría). */
  benchmarkValue: number | null;
  /** Contribución al log-hazard frente al benchmark. Es una asociación, no una causa. */
  contribution: number;
  direction: 'higher' | 'lower' | 'neutral';
}

export interface SensitivityRow {
  field: SensitivityField;
  requested: number;
  down: number;
  up: number;
  clipped: boolean;
}

/**
 * Estructura del informe agnóstica al idioma y libre de PII.
 * Nunca contiene el MorrowAge crudo fuera de 40–69, ni eta/Δlp, ni email, ni token.
 */
export interface ReportData {
  schema: 1;
  verificationId: string;
  modelVersion: string;
  appVersion: string;
  packageVersion: string;
  generatedAt: string;
  accessTier: AccessTier;
  /** Idioma en el que se creó el cálculo. */
  locale: Locale;
  chronologicalAge: number;
  result: {
    status: MorrowAgeStatus;
    display: string;
    value?: number;
    delta?: number;
    relativeHazard: number;
  };
  referenceRange: [number, number];
  topDriver: { field: DriverField; contribution: number };
  drivers: ReportDriverRow[];
  sensitivity: { low: SafeAge; base: SafeAge; high: SafeAge; terms: SensitivityRow[] };
  scenarios: ScenarioResult[];
  /** Todo lo necesario para el recálculo what-if en el navegador (motor determinista, sin LLM). */
  whatIf: { inputs: Inputs; params: ModelParams; bounds: ScenarioBounds[]; maxScenarios: number };
  /** SHA-256 corto del payload estructurado seguro (sin PII) para soporte/auditoría. */
  checksum: string;
}
