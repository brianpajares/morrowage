/** Utilidades de formato seguras para el navegador (sin `node:crypto`). */
export function isVerificationId(value: string): boolean {
  return /^MA-\d{2}-[0-9A-F]{6}$/.test(value);
}
