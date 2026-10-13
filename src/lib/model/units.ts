/**
 * Conversiones de captura → valores canónicos del motor (FR-03).
 * Nada de lo que hay aquí redondea: el valor canónico es exacto y las rondas son solo de
 * presentación. Así cm/cm = in/in sin deriva (AT-04).
 */
export type LengthUnit = 'cm' | 'in';
export type AlcoholMode = 'us_drinks' | 'uk_units' | 'grams';

export const CM_PER_INCH = 2.54;
/** 1 unidad UK = 8 g de etanol (S09). */
export const GRAMS_PER_UK_UNIT = 8;
/** 1 bebida estándar US = 14 g de etanol = 1.75 unidades UK (S10). */
export const US_DRINK_GRAMS = 14;
export const US_DRINK_UK_UNITS = US_DRINK_GRAMS / GRAMS_PER_UK_UNIT;

export function cmToIn(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

/** Relación cintura/altura (sin unidades). Ambas medidas deben estar en la misma unidad. */
export function waistToHeightRatio(waist: number, height: number): number | null {
  if (!Number.isFinite(waist) || !Number.isFinite(height) || waist <= 0 || height <= 0) return null;
  return waist / height;
}

/** Alcohol semanal → unidades UK/semana. */
export function alcoholToUkUnits(value: number, mode: AlcoholMode): number {
  switch (mode) {
    case 'uk_units':
      return value;
    case 'us_drinks':
      return value * US_DRINK_UK_UNITS;
    case 'grams':
      return value / GRAMS_PER_UK_UNIT;
  }
}

/**
 * Parseo estricto de un número tecleado, con coma o punto decimal.
 * Devuelve null ante cualquier cosa que no sea un decimal simple (letras, exponentes, "1,2,3"…).
 * Con ambos separadores, el último es el decimal ("1.234,5" → 1234.5).
 */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '');
  if (s === '') return null;
  if (!/^[+-]?[\d.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandSep = decimalSep === '.' ? ',' : '.';
    normalized = s.split(thousandSep).join('').replace(decimalSep, '.');
  } else if (lastComma !== -1) {
    if (s.indexOf(',') !== lastComma) return null; // varias comas sin punto: ambiguo
    normalized = s.replace(',', '.');
  } else {
    if (s.indexOf('.') !== lastDot) return null;
    normalized = s;
  }
  if (!/^[+-]?\d+(\.\d+)?$|^[+-]?\.\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
