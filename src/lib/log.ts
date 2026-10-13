/**
 * Logger estructurado con redacción obligatoria (AT-32). Es el ÚNICO módulo que escribe a
 * consola (ver regla ESLint `no-console`). Nunca se registra el payload de salud, emails ni tokens.
 */
import { redactDeep, redactString } from '@/lib/observability/scrub';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const lvl = (process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'warn' : 'info')) as Level;
  return ORDER[lvl] ?? ORDER.info;
}

function emit(level: Level, msg: string, ctx?: Record<string, unknown>): void {
  if (ORDER[level] < threshold()) return;
  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    msg: redactString(msg),
    ...(ctx ? (redactDeep(ctx) as Record<string, unknown>) : {}),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
};
