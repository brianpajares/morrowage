import type { InputField } from '@/lib/model/input-spec';

/** Los 8 pasos del assessment (orden de `ux/sitemap_flows.md`). `id` = slug de URL = `step_id` de analítica. */
export const STEPS = [
  { id: 'age', field: 'age_years' },
  { id: 'sleep', field: 'sleep_hours' },
  { id: 'srh', field: 'self_rated_health' },
  { id: 'cigs', field: 'cigarettes_per_day' },
  { id: 'reaction', field: 'reaction_time_ms' },
  { id: 'wthr', field: 'waist_to_height_ratio' },
  { id: 'alcohol', field: 'alcohol_units_week' },
  { id: 'rhr', field: 'resting_hr_bpm' },
] as const satisfies ReadonlyArray<{ id: string; field: InputField }>;

export type StepId = (typeof STEPS)[number]['id'];

export const STEP_IDS: readonly StepId[] = STEPS.map((s) => s.id);

export function stepIndex(id: string): number {
  return STEPS.findIndex((s) => s.id === id);
}

export function isStepId(id: string): id is StepId {
  return stepIndex(id) >= 0;
}

export function stepForField(field: InputField): StepId {
  return STEPS.find((s) => s.field === field)!.id;
}
