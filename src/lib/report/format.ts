/**
 * Formato de presentación (locale-aware) para valores del informe. Solo presentación: los valores
 * canónicos del motor no cambian con el idioma (NFR-06, AT-20).
 */
import { INTL_TAG, type Locale } from '@/lib/locales';
import { SRH_SPEC, type InputField, type SelfRatedHealth } from '@/lib/model/input-spec';
import type { Messages } from '@/messages';

export function nf(locale: Locale, min: number, max: number = min): Intl.NumberFormat {
  return new Intl.NumberFormat(INTL_TAG[locale], { minimumFractionDigits: min, maximumFractionDigits: max });
}

export function formatNumber(locale: Locale, value: number, min = 0, max = 2): string {
  return nf(locale, min, max).format(value);
}

export function formatSigned(locale: Locale, value: number, digits = 3): string {
  return new Intl.NumberFormat(INTL_TAG[locale], {
    signDisplay: 'exceptZero',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(locale: Locale, iso: string | Date): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], { dateStyle: 'long', timeZone: 'UTC' }).format(
    typeof iso === 'string' ? new Date(iso) : iso,
  );
}

const DECIMALS: Partial<Record<InputField, [number, number]>> = {
  sleep_hours: [0, 2],
  waist_to_height_ratio: [3, 3],
  alcohol_units_week: [0, 2],
  reaction_time_ms: [0, 0],
  cigarettes_per_day: [0, 0],
  resting_hr_bpm: [0, 0],
  age_years: [0, 0],
};

/** Valor + unidad localizada de un dato (p. ej. "7,5 h/noche", "Buena"). */
export function formatInputValue(
  locale: Locale,
  field: InputField,
  value: number | SelfRatedHealth,
  msg: Messages,
): string {
  if (field === 'self_rated_health') return SRH_SPEC.labels[locale][value as SelfRatedHealth];
  const [min, max] = DECIMALS[field] ?? [0, 2];
  const unit = msg.variables[field].unit;
  const n = formatNumber(locale, value as number, min, max);
  return unit ? `${n} ${unit}` : n;
}

/** Interpolación `{name}` simple (sin plurales) para textos fuera de React (PDF). */
export function interp(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}
