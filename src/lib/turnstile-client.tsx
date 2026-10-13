'use client';

/**
 * Cloudflare Turnstile invisible (`appearance: interaction-only`). El script se carga solo si hay
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; sin clave, `getToken()` resuelve `undefined` y el servidor aplica
 * únicamente rate limit (ver /api/health → capabilities.turnstile).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const Ctx = createContext<{ getToken: () => Promise<string | undefined> }>({ getToken: async () => undefined });

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const el = existing ?? Object.assign(document.createElement('script'), { src: SCRIPT, async: true, defer: true });
    el.addEventListener('load', () => resolve(), { once: true });
    el.addEventListener('error', () => reject(new Error('turnstile_script')), { once: true });
    if (!existing) document.head.appendChild(el);
  });
}

export function TurnstileProvider({ children }: { children: ReactNode }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const slot = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const pending = useRef<{ resolve: (t: string | undefined) => void } | null>(null);
  const ready = useRef<Promise<void> | null>(null);

  const ensure = useCallback(async () => {
    if (!siteKey) return;
    ready.current ??= loadScript().then(() => {
      if (!slot.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(slot.current, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (token: string) => pending.current?.resolve(token),
        'error-callback': () => pending.current?.resolve(undefined),
        'expired-callback': () => undefined,
      });
    });
    await ready.current;
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) return;
    // Precarga tras el primer pintado, sin competir con el LCP.
    const id = setTimeout(() => void ensure().catch(() => undefined), 1500);
    return () => {
      clearTimeout(id);
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
    };
  }, [siteKey, ensure]);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!siteKey) return undefined;
    try {
      await ensure();
    } catch {
      return undefined;
    }
    const api = window.turnstile;
    if (!api || !widget.current) return undefined;
    return new Promise<string | undefined>((resolve) => {
      const timer = setTimeout(() => resolve(undefined), 20_000);
      pending.current = {
        resolve: (t) => {
          clearTimeout(timer);
          pending.current = null;
          resolve(t);
        },
      };
      api.reset(widget.current!);
      api.execute(widget.current!);
    });
  }, [siteKey, ensure]);

  const value = useMemo(() => ({ getToken }), [getToken]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {siteKey ? <div ref={slot} className="container-page mt-4 flex justify-center empty:hidden" /> : null}
    </Ctx.Provider>
  );
}

export function useTurnstile() {
  return useContext(Ctx);
}
