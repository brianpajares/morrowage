/**
 * Tokens de informe, Verification ID y hash de sesión.
 *  - Token: 256 bits aleatorios (base64url). En DB solo vive el hash SHA-256 (FR-13).
 *  - Verification ID: aleatorio, no derivable de email ni de datos de salud (AT-27).
 *  - session hash: HMAC-SHA-256(pepper, sid) para vincular un cálculo al navegador que lo creó.
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export function generateReportToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isPlausibleToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,256}$/.test(token);
}

/** `MA-26-8F3C2A`: año (2 dígitos) + 6 hex aleatorios. La unicidad la impone la DB (UNIQUE + reintento). */
export function generateVerificationId(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0');
  return `MA-${yy}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function isVerificationId(value: string): boolean {
  return /^MA-\d{2}-[0-9A-F]{6}$/.test(value);
}

export function newSessionId(): string {
  return randomUUID() + randomBytes(8).toString('hex');
}

export function hashSession(sessionId: string, pepper: string): string {
  return createHmac('sha256', pepper).update(sessionId).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Hash para claves de rate limit: evita guardar IPs/emails en claro en Redis. */
export function hashForKey(value: string, pepper: string): string {
  return createHmac('sha256', pepper).update(value.toLowerCase()).digest('hex').slice(0, 32);
}
