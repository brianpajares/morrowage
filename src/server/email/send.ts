/**
 * Transporte de email.
 *  - APP_ENV=test: buzón en memoria (`outbox`) con inyección de fallos; NUNCA en producción
 *    (getEnv rechaza APP_ENV=test en VERCEL_ENV=production).
 *  - Resend configurado: envío real con reintentos acotados para errores transitorios (429/5xx).
 *  - Sin proveedor: devuelve `email_not_configured` (el lead queda `failed`, reintentable desde admin).
 */
import { Resend } from 'resend';
import { getEnv } from '@/lib/env';
import { log } from '@/lib/log';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Uint8Array; contentType: string }>;
  /** Evita duplicados si el envío se reintenta. */
  idempotencyKey: string;
  /** Etiqueta no sensible para depurar (nunca incluye email ni datos de salud). */
  tag: 'user' | 'owner' | 'resend';
}

export type SendResult = { ok: true; providerId: string } | { ok: false; errorClass: string; retryable: boolean };

// ---- Buzón de pruebas ---------------------------------------------------------------------------
export interface OutboxMessage extends OutgoingEmail {
  sentAt: string;
}
const outbox: OutboxMessage[] = [];
const failures: Array<{ tag?: OutgoingEmail['tag']; errorClass: string; times: number }> = [];

export const testMailbox = {
  all: (): readonly OutboxMessage[] => outbox,
  to: (email: string): OutboxMessage[] => outbox.filter((m) => m.to.toLowerCase() === email.toLowerCase()),
  clear: (): void => {
    outbox.length = 0;
    failures.length = 0;
  },
  /** Fuerza que los próximos `times` envíos (opcionalmente de un `tag`) fallen. */
  failNext: (errorClass: string, opts: { tag?: OutgoingEmail['tag']; times?: number } = {}): void => {
    failures.push({ tag: opts.tag, errorClass, times: opts.times ?? 1 });
  },
};

function testSend(msg: OutgoingEmail): SendResult {
  const f = failures.find((x) => x.times > 0 && (!x.tag || x.tag === msg.tag));
  if (f) {
    f.times--;
    return { ok: false, errorClass: f.errorClass, retryable: f.errorClass === 'resend_transient' };
  }
  outbox.push({ ...msg, sentAt: new Date().toISOString() });
  return { ok: true, providerId: `test_${outbox.length}` };
}

// ---- Resend -------------------------------------------------------------------------------------
let resendClient: Resend | undefined;
let resendKey = '';

function client(apiKey: string): Resend {
  if (!resendClient || resendKey !== apiKey) {
    resendClient = new Resend(apiKey);
    resendKey = apiKey;
  }
  return resendClient;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function resendSend(msg: OutgoingEmail, apiKey: string, from: string): Promise<SendResult> {
  const resend = client(apiKey);
  const { data, error } = await resend.emails.send(
    {
      from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      ...(msg.attachments
        ? { attachments: msg.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: a.contentType })) }
        : {}),
    },
    { idempotencyKey: msg.idempotencyKey },
  );
  if (error) {
    const name = String((error as { name?: string }).name ?? 'unknown');
    const status = Number((error as { statusCode?: number }).statusCode ?? 0);
    const retryable = status === 429 || status >= 500 || name === 'rate_limit_exceeded' || name === 'application_error';
    return { ok: false, errorClass: retryable ? 'resend_transient' : `resend_${name.slice(0, 32).replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`, retryable };
  }
  return { ok: true, providerId: data?.id ?? 'unknown' };
}

/** Envía con hasta 3 intentos (0.4 s, 1.2 s) para errores transitorios. */
export async function sendEmail(msg: OutgoingEmail, opts: { attempts?: number } = {}): Promise<SendResult> {
  const env = getEnv();
  const attempts = opts.attempts ?? 3;

  for (let n = 1; n <= attempts; n++) {
    let result: SendResult;
    if (env.appEnv === 'test') {
      result = testSend(msg);
    } else if (env.resendApiKey && env.emailFrom) {
      try {
        result = await resendSend(msg, env.resendApiKey, env.emailFrom);
      } catch {
        result = { ok: false, errorClass: 'resend_network', retryable: true };
      }
    } else {
      return { ok: false, errorClass: 'email_not_configured', retryable: false };
    }

    if (result.ok || !result.retryable || n === attempts) {
      if (!result.ok) log.warn('email_send_failed', { tag: msg.tag, errorClass: result.errorClass, attempt: n });
      return result;
    }
    await sleep(env.appEnv === 'test' ? 1 : 400 * 3 ** (n - 1));
  }
  return { ok: false, errorClass: 'unknown', retryable: false };
}
