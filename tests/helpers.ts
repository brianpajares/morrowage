import { vi } from 'vitest';
import { resetDriveState } from '@/lib/drive/loader';
import { resetRateLimits } from '@/lib/security/ratelimit';
import { setErrorReporter, type SafeErrorReport } from '@/lib/observability/report-error';
import { testMailbox } from '@/server/email/send';
import { MemoryStore, setStoreForTests } from '@/server/store';

export const ORIGIN = 'http://localhost:3000';

export const TC01 = {
  age_years: 52,
  sleep_hours: 7,
  self_rated_health: 'good',
  cigarettes_per_day: 0,
  reaction_time_ms: 540,
  waist_to_height_ratio: 0.52,
  alcohol_units_week: 7,
  resting_hr_bpm: 68,
};

/** Perfil cuyo MorrowAge crudo cae por debajo de 40 (vector TC03 del spec). */
export const TC03 = {
  age_years: 45,
  sleep_hours: 7.5,
  self_rated_health: 'excellent',
  cigarettes_per_day: 0,
  reaction_time_ms: 500,
  waist_to_height_ratio: 0.48,
  alcohol_units_week: 5,
  resting_hr_bpm: 62,
};

export interface TestEnv {
  store: MemoryStore;
  reports: SafeErrorReport[];
  scheduled: Array<() => Promise<unknown>>;
  schedule: (task: () => Promise<unknown>) => void;
  flush: () => Promise<void>;
}

export function freshEnv(): TestEnv {
  const store = new MemoryStore();
  setStoreForTests(store);
  resetRateLimits();
  resetDriveState();
  testMailbox.clear();
  const reports: SafeErrorReport[] = [];
  setErrorReporter((r) => void reports.push(r));
  const scheduled: Array<() => Promise<unknown>> = [];
  return {
    store,
    reports,
    scheduled,
    schedule: (task) => void scheduled.push(task),
    flush: async () => {
      while (scheduled.length) await scheduled.shift()!();
    },
  };
}

export function jsonReq(path: string, body: unknown, headers: Record<string, string> = {}, method = 'POST'): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function getReq(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, { method: 'GET', headers });
}

export function sessionFrom(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  const m = /ma_sid=([^;]+)/.exec(raw);
  if (!m) throw new Error('sin cookie de sesión');
  return decodeURIComponent(m[1]!);
}

export function stubEnv(vars: Record<string, string | undefined>): () => void {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

export function silenceLogs() {
  const calls: string[] = [];
  const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void calls.push(args.map(String).join(' '))),
  );
  return { calls, restore: () => spies.forEach((s) => s.mockRestore()) };
}
