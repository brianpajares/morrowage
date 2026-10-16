/**
 * Cliente mínimo de PayPal Checkout (Orders v2) y verificación de webhooks.
 *
 * Reglas (playbook de monetización, §1 y §3):
 *  - Precio y moneda SOLO en el servidor; el navegador nunca los fija.
 *  - LIVE exige dos interruptores (PAYPAL_ENV=live y PAYMENTS_LIVE_APPROVED=true): `getEnv().paypal.usable`.
 *  - Las credenciales viven solo en variables de entorno del servidor; nada de esto se registra en logs.
 *  - Usa `fetch` global en cada llamada: los tests lo sustituyen sin tocar red real.
 */
import 'server-only';
import { getEnv, type PaypalConfig } from '@/lib/env';
import { log } from '@/lib/log';

export class PaypalError extends Error {
  constructor(
    readonly status: number,
    /** Nombre corto del error de PayPal (p. ej. `ORDER_ALREADY_CAPTURED`) o clase de red. */
    readonly code: string,
    readonly debugId?: string,
  ) {
    super(`paypal_${status}_${code}`);
    this.name = 'PaypalError';
  }
}

export interface PaypalAmount {
  currency_code: string;
  value: string;
}

export interface PaypalCapture {
  id: string;
  status: string;
  amount?: PaypalAmount;
  custom_id?: string;
  invoice_id?: string;
}

export interface PaypalPurchaseUnit {
  reference_id?: string;
  custom_id?: string;
  invoice_id?: string;
  amount?: PaypalAmount;
  payee?: { merchant_id?: string };
  payments?: { captures?: PaypalCapture[] };
}

export interface PaypalOrder {
  id: string;
  status: string;
  purchase_units?: PaypalPurchaseUnit[];
}

export function paypalBaseUrl(env: PaypalConfig['env']): string {
  return env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

/** 1900 → "19.00" (PayPal exige dos decimales como cadena). */
export function formatMinor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

/** "19.00" → 1900. `null` si no es un importe con ≤2 decimales. */
export function parseMajorToMinor(value: string | undefined): number | null {
  if (!value || !/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

function config(): PaypalConfig & { clientId: string; clientSecret: string } {
  const p = getEnv().paypal;
  if (!p.usable || !p.clientId || !p.clientSecret) throw new PaypalError(503, 'not_configured');
  return p as PaypalConfig & { clientId: string; clientSecret: string };
}

let tokenCache: { key: string; token: string; expiresAt: number } | undefined;

/** Solo tests. */
export function resetPaypalTokenCache(): void {
  tokenCache = undefined;
}

async function parseError(res: Response): Promise<PaypalError> {
  let name = 'unknown';
  let debugId = res.headers.get('paypal-debug-id') ?? undefined;
  try {
    const body = (await res.json()) as { name?: string; error?: string; debug_id?: string; details?: Array<{ issue?: string }> };
    name = body.details?.[0]?.issue ?? body.name ?? body.error ?? 'unknown';
    debugId = body.debug_id ?? debugId;
  } catch {
    /* cuerpo no JSON */
  }
  return new PaypalError(res.status, String(name).slice(0, 60).replace(/[^A-Za-z0-9_]/g, '_'), debugId);
}

async function accessToken(): Promise<string> {
  const p = config();
  const key = `${p.env}:${p.clientId}`;
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt - 60_000 > Date.now()) return tokenCache.token;

  let res: Response;
  try {
    res = await fetch(`${paypalBaseUrl(p.env)}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${p.clientId}:${p.clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new PaypalError(0, 'network');
  }
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new PaypalError(502, 'no_token');
  tokenCache = { key, token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 300) * 1000 };
  return body.access_token;
}

async function api<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown; requestId?: string }): Promise<T> {
  const p = config();
  const token = await accessToken();
  let res: Response;
  try {
    res = await fetch(`${paypalBaseUrl(p.env)}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        prefer: 'return=representation',
        ...(init.requestId ? { 'paypal-request-id': init.requestId } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new PaypalError(0, 'network');
  }
  if (!res.ok) {
    const err = await parseError(res);
    log.warn('paypal_api_error', { path: path.replace(/[A-Z0-9]{12,}/g, ':id'), status: err.status, code: err.code, debugId: err.debugId });
    throw err;
  }
  return (await res.json()) as T;
}

/**
 * Crea la orden. `custom_id` = id interno del pedido (se valida en la captura);
 * `invoice_id` = `MA-<id>` para conciliar en el panel de PayPal; `PayPal-Request-Id` = id del pedido
 * (reintentos idempotentes).
 */
export async function createPaypalOrder(input: { orderId: string; amountMinor: number; currency: string; description: string; brandName: string }): Promise<PaypalOrder> {
  return api<PaypalOrder>('/v2/checkout/orders', {
    method: 'POST',
    requestId: `create-${input.orderId}`,
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.orderId,
          custom_id: input.orderId,
          invoice_id: `MA-${input.orderId.replace(/-/g, '').slice(0, 20).toUpperCase()}`,
          description: input.description.slice(0, 120),
          amount: { currency_code: input.currency, value: formatMinor(input.amountMinor) },
        },
      ],
      application_context: {
        brand_name: input.brandName,
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    },
  });
}

export async function getPaypalOrder(paypalOrderId: string): Promise<PaypalOrder> {
  return api<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, { method: 'GET' });
}

/** Captura en el servidor. Si ya estaba capturada (navegador + webhook a la vez) devuelve la orden. */
export async function capturePaypalOrder(paypalOrderId: string, requestId: string): Promise<PaypalOrder> {
  try {
    return await api<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      requestId: `capture-${requestId}`,
      body: {},
    });
  } catch (err) {
    if (err instanceof PaypalError && err.status === 422 && err.code === 'ORDER_ALREADY_CAPTURED') {
      return getPaypalOrder(paypalOrderId);
    }
    throw err;
  }
}

/** Verificación oficial de la firma (`/v1/notifications/verify-webhook-signature`). */
export async function verifyPaypalWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const p = config();
  if (!p.webhookId) return false;
  const h = (name: string) => headers.get(name) ?? '';
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const res = await api<{ verification_status?: string }>('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      auth_algo: h('paypal-auth-algo'),
      cert_url: h('paypal-cert-url'),
      transmission_id: h('paypal-transmission-id'),
      transmission_sig: h('paypal-transmission-sig'),
      transmission_time: h('paypal-transmission-time'),
      webhook_id: p.webhookId,
      webhook_event: event,
    },
  });
  return res.verification_status === 'SUCCESS';
}

export type CaptureVerdict =
  | { kind: 'completed'; captureId: string; amountMinor: number; currency: string }
  | { kind: 'pending' }
  | { kind: 'denied' }
  | { kind: 'not_captured' }
  | { kind: 'invalid'; reason: string };

/**
 * Valida cada punto antes de entregar (playbook §2): id de orden, una sola purchase_unit, custom_id,
 * captura COMPLETED, importe y moneda exactos y merchant esperado (si está configurado).
 */
export function evaluateOrder(input: {
  paypalOrderId: string;
  internalOrderId: string;
  expectedAmountMinor: number;
  expectedCurrency: string;
  merchantId?: string;
  order: PaypalOrder;
}): CaptureVerdict {
  const { order } = input;
  if (order.id !== input.paypalOrderId) return { kind: 'invalid', reason: 'order_id' };
  const units = order.purchase_units ?? [];
  if (units.length !== 1) return { kind: 'invalid', reason: 'purchase_units' };
  const unit = units[0]!;
  if (unit.custom_id !== input.internalOrderId) return { kind: 'invalid', reason: 'custom_id' };
  if (input.merchantId && unit.payee?.merchant_id !== input.merchantId) return { kind: 'invalid', reason: 'merchant' };

  const captures = unit.payments?.captures ?? [];
  if (captures.length === 0) return { kind: 'not_captured' };
  const capture = captures[0]!;
  const status = capture.status.toUpperCase();
  if (status === 'DENIED' || status === 'DECLINED' || status === 'FAILED') return { kind: 'denied' };
  if (status === 'PENDING') return { kind: 'pending' };
  if (status !== 'COMPLETED') return { kind: 'invalid', reason: 'capture_status' };
  if (capture.custom_id && capture.custom_id !== input.internalOrderId) return { kind: 'invalid', reason: 'capture_custom_id' };

  const minor = parseMajorToMinor(capture.amount?.value);
  if (minor === null || minor !== input.expectedAmountMinor) return { kind: 'invalid', reason: 'amount' };
  if ((capture.amount?.currency_code ?? '').toUpperCase() !== input.expectedCurrency.toUpperCase()) return { kind: 'invalid', reason: 'currency' };
  return { kind: 'completed', captureId: capture.id, amountMinor: minor, currency: input.expectedCurrency.toUpperCase() };
}
