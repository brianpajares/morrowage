/**
 * Agregación del funnel a partir de contadores diarios SIN PII (`funnel_counters`) + conteos de
 * leads. Pura y determinista: es lo único que consume /admin (FR-14, AT-17).
 * Umbrales de tracción de `spec/monetizacion.json` y `docs/TRACTION_PLAN.md`.
 */
import type { FunnelCounterRow, LeadCounts } from '@/server/store/types';

export type ThresholdStatus = 'met' | 'not_met' | 'insufficient_sample' | 'not_measured';

export interface FunnelThreshold {
  metric: string;
  value: number | null;
  target: number;
  sample: number;
  minSample: number;
  status: ThresholdStatus;
}

export interface FunnelSummary {
  windowDays: number;
  totals: Record<string, number>;
  steps: Array<{ key: string; label: string; count: number }>;
  conversions: {
    visitToStart: number | null;
    startToPreview: number | null;
    previewToGate: number | null;
    gateToDelivery: number | null;
    reportOpenRate: number | null;
    calculationErrorRate: number | null;
    deliveryFailRate: number | null;
  };
  /** Pasos del assessment: vistas y completados (detección de abandono). */
  stepFunnel: Array<{ stepId: string; views: number; completes: number }>;
  /** Cubeta mediana aproximada del tiempo total hasta el preview (assessment_complete). */
  medianTimeBucket: string | null;
  byLocale: Record<string, number>;
  outOfRangeRate: number | null;
  cost: { reports: number; totalUsd: number; avgUsdPerReport: number | null };
  thresholds: FunnelThreshold[];
  leads: LeadCounts;
}

const STEP_ORDER = ['age', 'sleep', 'srh', 'cigs', 'reaction', 'wthr', 'alcohol', 'rhr'];
const BUCKET_ORDER = ['lt_5s', '5_15s', '15_30s', '30_60s', '60_90s', '90_180s', 'gte_180s'];

const ratio = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 10_000) / 10_000 : null);

function threshold(metric: string, num: number, den: number, target: number, minSample: number): FunnelThreshold {
  const value = ratio(num, den);
  const status: ThresholdStatus = den < minSample ? 'insufficient_sample' : value !== null && value >= target ? 'met' : 'not_met';
  return { metric, value, target, sample: den, minSample, status };
}

export function summarizeFunnel(counters: readonly FunnelCounterRow[], leads: LeadCounts, windowDays: number): FunnelSummary {
  const totals: Record<string, number> = {};
  const dims: Record<string, Record<string, number>> = {};
  const byLocale: Record<string, number> = {};

  for (const c of counters) {
    totals[c.event] = (totals[c.event] ?? 0) + c.count;
    (dims[c.event] ??= {})[c.dim] = ((dims[c.event] ??= {})[c.dim] ?? 0) + c.count;
    if (c.event === 'preview_view') byLocale[c.locale] = (byLocale[c.locale] ?? 0) + c.count;
  }
  const t = (k: string) => totals[k] ?? 0;

  const stepFunnel = STEP_ORDER.map((stepId) => ({
    stepId,
    views: dims.input_step_view?.[stepId] ?? 0,
    completes: dims.input_step_complete?.[stepId] ?? 0,
  }));

  let medianTimeBucket: string | null = null;
  const timeDims = dims.assessment_complete;
  if (timeDims) {
    const total = Object.values(timeDims).reduce((a, b) => a + b, 0);
    let acc = 0;
    for (const b of BUCKET_ORDER) {
      acc += timeDims[b] ?? 0;
      if (total > 0 && acc >= total / 2) {
        medianTimeBucket = b;
        break;
      }
    }
  }

  const reports = t('ops_reports_generated');
  const micro = t('ops_report_cost_micro_usd');
  const outOfRange = (dims.preview_view?.BELOW_REFERENCE_RANGE ?? 0) + (dims.preview_view?.ABOVE_REFERENCE_RANGE ?? 0);

  return {
    windowDays,
    totals,
    steps: [
      { key: 'landing_view', label: 'Visitas a la landing', count: t('landing_view') },
      { key: 'calculate_start_click', label: 'Inicio del cálculo', count: t('calculate_start_click') },
      { key: 'assessment_complete', label: 'Assessment completo', count: t('assessment_complete') },
      { key: 'preview_view', label: 'Preview visto', count: t('preview_view') },
      { key: 'email_submit', label: 'Email enviado', count: t('email_submit') },
      { key: 'report_delivery_success', label: 'Informe entregado', count: t('report_delivery_success') },
      { key: 'report_view', label: 'Informe abierto', count: t('report_view') },
    ],
    conversions: {
      visitToStart: ratio(t('calculate_start_click'), t('landing_view')),
      startToPreview: ratio(t('preview_view'), t('calculate_start_click')),
      previewToGate: ratio(t('email_submit'), t('preview_view')),
      gateToDelivery: ratio(t('report_delivery_success'), t('email_submit')),
      reportOpenRate: ratio(t('report_view'), t('report_delivery_success')),
      calculationErrorRate: ratio(t('calculation_error'), t('calculation_start')),
      deliveryFailRate: ratio(t('report_delivery_fail'), t('report_delivery_success') + t('report_delivery_fail')),
    },
    stepFunnel,
    medianTimeBucket,
    byLocale,
    outOfRangeRate: ratio(outOfRange, t('preview_view')),
    cost: {
      reports,
      totalUsd: Math.round(micro) / 1e6,
      avgUsdPerReport: reports > 0 ? Math.round((micro / reports)) / 1e6 : null,
    },
    thresholds: [
      threshold('calculator_completion_rate', t('assessment_complete'), t('calculate_start_click'), 0.45, 500),
      threshold('email_gate_conversion', t('email_submit'), t('preview_view'), 0.25, 300),
      threshold('full_report_open_rate', t('report_view'), t('report_delivery_success'), 0.45, 100),
      { metric: 'purchase_intent_or_WTP_USD19', value: null, target: 0.08, sample: 0, minSample: 200, status: 'not_measured' },
    ],
    leads,
  };
}
