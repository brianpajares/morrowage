import type { ReportDriverRow } from '@/lib/report/types';
import { cn } from '@/lib/cn';

/**
 * Barras divergentes de contribución al log-hazard frente al benchmark (design_tokens.chart):
 * etiquetadas como "asociación", nunca como "causa". No depende del color: dirección (izquierda/derecha),
 * signo del valor y tabla equivalente debajo. Sin semáforo rojo/verde.
 */
export function DriversChart({
  rows,
  labelFor,
  formatContribution,
  ariaLabel,
}: {
  rows: ReportDriverRow[];
  labelFor: (field: ReportDriverRow['field']) => string;
  formatContribution: (n: number) => string;
  ariaLabel: string;
}) {
  const max = Math.max(1e-6, ...rows.map((r) => Math.abs(r.contribution)));
  return (
    <ul className="space-y-2.5" role="img" aria-label={ariaLabel}>
      {rows.map((r) => {
        const pct = (Math.abs(r.contribution) / max) * 50;
        const positive = r.contribution >= 0;
        return (
          <li key={r.field} className="grid grid-cols-[minmax(0,9.5rem)_1fr_4.5rem] items-center gap-3 sm:grid-cols-[12rem_1fr_5rem]" aria-hidden="true">
            <span className="truncate text-sm font-semibold">{labelFor(r.field)}</span>
            <span className="relative h-5 rounded-sm bg-surface-alt">
              <span className="absolute inset-y-0 left-1/2 w-px bg-locked/60" />
              <span
                className={cn('absolute inset-y-0.5 rounded-sm', positive ? 'bg-slate-600 dark:bg-slate-300' : 'bg-primary')}
                style={{ width: `${Math.max(pct, 1.2)}%`, [positive ? 'left' : 'right']: '50%' }}
              />
            </span>
            <span className="text-right text-sm font-bold tabular">{formatContribution(r.contribution)}</span>
          </li>
        );
      })}
    </ul>
  );
}
