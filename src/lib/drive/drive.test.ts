import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBundledSnapshot, readBundledFiles } from './bundled';
import { sha256Hex } from './checksum';
import { driveManifest, relativeDrivePath } from './manifest';
import { buildSnapshot, SnapshotValidationError } from './snapshot';
import { DriveUnavailableError, getDriveSnapshotStatus, getModelSnapshot, resetDriveState } from './loader';
import { setErrorReporter, type SafeErrorReport } from '@/lib/observability/report-error';
import { planSync } from '../../../scripts/drive-sync';

const DAY = 86_400_000;

describe('manifest y snapshot empaquetado', () => {
  it('el manifest cubre exactamente los archivos de drive/ y todos pasan SHA-256', () => {
    const plan = planSync();
    expect(plan).toHaveLength(driveManifest.files.length);
    expect(driveManifest.files).toHaveLength(6);
  });

  it('el snapshot empaquetado se construye y expone parámetros del modelo v2.1', () => {
    const snap = loadBundledSnapshot(1);
    expect(snap.source).toBe('bundled');
    expect(snap.params.version).toBe('2.1');
    expect(snap.modelCard).toContain('Cómo funciona MorrowAge');
    expect(snap.sources.find((s) => s.id === 'S01')?.url).toContain('mhealth.jmir.org');
    expect(Object.keys(snap.checksums)).toHaveLength(6);
  });

  it('AT-22: un archivo con SHA incorrecto se rechaza', () => {
    const files = readBundledFiles();
    const tampered = new Uint8Array(files.get('model_coefficients_v2.json')!);
    tampered[10] = tampered[10] === 0x20 ? 0x21 : 0x20;
    files.set('model_coefficients_v2.json', tampered);
    expect(() => buildSnapshot(files, 'drive', 1)).toThrow(SnapshotValidationError);
    try {
      buildSnapshot(files, 'drive', 1);
    } catch (e) {
      expect((e as SnapshotValidationError).errorClass).toBe('checksum_mismatch');
    }
  });

  it('rechaza si falta un archivo requerido', () => {
    const files = readBundledFiles();
    files.delete('report_structure_v2.json');
    expect(() => buildSnapshot(files, 'drive', 1)).toThrow(/missing_file/);
  });
});

// ---------------------------------------------------------------------------------------------
// Drive simulado (fetch) para el loader
// ---------------------------------------------------------------------------------------------
const { privateKey: PEM } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

interface FakeDriveOpts {
  corrupt?: string;
  down?: boolean;
  forbidden?: boolean;
}

function installFakeDrive(opts: FakeDriveOpts = {}) {
  const bundled = readBundledFiles();
  const byRel = new Map<string, Uint8Array>();
  for (const entry of driveManifest.files) byRel.set(relativeDrivePath(entry), bundled.get(entry.file)!);
  const calls = { token: 0, list: 0, download: 0 };

  const fn = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (opts.down) throw new TypeError('network down');
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      calls.token++;
      return json({ access_token: 'test-access-token', expires_in: 3600 });
    }
    if (opts.forbidden) return json({ error: 'forbidden' }, 403);
    if (url.includes('/drive/v3/files?') && !url.includes('alt=media')) {
      calls.list++;
      const q = decodeURIComponent(new URL(url).searchParams.get('q') ?? '');
      const m = /^'([^']+)' in parents and name = '([^']+)' and mimeType (=|!=)/.exec(q)!;
      const parent = m[1]!;
      const name = m[2]!;
      const wantFolder = m[3] === '=';
      const prefix = parent === 'ROOT' ? '' : `${parent.replace(/^dir:/, '')}/`;
      const rel = `${prefix}${name}`;
      if (wantFolder) {
        const exists = [...byRel.keys()].some((k) => k.startsWith(`${rel}/`));
        return json({ files: exists ? [{ id: `dir:${rel}`, name, mimeType: 'application/vnd.google-apps.folder' }] : [] });
      }
      return json({ files: byRel.has(rel) ? [{ id: `file:${rel}`, name, mimeType: 'text/plain' }] : [] });
    }
    if (url.includes('alt=media')) {
      calls.download++;
      const rel = decodeURIComponent(url.split('/files/')[1]!.split('?')[0]!).replace(/^file:/, '');
      let bytes = byRel.get(rel)!;
      if (opts.corrupt && rel.endsWith(opts.corrupt)) {
        bytes = new Uint8Array(bytes);
        bytes[5] = (bytes[5]! + 1) % 256;
      }
      return new Response(bytes as unknown as BodyInit, { status: 200 });
    }
    return json({}, 404);
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

describe('loader de Drive: checksum, cache 24 h y last-known-good', () => {
  const reports: SafeErrorReport[] = [];
  let tmp: string;

  beforeEach(() => {
    resetDriveState();
    reports.length = 0;
    setErrorReporter((r) => void reports.push(r));
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-drive-test-'));
    vi.spyOn(os, 'tmpdir').mockReturnValue(tmp);
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'svc@morrowage-test.iam.gserviceaccount.com';
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = PEM;
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'ROOT';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setErrorReporter(null);
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('sin credenciales de Drive usa el snapshot empaquetado y reporta estado valid', async () => {
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    const snap = await getModelSnapshot(1);
    expect(snap.source).toBe('bundled');
    expect(getDriveSnapshotStatus()).toBe('valid');
    expect(reports).toHaveLength(0);
  });

  it('descarga de Drive, verifica SHA-256 y lo promueve a cache', async () => {
    const drive = installFakeDrive();
    const t0 = 1_000_000;
    const snap = await getModelSnapshot(t0);
    expect(snap.source).toBe('drive');
    expect(getDriveSnapshotStatus()).toBe('valid');
    expect(drive.calls.download).toBe(6);
    const downloadsAfterFirst = drive.calls.download;

    // Dentro de las 24 h no vuelve a llamar a Drive.
    await getModelSnapshot(t0 + DAY - 1000);
    expect(drive.calls.download).toBe(downloadsAfterFirst);

    // Pasadas las 24 h refresca.
    await getModelSnapshot(t0 + DAY + 1000);
    expect(drive.calls.download).toBe(downloadsAfterFirst * 2);
  });

  it('AT-22: archivo corrupto en Drive no reemplaza el snapshot válido', async () => {
    installFakeDrive();
    const t0 = 5_000_000;
    const good = await getModelSnapshot(t0);
    expect(good.source).toBe('drive');

    installFakeDrive({ corrupt: 'model_coefficients_v2.json' });
    const after = await getModelSnapshot(t0 + DAY + 1000);
    expect(after.source).toBe('last_known_good');
    expect(after.params.beta.logAge).toBe(good.params.beta.logAge);
    expect(getDriveSnapshotStatus()).toBe('last_known_good');
    expect(reports.at(-1)?.errorClass).toBe('drive_unavailable');
    expect(reports.at(-1)?.tags.errorClass).toBe('snapshot_checksum_mismatch');
  });

  it('AT-23: Drive caído → sigue calculando con last-known-good y reporta evento redactado', async () => {
    installFakeDrive();
    const t0 = 9_000_000;
    await getModelSnapshot(t0);

    installFakeDrive({ down: true });
    const snap = await getModelSnapshot(t0 + DAY + 1000);
    expect(snap.source).toBe('last_known_good');
    expect(snap.params.version).toBe('2.1');

    expect(reports.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(reports);
    expect(serialized).not.toContain('PRIVATE KEY');
    expect(serialized).not.toContain('svc@morrowage-test');
    expect(serialized).not.toContain('test-access-token');
    expect(reports.at(-1)?.tags.errorClass).toBe('drive_network');
  });

  it('403 de Drive también cae a last-known-good (sin reintentar en cada request)', async () => {
    const drive = installFakeDrive({ forbidden: true });
    const t0 = 12_000_000;
    const first = await getModelSnapshot(t0);
    expect(['last_known_good', 'bundled']).toContain(first.source);
    const listCalls = drive.calls.list;
    // Durante el backoff no se golpea Drive otra vez.
    await getModelSnapshot(t0 + 60_000);
    expect(drive.calls.list).toBe(listCalls);
    expect(getDriveSnapshotStatus()).toBe('last_known_good');
  });

  it('falla cerrado si nunca existió una versión válida', async () => {
    installFakeDrive({ down: true });
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-empty-'));
    vi.spyOn(process, 'cwd').mockReturnValue(empty);
    await expect(getModelSnapshot(20_000_000)).rejects.toBeInstanceOf(DriveUnavailableError);
    expect(getDriveSnapshotStatus()).toBe('unavailable');
    fs.rmSync(empty, { recursive: true, force: true });
  });

  it('el checksum del manifest coincide con el contenido de drive/', () => {
    const files = readBundledFiles();
    for (const entry of driveManifest.files) {
      expect(sha256Hex(files.get(entry.file)!)).toBe(entry.sha256);
    }
  });
});
