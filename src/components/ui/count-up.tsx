'use client';

import { useEffect, useState } from 'react';

/**
 * Número que "viaja" de `from` a `to` (solo presentación). Lectores de pantalla reciben el valor
 * final de inmediato (el número animado es aria-hidden). Con reduced-motion no anima.
 */
export function CountUp({
  from,
  to,
  decimals = 1,
  durationMs = 900,
  finalText,
  className,
}: {
  from: number;
  to: number;
  decimals?: number;
  durationMs?: number;
  /** Texto final exacto (p. ej. "47.7"): evita diferencias de formato entre el último frame y el valor real. */
  finalText: string;
  className?: string;
}) {
  const [text, setText] = useState(finalText);

  useEffect(() => {
    // Con reduced-motion el estado ya es el valor final: no se anima.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const start = performance.now();
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setText(p >= 1 ? finalText : (from + (to - from) * ease(p)).toFixed(decimals));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, decimals, durationMs, finalText]);

  return (
    <>
      <span aria-hidden="true" className={className}>
        {text}
      </span>
      <span className="sr-only">{finalText}</span>
    </>
  );
}
