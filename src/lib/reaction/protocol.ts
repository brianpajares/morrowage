/**
 * Protocolo de reacción `snap-v1` (PRELIMINAR; PRD §29 / open issue "protocolo reaction-time").
 *
 * El benchmark del modelo (media 558 ms) proviene de la prueba de emparejamiento de UK Biobank, una
 * tarea de decisión, más lenta que una reacción simple (~250 ms). Por eso la prueba integrada es de
 * decisión: se muestran dos símbolos; si son iguales hay que tocar, si son distintos no. El valor
 * enviado al motor es la MEDIANA de los tiempos de las rondas "iguales" válidas, en ms enteros.
 *
 * El valor crudo nunca va a analítica: solo `protocol_version` y un bucket de intentos (AT-05).
 */
export const PROTOCOL_VERSION = 'snap-v1';
export const PRACTICE_ROUNDS = 3;
export const MEASURED_ROUNDS = 10;
export const MATCH_ROUNDS = 6;
/** Mínimo de aciertos válidos para aceptar la medición. */
export const MIN_VALID_RESPONSES = 4;
/** Respuestas más rápidas se consideran anticipaciones y se descartan. */
export const ANTICIPATION_MS = 150;
export const MATCH_TIMEOUT_MS = 3000;
export const NON_MATCH_WINDOW_MS = 1400;
export const WAIT_MIN_MS = 1000;
export const WAIT_MAX_MS = 2500;

export const SYMBOLS = ['circle', 'square', 'triangle', 'diamond'] as const;
export type Symbol = (typeof SYMBOLS)[number];

export interface Round {
  kind: 'practice' | 'measure';
  match: boolean;
  left: Symbol;
  right: Symbol;
}

function pickSymbols(match: boolean, rand: () => number): [Symbol, Symbol] {
  const a = SYMBOLS[Math.floor(rand() * SYMBOLS.length)]!;
  if (match) return [a, a];
  const rest = SYMBOLS.filter((s) => s !== a);
  return [a, rest[Math.floor(rand() * rest.length)]!];
}

function shuffleNoLongRuns(rand: () => number): boolean[] {
  const base = [...Array(MATCH_ROUNDS).fill(true), ...Array(MEASURED_ROUNDS - MATCH_ROUNDS).fill(false)] as boolean[];
  for (let attempt = 0; attempt < 200; attempt++) {
    const arr = [...base];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    const hasRun = arr.some((v, i) => i >= 2 && v === arr[i - 1] && v === arr[i - 2]);
    if (!hasRun) return arr;
  }
  // Orden determinista de respaldo (cumple la restricción de rachas).
  return [true, false, true, true, false, true, false, true, true, false];
}

export function planRounds(rand: () => number = Math.random): Round[] {
  const practiceKinds = [true, false, true];
  const rounds: Round[] = [];
  for (const match of practiceKinds) {
    const [left, right] = pickSymbols(match, rand);
    rounds.push({ kind: 'practice', match, left, right });
  }
  for (const match of shuffleNoLongRuns(rand)) {
    const [left, right] = pickSymbols(match, rand);
    rounds.push({ kind: 'measure', match, left, right });
  }
  return rounds;
}

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export type Summary =
  | { status: 'ok'; ms: number }
  | { status: 'too_few' }
  | { status: 'invalid_range'; ms: number };

/** Mediana en ms enteros; se rechaza (no se recorta) si queda fuera de [min, max] (guardrail 250–1500). */
export function summarize(responsesMs: readonly number[], range: readonly [number, number]): Summary {
  const valid = responsesMs.filter((r) => r >= ANTICIPATION_MS && r <= MATCH_TIMEOUT_MS);
  if (valid.length < MIN_VALID_RESPONSES) return { status: 'too_few' };
  const ms = Math.round(median(valid));
  return ms < range[0] || ms > range[1] ? { status: 'invalid_range', ms } : { status: 'ok', ms };
}
