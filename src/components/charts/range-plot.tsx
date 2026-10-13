import type { SafeAge } from '@/lib/model/display';

/**
 * Sensibilidad de medición: tres puntos (bajo / base / alto) sobre la escala 40–69. Fuera de rango se
 * dibuja una flecha pegada al borde y el texto `<40` / `>69` (jamás un valor exacto). Es un escenario
 * de medición, NO un intervalo de confianza.
 */
export function RangePlot({
  points,
  range = [40, 69],
  title,
  summary,
}: {
  points: Array<{ label: string; age: SafeAge }>;
  range?: readonly [number, number];
  title: string;
  summary: string;
}) {
  const W = 640;
  const PAD = 44;
  const Y = 70;
  const [min, max] = range;
  const x = (v: number) => PAD + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (W - PAD * 2);
  const xs = points.map((p) => (p.age.value !== undefined ? x(p.age.value) : p.age.status === 'BELOW_REFERENCE_RANGE' ? x(min) : x(max)));
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} 150`} role="img" aria-label={`${title}. ${summary}`} className="h-auto w-full overflow-visible">
        <title>{title}</title>
        <rect x={PAD} y={Y - 6} width={W - PAD * 2} height={12} rx={6} fill="var(--surface-alt)" stroke="var(--border)" />
        <line x1={Math.min(...xs)} x2={Math.max(...xs)} y1={Y} y2={Y} stroke="var(--primary)" strokeWidth={6} strokeLinecap="round" opacity={0.45} />
        {[min, 50, 60, max].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={Y + 12} y2={Y + 20} stroke="var(--locked)" strokeWidth={1.5} />
            <text x={x(t)} y={Y + 38} textAnchor="middle" fontSize={14} fill="var(--text-muted)" className="tabular">
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const px = xs[i]!;
          const base = i === 1;
          // Bajo: etiqueta alineada a la izquierda del punto; alto: a la derecha; base: centrada arriba (evita solapes).
          const anchor = base ? 'middle' : i === 0 ? 'end' : 'start';
          const labelX = base ? Math.min(Math.max(px, PAD + 46), W - PAD - 46) : i === 0 ? Math.max(px + 14, PAD + 120) : Math.min(px - 14, W - PAD - 120);
          return (
            <g key={p.label}>
              {p.age.value !== undefined ? (
                <circle cx={px} cy={Y} r={base ? 14 : 11} fill={base ? 'var(--primary)' : 'var(--surface)'} stroke="var(--primary)" strokeWidth={4} />
              ) : (
                <path
                  d={p.age.status === 'BELOW_REFERENCE_RANGE' ? `M ${px + 4} ${Y - 14} L ${px - 14} ${Y} L ${px + 4} ${Y + 14} Z` : `M ${px - 4} ${Y - 14} L ${px + 14} ${Y} L ${px - 4} ${Y + 14} Z`}
                  fill="var(--primary)"
                />
              )}
              <text x={labelX} y={base ? Y - 26 : Y + 66} textAnchor={anchor} fontSize={14} fontWeight={700} fill="var(--text)" className="tabular">
                {p.label}: {p.age.display}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{p.age.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
