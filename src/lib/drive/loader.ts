/**
 * Loader de assets versionados desde Google Drive (FR-16, AT-22, AT-23).
 *
 * Cadena de resolución:
 *   1. snapshot en memoria vigente (TTL = DRIVE_CACHE_TTL_SECONDS, 24 h por defecto)
 *   2. Drive → descarga TODOS los archivos del manifest, verifica SHA-256 → promueve a cache + LKG
 *   3. fallo (timeout/403/5xx/archivo faltante/checksum inválido) → last-known-good:
 *        memoria → /tmp (re-verificado) → snapshot empaquetado (re-verificado)
 *   4. nada válido → DriveUnavailableError (la API responde 503: no se calcula sin modelo válido)
 *
 * Un archivo corrupto NUNCA reemplaza un snapshot válido: la promoción es todo-o-nada.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getEnv } from '@/lib/env';
import { log } from '@/lib/log';
import { reportError } from '@/lib/observability/report-error';
import { loadBundledSnapshot } from './bundled';
import { GoogleDriveClient, DriveHttpError } from './google';
import { driveManifest, relativeDrivePath } from './manifest';
import { buildSnapshot, SnapshotValidationError, type ModelSnapshot } from './snapshot';

export type DriveSnapshotStatus = 'valid' | 'last_known_good' | 'unavailable';

export class DriveUnavailableError extends Error {
  constructor() {
    super('model_snapshot_unavailable');
    this.name = 'DriveUnavailableError';
  }
}

interface State {
  current?: ModelSnapshot;
  expiresAt: number;
  /** Cuando Drive falla no se reintenta en cada request: espera hasta `retryAt`. */
  retryAt: number;
  lastGood?: ModelSnapshot;
  status: DriveSnapshotStatus;
  inflight?: Promise<ModelSnapshot>;
}

const state: State = { expiresAt: 0, retryAt: 0, status: 'unavailable' };

const FAILURE_BACKOFF_MS = 5 * 60 * 1000;

/** Solo tests. */
export function resetDriveState(): void {
  state.current = undefined;
  state.expiresAt = 0;
  state.retryAt = 0;
  state.lastGood = undefined;
  state.status = 'unavailable';
  state.inflight = undefined;
}

function tmpRoot(): string {
  return path.join(/* turbopackIgnore: true */ os.tmpdir(), 'morrowage-lkg');
}

function persistToTmp(files: Map<string, Uint8Array>): void {
  try {
    const dir = tmpRoot();
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, bytes] of files) fs.writeFileSync(path.join(dir, name), bytes);
  } catch {
    // /tmp no disponible (p. ej. entorno de solo lectura): el LKG en memoria + empaquetado bastan.
  }
}

function readTmp(now: number): ModelSnapshot | undefined {
  try {
    const dir = tmpRoot();
    const files = new Map<string, Uint8Array>();
    for (const entry of driveManifest.files) {
      files.set(entry.file, new Uint8Array(fs.readFileSync(path.join(dir, entry.file))));
    }
    return buildSnapshot(files, 'last_known_good', now);
  } catch {
    return undefined;
  }
}

async function fetchFromDrive(now: number, timeoutMs: number): Promise<{ snapshot: ModelSnapshot; files: Map<string, Uint8Array> }> {
  const env = getEnv();
  const { email, privateKey, folderId } = env.google;
  if (!email || !privateKey || !folderId) throw new DriveHttpError(0, 'not_configured');
  const client = new GoogleDriveClient({ clientEmail: email, privateKey }, { scope: 'readonly', timeoutMs });

  const files = new Map<string, Uint8Array>();
  for (const entry of driveManifest.files) {
    const ref = await client.resolvePath(folderId, relativeDrivePath(entry));
    if (!ref) throw new SnapshotValidationError('missing_file', entry.file);
    files.set(entry.file, await client.download(ref.id));
  }
  return { snapshot: buildSnapshot(files, 'drive', now), files };
}

function classify(err: unknown): string {
  if (err instanceof SnapshotValidationError) return `snapshot_${err.errorClass}`;
  if (err instanceof DriveHttpError) return `drive_${err.errorClass}`;
  return 'drive_unknown';
}

function lastKnownGood(now: number): ModelSnapshot | undefined {
  if (state.lastGood) return { ...state.lastGood, source: 'last_known_good' };
  const fromTmp = readTmp(now);
  if (fromTmp) return fromTmp;
  try {
    return { ...loadBundledSnapshot(now), source: 'bundled' };
  } catch {
    return undefined;
  }
}

async function refresh(now: number): Promise<ModelSnapshot> {
  const env = getEnv();
  const ttlMs = env.driveCacheTtlSeconds * 1000;

  if (env.capabilities.drive && now >= state.retryAt) {
    try {
      const { snapshot, files } = await fetchFromDrive(now, 2500);
      state.current = snapshot;
      state.lastGood = snapshot;
      state.expiresAt = now + ttlMs;
      state.status = 'valid';
      persistToTmp(files);
      return snapshot;
    } catch (err) {
      const errorClass = classify(err);
      state.retryAt = now + FAILURE_BACKOFF_MS;
      // Evento redactado: solo la clase del fallo (AT-23). Sin rutas, sin contenido, sin credenciales.
      reportError('drive_unavailable', { errorClass }, { component: 'drive', errorClass });
      log.warn('drive_refresh_failed', { errorClass });
    }
  }

  const fallback = lastKnownGood(now);
  if (!fallback) {
    state.status = 'unavailable';
    throw new DriveUnavailableError();
  }
  state.current = fallback;
  // Con Drive configurado, servir otra cosa que "drive" es degradación (last_known_good).
  // Sin Drive configurado, el snapshot empaquetado es la fuente normal.
  state.status = env.capabilities.drive ? 'last_known_good' : 'valid';
  state.expiresAt = env.capabilities.drive ? Math.min(now + ttlMs, state.retryAt) : now + ttlMs;
  state.lastGood ??= fallback;
  return fallback;
}

export async function getModelSnapshot(now: number = Date.now()): Promise<ModelSnapshot> {
  if (state.current && now < state.expiresAt) return state.current;
  state.inflight ??= refresh(now).finally(() => {
    state.inflight = undefined;
  });
  return state.inflight;
}

export function getDriveSnapshotStatus(): DriveSnapshotStatus {
  return state.status;
}
