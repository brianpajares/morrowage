import { describe, expect, it } from 'vitest';
import { rangeOf } from '@/lib/model/input-spec';
import { ANTICIPATION_MS, MATCH_ROUNDS, MEASURED_ROUNDS, PRACTICE_ROUNDS, median, planRounds, summarize } from './protocol';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('AT-05 · protocolo de reacción snap-v1', () => {
  it('planifica 3 prácticas y 10 mediciones con 6 "iguales" y sin rachas de más de 2', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rounds = planRounds(seeded(seed));
      const practice = rounds.filter((r) => r.kind === 'practice');
      const measured = rounds.filter((r) => r.kind === 'measure');
      expect(practice).toHaveLength(PRACTICE_ROUNDS);
      expect(measured).toHaveLength(MEASURED_ROUNDS);
      expect(measured.filter((r) => r.match)).toHaveLength(MATCH_ROUNDS);
      for (const r of rounds) expect(r.left === r.right).toBe(r.match);
      measured.forEach((r, i) => {
        if (i >= 2) expect(r.match === measured[i - 1]!.match && r.match === measured[i - 2]!.match).toBe(false);
      });
    }
  });

  it('la mediana es robusta a un valor atípico', () => {
    expect(median([500, 520, 540, 560, 4000])).toBe(540);
    expect(median([400, 500])).toBe(450);
  });

  it('devuelve ms enteros y respeta el rango válido 250–1500 sin recortar', () => {
    const range = rangeOf('reaction_time_ms');
    expect(summarize([520, 540, 560, 580, 600, 620], range)).toEqual({ status: 'ok', ms: 570 });
    expect(summarize([300, 301, 302, 303], range)).toEqual({ status: 'ok', ms: 302 });
    // anticipaciones descartadas
    expect(summarize([ANTICIPATION_MS - 1, 10, 520, 540, 560, 580], range)).toEqual({ status: 'ok', ms: 550 });
    expect(summarize([200, 210, 220, 230], range)).toEqual({ status: 'invalid_range', ms: 215 });
    expect(summarize([1700, 1800, 1900, 2000], range)).toEqual({ status: 'invalid_range', ms: 1850 });
  });

  it('exige un mínimo de respuestas válidas', () => {
    const range = rangeOf('reaction_time_ms');
    expect(summarize([500, 520, 540], range)).toEqual({ status: 'too_few' });
    expect(summarize([], range)).toEqual({ status: 'too_few' });
    expect(summarize([10, 20, 30, 40, 50], range)).toEqual({ status: 'too_few' });
  });
});
