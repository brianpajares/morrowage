/**
 * Normalización defensiva de direcciones de correo leídas de variables de entorno.
 * Lecciones reales de PivotWorth (playbook §7, #2 y #3): un valor pegado con texto extra
 * («info@x.com (ya es el valor por defecto)») o con comillas literales provoca 422 en Resend.
 */
const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;

/** Primera dirección de email válida dentro de un texto, en minúsculas. `undefined` si no hay. */
export function extractEmail(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const m = EMAIL_RE.exec(raw);
  return m ? m[0].toLowerCase() : undefined;
}

/** `ana.perez@gmail.com` → `a***@gmail.com` (para mostrar el destino sin exponer la dirección completa). */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

/** Remitente siempre como `Nombre <dirección>`; tolera comillas y texto extra. */
export function normalizeFrom(raw: string | undefined, fallbackName = 'MorrowAge'): string | undefined {
  const address = extractEmail(raw);
  if (!address) return undefined;
  const beforeAngle = (raw ?? '').split('<')[0] ?? '';
  const named = beforeAngle.includes('@') ? '' : beforeAngle.replace(/["'<>;,]/g, '').trim();
  const name = (named || fallbackName).slice(0, 60);
  return `${name} <${address}>`;
}
