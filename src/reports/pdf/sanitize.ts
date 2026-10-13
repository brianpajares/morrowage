/**
 * Las fuentes estándar de PDF (Helvetica) cubren WinAnsi/Latin-1. Para glifos fuera de ese juego
 * (griego, símbolos matemáticos) se usa una transliteración legible; así el PDF nunca muestra
 * "tofu" ni pierde sentido (p. ej. β → beta, − → -).
 */
const MAP: Array<[RegExp, string]> = [
  [/β/g, 'beta'],
  [/η/g, 'eta'],
  [/Δ/g, 'Delta'],
  [/−/g, '-'],
  [/≥/g, '>='],
  [/≤/g, '<='],
  [/≈/g, '~'],
  [/→/g, '->'],
  [/←/g, '<-'],
  [/ /g, ' '],
  [/ /g, ' '],
  [/ /g, ' '],
  [/[ - ]/g, ' '],
  [/​/g, ''],
];

export function pdfText(input: string): string {
  let out = input;
  for (const [re, rep] of MAP) out = out.replace(re, rep);
  // Cualquier otro carácter fuera de Latin-1 + puntuación WinAnsi común se reemplaza por "?".
  return out.replace(/[^ -~¡-ÿ–—‘’“”•…€ŒœŠšŸŽž†‡ˆ˜‰\n]/g, '?');
}
