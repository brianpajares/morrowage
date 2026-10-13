/**
 * `npm run drive:sync` — sube `drive/` a GOOGLE_DRIVE_FOLDER_ID conservando la estructura.
 *
 * Pasos (docs/DRIVE_SETUP.md §3): lee drive/ recursivamente, calcula SHA-256, lo compara con
 * spec/drive_manifest.json, RECHAZA si no coincide (o si el manifest no cubre todo), crea
 * subcarpetas por nombre y hace upsert por ruta relativa. No imprime secretos.
 *
 * Uso:
 *   npm run drive:sync            # sube (requiere credenciales)
 *   npm run drive:sync -- --dry-run   # solo valida manifest y checksums
 */
import fs from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
import { md5Hex, sha256Hex, checksumEquals } from '../src/lib/drive/checksum';
import { GoogleDriveClient, mimeTypeFor } from '../src/lib/drive/google';
import { driveManifest, relativeDrivePath } from '../src/lib/drive/manifest';
import { getEnv } from '../src/lib/env';

const { loadEnvConfig } = nextEnv;
const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.resolve(import.meta.dirname, '..', 'drive');

function walk(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${name.name}` : name.name;
    if (name.isDirectory()) out.push(...walk(path.join(dir, name.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

export interface PlannedFile {
  relPath: string;
  sha256: string;
  bytes: Uint8Array;
}

/** Valida drive/ contra el manifest. Lanza si falta/sobra/difiere cualquier archivo. */
export function planSync(root: string = ROOT): PlannedFile[] {
  const local = walk(root);
  const expected = driveManifest.files.map((f) => relativeDrivePath(f)).sort();
  const extra = local.filter((p) => !expected.includes(p));
  const missing = expected.filter((p) => !local.includes(p));
  if (extra.length || missing.length) {
    throw new Error(`drive/ no coincide con el manifest. Extra: [${extra}] Faltan: [${missing}]`);
  }
  return driveManifest.files.map((entry) => {
    const relPath = relativeDrivePath(entry);
    const bytes = new Uint8Array(fs.readFileSync(path.join(root, relPath)));
    const sha256 = sha256Hex(bytes);
    if (!checksumEquals(sha256, entry.sha256)) {
      throw new Error(`SHA-256 no coincide con el manifest para ${relPath}`);
    }
    return { relPath, sha256, bytes };
  });
}

async function main(): Promise<void> {
  loadEnvConfig(path.resolve(import.meta.dirname, '..'));
  const plan = planSync();
  console.log(`Manifest v${driveManifest.version}: ${plan.length}/${driveManifest.files.length} archivos verificados (SHA-256).`);
  if (DRY_RUN) {
    console.log('Dry-run: no se sube nada.');
    return;
  }

  const env = getEnv();
  const { email, privateKey, folderId } = env.google;
  if (!email || !privateKey || !folderId) {
    throw new Error(
      'Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_DRIVE_FOLDER_ID. Usa --dry-run para validar sin credenciales.',
    );
  }
  const client = new GoogleDriveClient({ clientEmail: email, privateKey }, { scope: 'write', timeoutMs: 20_000 });

  const summary = { created: 0, updated: 0, unchanged: 0 };
  const folderCache = new Map<string, string>([['', folderId]]);

  for (const file of plan) {
    const parts = file.relPath.split('/');
    const name = parts.pop()!;
    let parent = folderId;
    let acc = '';
    for (const seg of parts) {
      acc = acc ? `${acc}/${seg}` : seg;
      let id = folderCache.get(acc);
      if (!id) {
        id = await client.ensureFolder(parent, seg);
        folderCache.set(acc, id);
      }
      parent = id;
    }

    const existing = await client.findChild(parent, name, 'file');
    if (existing?.md5Checksum && existing.md5Checksum === md5Hex(file.bytes)) {
      summary.unchanged++;
      console.log(`= ${file.relPath} (sin cambios)`);
      continue;
    }
    const res = await client.upsertFile(parent, name, file.bytes, mimeTypeFor(name));
    summary[res.action]++;
    console.log(`${res.action === 'created' ? '+' : '~'} ${file.relPath} (${res.action}) sha256=${file.sha256.slice(0, 12)}…`);
  }
  console.log(`Listo. Creados: ${summary.created} · Actualizados: ${summary.updated} · Sin cambios: ${summary.unchanged}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename;
if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error(`drive:sync falló: ${err instanceof Error ? err.message : 'error desconocido'}`);
    process.exit(1);
  });
}
