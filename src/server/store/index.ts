import { getEnv } from '@/lib/env';
import { log } from '@/lib/log';
import { MemoryStore } from './memory';
import { SupabaseStore } from './supabase';
import type { Store } from './types';

export class StoreUnavailableError extends Error {
  constructor() {
    super('store_unavailable');
    this.name = 'StoreUnavailableError';
  }
}

// Next puede evaluar rutas API y páginas en instancias de módulo distintas: el MemoryStore (solo
// desarrollo/test) vive en globalThis para que todas vean los mismos datos. Supabase no lo necesita.
const g = globalThis as typeof globalThis & { __maMemoryStore?: Store };

let cached: Store | undefined;
let cachedKey = '';

/**
 * Resolución del almacenamiento:
 *  - Supabase configurado → SupabaseStore (siempre en producción).
 *  - APP_ENV=test/development sin Supabase → MemoryStore (nunca en producción).
 *  - Producción sin Supabase → StoreUnavailableError (la API responde 503: se falla cerrado).
 */
export function getStore(): Store {
  const env = getEnv();
  const key = `${env.appEnv}|${env.supabaseUrl ?? ''}|${env.supabaseServiceRoleKey?.slice(-6) ?? ''}`;
  if (cached && cachedKey === key) return cached;

  if (env.capabilities.supabase && env.appEnv !== 'test') {
    cached = new SupabaseStore(env.supabaseUrl!, env.supabaseServiceRoleKey!);
  } else if (env.appEnv === 'test' || (env.appEnv === 'development' && !env.isProduction)) {
    cached = g.__maMemoryStore ??= new MemoryStore();
    if (env.appEnv === 'development') log.warn('store_memory_dev', { note: 'sin Supabase: datos efímeros en memoria' });
  } else {
    throw new StoreUnavailableError();
  }
  cachedKey = key;
  return cached;
}

/** Solo tests. */
export function setStoreForTests(store: Store | undefined): void {
  cached = store;
  g.__maMemoryStore = store;
  cachedKey = store ? `${getEnv().appEnv}|${getEnv().supabaseUrl ?? ''}|${getEnv().supabaseServiceRoleKey?.slice(-6) ?? ''}` : '';
}

export { MemoryStore };
export type { Store };
