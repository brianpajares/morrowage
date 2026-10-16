'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/** Resultado de `/api/paypal/capture` (ver SettleResult en el servidor). */
export interface CaptureResult {
  status: 'paid' | 'already_paid' | 'pending' | 'failed' | 'invalid' | 'not_captured';
  reportUrl?: string;
}

interface PaypalButtonsInstance {
  render: (container: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
}

interface PaypalNamespace {
  Buttons: (config: {
    style?: Record<string, unknown>;
    onClick?: (data: unknown, actions: { resolve: () => Promise<void>; reject: () => Promise<void> }) => Promise<void>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (err: unknown) => void;
  }) => PaypalButtonsInstance;
}

declare global {
  interface Window {
    paypal?: PaypalNamespace;
  }
}

const SDK_LOCALE: Record<string, string> = { es: 'es_ES', en: 'en_US', pt: 'pt_BR' };
const SCRIPT_ID = 'paypal-js-sdk';

function loadSdk(clientId: string, locale: string): Promise<PaypalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const done = () => (window.paypal ? resolve(window.paypal) : reject(new Error('paypal_missing')));
    if (existing) {
      existing.addEventListener('load', done);
      existing.addEventListener('error', () => reject(new Error('paypal_load')));
      return;
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons&locale=${SDK_LOCALE[locale] ?? 'en_US'}`;
    s.async = true;
    s.setAttribute('data-sdk-integration-source', 'morrowage');
    s.addEventListener('load', done);
    s.addEventListener('error', () => reject(new Error('paypal_load')));
    document.head.appendChild(s);
  });
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T & { code?: string } }> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T & { code?: string } };
}

/**
 * Botones de PayPal (PayPal o tarjeta). Flujo: createOrder → /api/paypal/create-order (precio solo en
 * el servidor) → aprobación del comprador → /api/paypal/capture (captura y validación en el servidor).
 * Los botones solo se activan con los términos aceptados.
 */
export function PaymentGate({
  token,
  clientId,
  locale,
  termsAccepted,
  onTermsRequired,
  onResult,
  onCancel,
}: {
  token: string;
  clientId: string;
  locale: string;
  termsAccepted: boolean;
  onTermsRequired: () => void;
  onResult: (r: CaptureResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('unlock');
  const container = useRef<HTMLDivElement>(null);
  const terms = useRef(termsAccepted);
  const callbacks = useRef({ onTermsRequired, onResult, onCancel });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  // Los botones de PayPal se montan una vez: sus eventos leen siempre el valor vigente vía refs.
  useEffect(() => {
    terms.current = termsAccepted;
    callbacks.current = { onTermsRequired, onResult, onCancel };
  });

  useEffect(() => {
    let buttons: PaypalButtonsInstance | undefined;
    let cancelled = false;

    loadSdk(clientId, locale)
      .then(async (paypal) => {
        if (cancelled || !container.current) return;
        buttons = paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'pay', height: 48 },
          onClick: async (_data, actions) => {
            if (!terms.current) {
              callbacks.current.onTermsRequired();
              return actions.reject();
            }
            setMessage(null);
            return actions.resolve();
          },
          createOrder: async () => {
            const res = await postJson<{ paypalOrderId?: string }>('/api/paypal/create-order', { token, withdrawalWaiver: true });
            if (!res.ok || !res.data.paypalOrderId) {
              if (res.data.code === 'already_paid') callbacks.current.onResult({ status: 'already_paid' });
              throw new Error(res.data.code ?? 'create_failed');
            }
            return res.data.paypalOrderId;
          },
          onApprove: async (data) => {
            const res = await postJson<CaptureResult>('/api/paypal/capture', { token, paypalOrderId: data.orderID });
            if (!res.ok) {
              setMessage(t('payError'));
              return;
            }
            if (res.data.status === 'failed' || res.data.status === 'invalid' || res.data.status === 'not_captured') {
              setMessage(t('payError'));
              return;
            }
            callbacks.current.onResult(res.data);
          },
          onCancel: () => {
            setMessage(t('cancelled'));
            callbacks.current.onCancel();
          },
          onError: () => setMessage(t('payError')),
        });
        await buttons.render(container.current);
        if (!cancelled) setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
      void buttons?.close().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, locale, token]);

  return (
    <div>
      {state === 'loading' ? (
        <p role="status" className="py-3 text-sm text-muted">
          {t('loading')}
        </p>
      ) : null}
      {state === 'error' ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm font-semibold text-danger">
          {t('loadError')}
        </p>
      ) : null}
      <div ref={container} role="group" aria-label="PayPal" className={state === 'error' ? 'hidden' : undefined} />
      {message ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
