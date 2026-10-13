'use client';

/**
 * Tracker del navegador. Envía eventos al endpoint propio `/api/events` (first-party), que valida
 * contra la allowlist del spec, agrega contadores sin PII y reenvía a PostHog desde el servidor.
 *
 * Reglas (FR-15, AT-25): ningún dato de salud, email, token ni resultado crudo; solo propiedades
 * permitidas con valores acotados. Se respeta Global Privacy Control y Do Not Track.
 */
import { sanitizeEvent, type EventName } from './events';

const SESSION_KEY = 'ma-psid';

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Identificador pseudónimo por pestaña (sessionStorage). No es un ID de usuario ni se deriva de datos. */
export function getPseudonymousSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || !/^[0-9a-f]{32}$/.test(id)) {
      id = randomHex(16);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return randomHex(16);
  }
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || (window as { doNotTrack?: string }).doNotTrack === '1';
}

function deviceClass(): 'mobile' | 'tablet' | 'desktop' {
  const w = window.innerWidth;
  return w < 768 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
}

function marketHint(): string | null {
  const region = /-([A-Za-z]{2})\b/.exec(navigator.language)?.[1];
  return region ? region.toUpperCase() : null;
}

export function referrerGroup(): 'direct' | 'search' | 'social' | 'email' | 'other' {
  const ref = document.referrer;
  if (!ref) return 'direct';
  try {
    const host = new URL(ref).hostname;
    if (host === location.hostname) return 'direct';
    if (/(google|bing|duckduckgo|yahoo|ecosia|brave)\./i.test(host)) return 'search';
    if (/(facebook|instagram|twitter|x\.com|t\.co|linkedin|reddit|tiktok|youtube|whatsapp)/i.test(host)) return 'social';
    if (/(mail|outlook|gmail)/i.test(host)) return 'email';
  } catch {
    /* referrer inválido */
  }
  return 'other';
}

export type TrackProps = Record<string, string | number | boolean>;

export function track(name: EventName, props: TrackProps = {}): void {
  if (typeof window === 'undefined' || optedOut()) return;

  const locale = document.documentElement.lang;
  const full = {
    name,
    props: {
      event_id: crypto.randomUUID(),
      session_id_pseudonymous: getPseudonymousSessionId(),
      timestamp_utc: new Date().toISOString(),
      locale,
      market_hint_coarse: marketHint(),
      model_version: process.env.NEXT_PUBLIC_MODEL_VERSION ?? '2.1',
      app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? '4.0.0',
      device_class: deviceClass(),
      experiment_ids: [] as string[],
      ...props,
    },
  };

  const parsed = sanitizeEvent(full);
  if (!parsed.ok) {
    // En desarrollo/CI un evento fuera del contrato debe fallar ruidosamente; en producción se descarta.
    if (process.env.NODE_ENV !== 'production') throw new Error(`analytics_rejected:${name}:${parsed.reason}`);
    return;
  }

  const body = JSON.stringify(parsed.event);
  try {
    if (navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) return;
  } catch {
    /* continúa con fetch */
  }
  void fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(
    () => undefined,
  );
}
