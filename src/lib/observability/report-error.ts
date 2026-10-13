/**
 * Reporte de errores hacia Sentry con scrubbing. Solo viajan: clase de error, contexto
 * redactado y tags. Jamás mensajes crudos, payloads, emails ni tokens (AT-23, NFR-09).
 */
import { log } from '@/lib/log';
import { redactDeep, redactString } from './scrub';

export interface SafeErrorReport {
  /** Clase corta y estable, p. ej. "drive_unavailable". */
  errorClass: string;
  context: Record<string, unknown>;
  tags: Record<string, string>;
}

export type ErrorReporter = (report: SafeErrorReport) => void | Promise<void>;

async function sentryReporter(report: SafeErrorReport): Promise<void> {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || /REPLACE_ME/.test(dsn)) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.withScope((scope) => {
    scope.setTags(report.tags);
    scope.setContext('safe_context', report.context);
    scope.setFingerprint([report.errorClass]);
    Sentry.captureException(new Error(report.errorClass));
  });
}

let reporter: ErrorReporter = sentryReporter;

/** Solo tests: sustituye el destino del reporte. */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next ?? sentryReporter;
}

export function reportError(
  errorClass: string,
  context: Record<string, unknown> = {},
  tags: Record<string, string> = {},
): void {
  const safe: SafeErrorReport = {
    errorClass: redactString(errorClass).slice(0, 80),
    context: redactDeep(context) as Record<string, unknown>,
    tags: Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, redactString(String(v)).slice(0, 80)])),
  };
  log.error('error_reported', { errorClass: safe.errorClass, ...safe.context });
  try {
    const r = reporter(safe);
    if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => undefined);
  } catch {
    // La telemetría nunca debe romper el request.
  }
}
