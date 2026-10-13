import { cn } from '@/lib/cn';
import type { MorrowAgeStatus } from '@/lib/model/engine';

/**
 * Edad cronológica vs edad equivalente de riesgo sobre una escala fija 40–69 (design_tokens.chart):
 *  - Dentro del rango: dumbbell (anillo = cronológica, punto sólido = MorrowAge).
 *  - Fuera del rango: marcador pegado al borde con flecha de continuación; NUNCA se dibuja el raw.
 * Nunca depende del color: forma (anillo/punto/flecha) + etiquetas de texto + tabla equivalente.
 */
export interface AgeScaleProps {
  chronological: number;
  /** Solo si status = WITHIN_REFERENCE_RANGE. */
  morrow?: number;
  status: MorrowAgeStatus;
  /** `47.7`, `<40` o `>69`. */
  display: string;
  range?: readonly [number, number];
  labels: { chronological: string; morrow: string; title: string; summary: string; boundary?: string };
  className?: string;
  animate?: boolean;
}

const W = 640;
const H = 150;
const PAD = 40;
const Y = 78;

export function AgeScale({
  chronological,
  morrow,
  status,
  display,
  range = [40, 69],
  labels,
  className,
  animate = true,
}: AgeScaleProps) {
  const [min, max] = range;
  const x = (v: number) => PAD + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (W - PAD * 2);
  const ticks = [min, 50, 60, max];

  const cx = x(chronological);
  const within = status === 'WITHIN_REFERENCE_RANGE' && morrow !== undefined;
  const mx = within ? x(morrow) : status === 'BELOW_REFERENCE_RANGE' ? x(min) : x(max);
  const lo = Math.min(cx, mx);
  const hi = Math.max(cx, mx);

  return (
    <figure className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${labels.title}. ${labels.summary}`}
        className="h-auto w-full overflow-visible"
      >
        <title>{labels.title}</title>
        {/* pista */}
        <rect x={PAD} y={Y - 7} width={W - PAD * 2} height={14} rx={7} fill="var(--surface-alt)" stroke="var(--border)" />
        {/* ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={Y + 14} y2={Y + 22} stroke="var(--locked)" strokeWidth={1.5} />
            <text x={x(t)} y={Y + 42} textAnchor="middle" fontSize={14} fill="var(--text-muted)" className="tabular">
              {t}
            </text>
          </g>
        ))}
        {/* conector del dumbbell */}
        <line
          x1={lo}
          x2={hi}
          y1={Y}
          y2={Y}
          stroke="var(--primary)"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.45}
          className={animate ? 'animate-draw' : undefined}
          style={{ ['--len' as string]: Math.max(1, hi - lo), strokeDasharray: Math.max(1, hi - lo) }}
        />
        {/* cronológica: anillo */}
        <g className={animate ? 'animate-fade-in' : undefined}>
          <circle cx={cx} cy={Y} r={13} fill="var(--surface)" stroke="var(--text)" strokeWidth={4} />
          <text x={cx} y={Y - 26} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--text)" className="tabular">
            {labels.chronological}: {chronological}
          </text>
        </g>
        {/* MorrowAge: punto sólido o flecha de límite */}
        <g className={animate ? 'animate-fade-up' : undefined} style={{ animationDelay: '0.25s' }}>
          {within ? (
            <circle cx={mx} cy={Y} r={15} fill="var(--primary)" />
          ) : (
            <path
              d={
                status === 'BELOW_REFERENCE_RANGE'
                  ? `M ${mx + 4} ${Y - 15} L ${mx - 14} ${Y} L ${mx + 4} ${Y + 15} Z`
                  : `M ${mx - 4} ${Y - 15} L ${mx + 14} ${Y} L ${mx - 4} ${Y + 15} Z`
              }
              fill="var(--primary)"
            />
          )}
          <text
            x={status === 'BELOW_REFERENCE_RANGE' ? Math.max(mx, PAD + 40) : status === 'ABOVE_REFERENCE_RANGE' ? Math.min(mx, W - PAD - 40) : mx}
            y={Y + 70}
            textAnchor="middle"
            fontSize={15}
            fontWeight={800}
            fill="var(--primary)"
            className="tabular"
          >
            {labels.morrow}: {display}
          </text>
        </g>
      </svg>
      <figcaption className="mt-2 text-sm text-muted">
        <span className="sr-only">{labels.summary} </span>
        {!within && labels.boundary ? labels.boundary : null}
      </figcaption>
      {/* Tabla equivalente para lectores de pantalla */}
      <table className="sr-only">
        <caption>{labels.title}</caption>
        <tbody>
          <tr>
            <th scope="row">{labels.chronological}</th>
            <td>{chronological}</td>
          </tr>
          <tr>
            <th scope="row">{labels.morrow}</th>
            <td>{display}</td>
          </tr>
        </tbody>
      </table>
    </figure>
  );
}
