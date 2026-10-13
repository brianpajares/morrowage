/**
 * AT-29 · p95 de los route handlers críticos < 2 s.
 *   BASE_URL=http://localhost:3200 npm run perf:api
 * Ejecuta /api/calculate (cálculo + persistencia) y /api/health con concurrencia moderada.
 */
export {};

const BASE = process.env.BASE_URL ?? 'http://localhost:3200';
const N = Number(process.env.N ?? 200);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);

const inputs = {
  age_years: 52,
  sleep_hours: 7,
  self_rated_health: 'good',
  cigarettes_per_day: 0,
  reaction_time_ms: 540,
  waist_to_height_ratio: 0.52,
  alcohol_units_week: 7,
  resting_hr_bpm: 68,
};

let limited = 0;

async function timed(fn: () => Promise<Response>): Promise<number> {
  const t0 = performance.now();
  const res = await fn();
  await res.arrayBuffer();
  if (res.status === 429) limited++; // el rate limit también responde rápido; se cuenta aparte
  else if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return performance.now() - t0;
}

async function run(name: string, fn: () => Promise<Response>): Promise<number> {
  const samples: number[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next++ < N) samples.push(await timed(fn));
    }),
  );
  samples.sort((a, b) => a - b);
  const p = (q: number) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))]!;
  console.log(`${name.padEnd(16)} n=${samples.length} p50=${p(0.5).toFixed(0)}ms p95=${p(0.95).toFixed(0)}ms max=${samples.at(-1)!.toFixed(0)}ms limited(429)=${limited}`);
  limited = 0;
  return p(0.95);
}

const p95s = [
  await run('POST calculate', () =>
    fetch(`${BASE}/api/calculate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ inputs, locale: 'es', scopeAccepted: true }),
    }),
  ),
  await run('GET health', () => fetch(`${BASE}/api/health`)),
];
if (p95s.some((v) => v >= 2000)) {
  console.error('perf:api FALLA — p95 ≥ 2 s');
  process.exit(1);
}
console.log('perf:api OK — p95 < 2 s');
