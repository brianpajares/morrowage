/**
 * Snapshot empaquetado con la app (carpeta `drive/` del repo, mismo contenido que se sube a Drive).
 * Se verifica por SHA-256 igual que cualquier otro origen: es el "last-known-good" inicial, de modo
 * que la app nunca depende de Drive para su primer cálculo (decisión registrada en DECISIONS.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { driveManifest, relativeDrivePath } from './manifest';
import { buildSnapshot, type FileBytes, type ModelSnapshot } from './snapshot';

export function bundledRoot(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'drive');
}

export function readBundledFiles(root: string = bundledRoot()): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const entry of driveManifest.files) {
    const abs = path.join(root, relativeDrivePath(entry));
    files.set(entry.file, new Uint8Array(fs.readFileSync(abs)));
  }
  return files;
}

export function loadBundledSnapshot(now: number = Date.now(), root?: string): ModelSnapshot {
  const files: FileBytes = readBundledFiles(root);
  return buildSnapshot(files, 'bundled', now);
}
