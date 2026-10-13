'use client';

import { useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locales';
import { runScenarios, type ScenarioChange, type ScenarioField, type ScenarioResult } from '@/lib/model/scenarios';
import { formatNumber, formatSigned } from '@/lib/report/format';
import type { ReportData } from '@/lib/report/types';
import { parseDecimal } from '@/lib/model/units';

/**
 * Escenarios educativos (US-17, AT-24). Recalcula en el navegador con el mismo motor determinista:
 * hasta 3 escenarios, un dato distinto en cada uno, solo reducciones y siempre dentro de guardrails.
 * No genera recomendaciones; el resultado usa el mismo censor `<40`/`>69`.
 */
export function ScenarioExplorer({ whatIf, initial }: { whatIf: ReportData['whatIf']; initial: ScenarioChange[] }) {
  const t = useTranslations('report.scenarios');
  const v = useTranslations('variables');
  const locale = useLocale() as Locale;
  const uid = useId();
  const [items, setItems] = useState<ScenarioChange[]>(initial.slice(0, whatIf.maxScenarios));

  const bounds = useMemo(() => new Map(whatIf.bounds.map((b) => [b.field, b])), [whatIf.bounds]);
  const used = new Set(items.map((i) => i.field));
  const available = whatIf.bounds.filter((b) => !used.has(b.field));

  const results = useMemo<ScenarioResult[]>(() => {
    try {
      return runScenarios(whatIf.inputs, items, whatIf.params);
    } catch {
      return [];
    }
  }, [items, whatIf]);

  const fmt = (field: ScenarioField, n: number) => {
    const unit = v(`${field}.unit`);
    const digits = field === 'waist_to_height_ratio' ? 3 : field === 'alcohol_units_week' ? 2 : 0;
    return `${formatNumber(locale, n, 0, digits)}${unit ? ` ${unit}` : ''}`;
  };

  const update = (field: ScenarioField, raw: number) => {
    const b = bounds.get(field)!;
    const clamped = Math.min(b.max, Math.max(b.min, b.integer ? Math.round(raw) : raw));
    setItems((cur) => cur.map((it) => (it.field === field ? { ...it, to: clamped } : it)));
  };

  return (
    <div className="space-y-4">
      {items.length === 0 && whatIf.bounds.length === 0 ? <p className="text-muted">{t('none')}</p> : null}
      {items.length === 0 && whatIf.bounds.length > 0 ? <p className="text-muted">{t('noneSelected')}</p> : null}

      <ul className="space-y-4">
        {items.map((it, idx) => {
          const b = bounds.get(it.field)!;
          const r = results.find((x) => x.field === it.field);
          const id = `${uid}-${it.field}`;
          return (
            <li key={it.field} className="rounded-lg border border-line bg-surface p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold">
                  {t('change', { variable: v(`${it.field}.label`), from: fmt(it.field, whatIf.inputs[it.field]), to: fmt(it.field, it.to) })}
                </p>
                <button
                  type="button"
                  onClick={() => setItems((cur) => cur.filter((x) => x.field !== it.field))}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-alt hover:text-fg"
                  aria-label={`${t('remove')}: ${v(`${it.field}.label`)} (${idx + 1})`}
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_9rem] sm:items-end">
                <div>
                  <label htmlFor={`${id}-range`} className="text-sm font-semibold">
                    {t('target')}
                  </label>
                  <input
                    id={`${id}-range`}
                    type="range"
                    min={b.min}
                    max={b.max}
                    step={b.step}
                    value={it.to}
                    onChange={(e) => update(it.field, Number(e.target.value))}
                    className="mt-2 h-11 w-full accent-[var(--primary)]"
                    aria-valuetext={fmt(it.field, it.to)}
                  />
                  <div className="flex justify-between text-xs text-muted tabular">
                    <span>{fmt(it.field, b.min)}</span>
                    <span>{fmt(it.field, b.max)}</span>
                  </div>
                </div>
                <div>
                  <label htmlFor={`${id}-num`} className="sr-only">
                    {t('target')}
                  </label>
                  <input
                    id={`${id}-num`}
                    type="text"
                    inputMode="decimal"
                    defaultValue={String(it.to)}
                    key={`${it.field}-${it.to}`}
                    onBlur={(e) => {
                      const n = parseDecimal(e.target.value);
                      if (n !== null) update(it.field, n);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const n = parseDecimal((e.target as HTMLInputElement).value);
                        if (n !== null) update(it.field, n);
                      }
                    }}
                    className="min-h-12 w-full rounded-md border border-line bg-surface px-3 text-lg font-bold tabular"
                  />
                </div>
              </div>
              {r ? (
                <dl className="mt-4 grid grid-cols-3 gap-3 rounded-md bg-surface-alt/70 p-4 text-center" aria-live="polite">
                  <div>
                    <dt className="text-xs text-muted">{t('baseline')}</dt>
                    <dd className="text-xl font-extrabold tabular">{r.baseline.display}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t('scenario')}</dt>
                    <dd className="text-xl font-extrabold text-primary tabular">{r.scenario.display}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t('difference')}</dt>
                    <dd className="text-base font-bold tabular">
                      {r.difference !== undefined ? t('years', { years: formatSigned(locale, r.difference, 1) }) : <span className="text-xs font-normal text-muted">{t('differenceHidden')}</span>}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        {items.length < whatIf.maxScenarios && available.length > 0 ? (
          <label className="flex flex-wrap items-center gap-3">
            <span className="sr-only">{t('field')}</span>
            <select
              className="min-h-12 rounded-md border border-line bg-surface px-3 text-base font-semibold"
              value=""
              onChange={(e) => {
                const f = e.target.value as ScenarioField;
                const b = bounds.get(f);
                if (b) setItems((cur) => [...cur, { field: f, to: b.min }]);
              }}
              aria-label={t('add')}
            >
              <option value="" disabled>
                + {t('add')}
              </option>
              {available.map((b) => (
                <option key={b.field} value={b.field}>
                  {v(`${b.field}.label`)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {items.length >= whatIf.maxScenarios ? <p className="text-sm text-muted">{t('max', { max: whatIf.maxScenarios })}</p> : null}
        {items.length === 0 && available.length > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setItems([{ field: available[0]!.field, to: available[0]!.min }])}>
            <Plus className="size-4" aria-hidden="true" />
            {t('add')}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted">{t('disclaimer')}</p>
    </div>
  );
}
