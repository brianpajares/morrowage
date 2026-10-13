import { describe, expect, it } from 'vitest';
import vectorsFile from '@spec/test_vectors.json';
import { calculate } from './engine';
import { getBundledModelParams } from './bundled';

/** Equivalente a Python `math.isclose(a, b, rel_tol, abs_tol)`. */
function isClose(a: number, b: number, relTol = 1e-6, absTol = 1e-9): boolean {
  return Math.abs(a - b) <= Math.max(relTol * Math.max(Math.abs(a), Math.abs(b)), absTol);
}

type Expected = Record<string, unknown>;

function compare(path: string, actual: unknown, expected: unknown, failures: string[]): void {
  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || !isClose(actual, expected)) {
      failures.push(`${path}: esperado ${expected}, obtenido ${String(actual)}`);
    }
  } else if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      failures.push(`${path}: longitud distinta`);
      return;
    }
    expected.forEach((e, i) => compare(`${path}[${i}]`, actual[i], e, failures));
  } else if (expected !== null && typeof expected === 'object') {
    for (const [k, v] of Object.entries(expected as Expected)) {
      compare(`${path}.${k}`, (actual as Expected | undefined)?.[k], v, failures);
    }
  } else if (actual !== expected) {
    failures.push(`${path}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`);
  }
}

describe('AT-06 · golden vectors (engine TS vs engine_reference.py)', () => {
  const params = getBundledModelParams();

  it('contiene los 18 vectores del paquete', () => {
    expect(vectorsFile.count).toBe(18);
    expect(vectorsFile.vectors).toHaveLength(18);
  });

  for (const vector of vectorsFile.vectors) {
    it(`${vector.id} (${vector.case_type}) coincide con rel_tol 1e-6`, () => {
      const actual = calculate(vector.inputs, params);
      const failures: string[] = [];
      compare('output', actual, vector.expected_outputs, failures);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }

  it('TC03/TC16 (fuera de rango) censuran el display como <40 / >69', () => {
    const byId = (id: string) => vectorsFile.vectors.find((v) => v.id === id);
    const tc03 = byId('TC03');
    const tc16 = byId('TC16');
    expect(tc03 && calculate(tc03.inputs, params).morrow_age_display).toBe('<40');
    expect(tc16 && calculate(tc16.inputs, params).morrow_age_display).toBe('>69');
  });

  it('el motor nunca habilita mortalidad absoluta a 10 años', () => {
    for (const vector of vectorsFile.vectors) {
      const out = calculate(vector.inputs, params);
      expect(out.absolute_mortality_10y).toBeNull();
      expect(out.absolute_mortality_10y_status).toBe('LOCKED_REQUIRES_BASELINE_SURVIVAL_RECALIBRATION');
    }
  });
});
