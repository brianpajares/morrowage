/**
 * Construye `ReportData` a partir de un cálculo guardado. Función pura y determinista.
 * Es la única fuente para informe web, PDF y emails: así lo que se ve en el PDF es exactamente
 * lo que se ve en la web, sin claims adicionales (`ux/report_layout.md`).
 */
import { createHash } from 'node:crypto';
import { calculate, DRIVER_FIELDS, round, sensitivityTerms, type DriverField, type ModelOutput } from '@/lib/model/engine';
import { safeAge, safeDelta } from '@/lib/model/display';
import type { Inputs } from '@/lib/model/input-spec';
import type { ModelParams } from '@/lib/model/params';
import { defaultScenarios, MAX_SCENARIOS, runScenarios, scenarioBounds } from '@/lib/model/scenarios';
import type { Locale } from '@/lib/locales';
import type { AccessTier, ReportData, ReportDriverRow } from './types';

export const PACKAGE_VERSION = '4.0';

export interface BuildReportInput {
  inputs: Inputs;
  /** Si se omite se recalcula con `params` (determinista). */
  output?: ModelOutput;
  params: ModelParams;
  verificationId: string;
  appVersion: string;
  accessTier: AccessTier;
  locale: Locale;
  generatedAt: string;
}

function benchmarkFor(field: DriverField, params: ModelParams): number | null {
  switch (field) {
    case 'sleep_hours':
      return params.ref.sleep;
    case 'self_rated_health':
      return null;
    case 'cigarettes_per_day':
      return params.ref.cigs;
    case 'reaction_time_ms':
      return params.ref.reaction;
    case 'waist_to_height_ratio':
      return params.ref.wthr;
    case 'alcohol_units_week':
      return params.ref.alcohol;
    case 'resting_hr_bpm':
      return params.ref.rhr;
  }
}

export function buildReportData(i: BuildReportInput): ReportData {
  const { inputs, params } = i;
  const out = i.output ?? calculate(inputs, params);
  const range = params.referenceAgeRange;

  const drivers: ReportDriverRow[] = DRIVER_FIELDS.map((field) => {
    const contribution = out.drivers[field];
    return {
      field,
      userValue: inputs[field],
      benchmarkValue: benchmarkFor(field, params),
      contribution,
      direction: Math.abs(contribution) < 5e-4 ? 'neutral' : contribution > 0 ? 'higher' : 'lower',
    } satisfies ReportDriverRow;
  }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const sens = out.measurement_sensitivity;
  const delta = safeDelta(out.morrow_age, inputs.age_years, range);
  const base = safeAge(out.morrow_age, range);

  const scenarios = runScenarios(inputs, defaultScenarios(inputs, params), params);

  const data: Omit<ReportData, 'checksum'> = {
    schema: 1,
    verificationId: i.verificationId,
    modelVersion: out.model_version,
    appVersion: i.appVersion,
    packageVersion: PACKAGE_VERSION,
    generatedAt: i.generatedAt,
    accessTier: i.accessTier,
    locale: i.locale,
    chronologicalAge: inputs.age_years,
    result: {
      status: base.status,
      display: base.display,
      ...(base.value !== undefined ? { value: base.value } : {}),
      ...(delta !== undefined ? { delta } : {}),
      relativeHazard: round(out.relative_hazard, 2),
    },
    referenceRange: [range[0], range[1]],
    topDriver: { field: out.top_driver.name, contribution: out.top_driver.log_hazard_contribution },
    drivers,
    sensitivity: {
      low: safeAge(sens.morrow_age_low, range),
      base: safeAge(sens.morrow_age_base, range),
      high: safeAge(sens.morrow_age_high, range),
      terms: sensitivityTerms(inputs, params).map((t) => ({
        field: t.field,
        requested: t.requested,
        down: t.down,
        up: t.up,
        clipped: t.clipped,
      })),
    },
    scenarios,
    whatIf: { inputs, params, bounds: scenarioBounds(inputs, params), maxScenarios: MAX_SCENARIOS },
  };

  return { ...data, checksum: payloadChecksum(data) };
}

/** Checksum corto del payload estructurado SIN `whatIf` (que contiene inputs) ni PII. */
export function payloadChecksum(data: Omit<ReportData, 'checksum'>): string {
  const { whatIf: _whatIf, ...safe } = data;
  return createHash('sha256').update(JSON.stringify(safe)).digest('hex').slice(0, 12).toUpperCase();
}
