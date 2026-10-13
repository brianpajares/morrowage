import { describe, expect, it } from 'vitest';
import { createTranslator, type AbstractIntlMessages } from 'next-intl';
import copy from '@spec/copy_i18n.json';
import { LOCALES } from '@/lib/locales';
import { getMessages } from '.';

type Tree = { [k: string]: Tree | string | Tree[] | string[] };

function flatten(node: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === 'string') out[prefix] = node;
  else if (Array.isArray(node)) node.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]!))].sort();

describe('AT-20 · i18n: paridad ES/EN/PT', () => {
  const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(getMessages(l))]));

  it('las tres lenguas tienen exactamente las mismas claves', () => {
    const es = Object.keys(flat.es!).sort();
    expect(Object.keys(flat.en!).sort()).toEqual(es);
    expect(Object.keys(flat.pt!).sort()).toEqual(es);
    expect(es.length).toBeGreaterThan(300);
  });

  it('cada clave tiene los mismos placeholders en las tres lenguas y ninguna está vacía', () => {
    for (const key of Object.keys(flat.es!)) {
      const ref = placeholders(flat.es![key]!);
      for (const l of LOCALES) {
        const v = flat[l]![key]!;
        // Solo las unidades de datos sin unidad (p. ej. relación cintura/altura) pueden estar vacías.
        if (!/^variables\..+\.unit$/.test(key)) expect(v.trim().length, `${l}:${key}`).toBeGreaterThan(0);
        expect(placeholders(v), `${l}:${key}`).toEqual(ref);
      }
    }
  });

  it('todos los mensajes compilan con ICU (ningún mensaje roto)', () => {
    for (const l of LOCALES) {
      const t = createTranslator({ locale: l, messages: getMessages(l) as unknown as AbstractIntlMessages });
      const args = new Proxy({}, { get: () => 1 }) as Record<string, number>;
      for (const key of Object.keys(flat[l]!)) {
        const clean = key.replace(/\[\d+\]/g, '');
        void clean;
      }
      // Recorrido por hoja: next-intl valida la sintaxis al formatear.
      for (const [key, value] of Object.entries(flat[l]!)) {
        const path = key.replace(/\[(\d+)\]/g, '.$1');
        expect(() => (t as unknown as (k: string, v: unknown) => string)(path, args), `${l}:${path}`).not.toThrow();
        void value;
      }
    }
  });

  it('el copy canónico del spec se conserva literal (sin colisiones con las extensiones)', () => {
    const walk = (node: unknown, path: string[]) => {
      if (node && typeof node === 'object' && !Array.isArray(node)) {
        const keys = Object.keys(node);
        if (keys.length === 3 && keys.includes('es') && keys.includes('en') && keys.includes('pt')) {
          for (const l of LOCALES) {
            const expected = (node as Record<string, unknown>)[l];
            const actual = path.reduce<unknown>((acc, k) => (acc as Tree)?.[k], getMessages(l));
            expect(actual, `${l}:${path.join('.')}`).toEqual(expected);
          }
          return;
        }
        for (const [k, v] of Object.entries(node)) walk(v, [...path, k]);
      }
    };
    const { meta: _m, ...rest } = copy as Record<string, unknown>;
    walk(rest, []);
  });

  it('no contiene claims prohibidos (edad biológica afirmativa, "verdadera edad", IC, mortalidad personalizada)', () => {
    const FORBIDDEN = [
      /tu (verdadera|real) edad/i,
      /your (true|real) age/i,
      /sua (verdadeira|real) idade/i,
      /tu edad biol[óo]gica (es|ser[áa])/i,
      /your biological age (is|will)/i,
      /sua idade biol[óo]gica (é|será)/i,
      /intervalo de confianza del? \d/i,
      /95 ?% ?(ci|confidence)/i,
      /vas a vivir \d/i,
      /you will live \d/i,
      /probabilidad de (morir|muerte) (es|del|de) \d/i,
      /probability of death (is|of) \d/i,
      /diagn[óo]stico (positivo|de)/i,
      /HIPAA[- ]compliant/i,
    ];
    for (const l of LOCALES) {
      for (const [key, v] of Object.entries(flat[l]!)) {
        for (const re of FORBIDDEN) expect(re.test(v), `${l}:${key} -> ${re}`).toBe(false);
      }
    }
  });
});
