/**
 * Un "snapshot" es el conjunto completo de archivos del manifest, ya verificados por SHA-256
 * y parseados. Solo se promueve (cache / last-known-good) si TODOS los archivos requeridos son
 * válidos (docs/DRIVE_SETUP.md §4).
 */
import { parseModelParams, type ModelParams } from '@/lib/model/params';
import { checksumEquals, sha256Hex } from './checksum';
import { driveManifest, REQUIRED_FILES, type DriveManifest } from './manifest';

export type SnapshotSource = 'drive' | 'last_known_good' | 'bundled';

export interface SourceRow {
  id: string;
  dato: string;
  url: string;
  licencia: string;
  fecha: string;
  estado: string;
}

export interface BenchmarkRow {
  variable: string;
  valor: string;
  unidad: string;
  tipo: string;
  fuente_url: string;
  fecha: string;
  estado: string;
  nota: string;
}

export interface ReportStructure {
  version: string;
  sections: Array<{ id: string; free: boolean; title: Record<string, string>; fields: string[] }>;
  footer_disclaimer: Record<string, string>;
  presentation_guardrails: Record<string, string>;
}

export interface ModelSnapshot {
  /** Versión del manifest/modelo (p. ej. "2.1"). */
  version: string;
  source: SnapshotSource;
  loadedAt: number;
  /** SHA-256 por archivo (nunca el contenido) para health/diagnóstico. */
  checksums: Record<string, string>;
  params: ModelParams;
  modelCard: string;
  reportStructure: ReportStructure;
  sources: SourceRow[];
  benchmark: BenchmarkRow[];
}

export class SnapshotValidationError extends Error {
  /** Clase de fallo, segura para telemetría (sin rutas ni contenido). */
  readonly errorClass: 'missing_file' | 'checksum_mismatch' | 'parse_error';
  constructor(errorClass: SnapshotValidationError['errorClass'], file: string) {
    super(`${errorClass}:${file}`);
    this.name = 'SnapshotValidationError';
    this.errorClass = errorClass;
  }
}

/** CSV simple con comillas dobles (los CSV del paquete no contienen saltos de línea en celdas). */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const cells: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const header = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export type FileBytes = ReadonlyMap<string, Uint8Array>;

/**
 * Verifica checksums contra el manifest y parsea. Lanza SnapshotValidationError ante cualquier
 * problema: un archivo corrupto NUNCA reemplaza un snapshot válido (AT-22).
 */
export function buildSnapshot(
  files: FileBytes,
  source: SnapshotSource,
  now: number,
  manifest: DriveManifest = driveManifest,
): ModelSnapshot {
  const checksums: Record<string, string> = {};
  for (const entry of manifest.files) {
    const bytes = files.get(entry.file);
    if (!bytes) throw new SnapshotValidationError('missing_file', entry.file);
    const actual = sha256Hex(bytes);
    if (!checksumEquals(actual, entry.sha256)) {
      throw new SnapshotValidationError('checksum_mismatch', entry.file);
    }
    checksums[entry.file] = actual;
  }

  const text = (name: string): string => new TextDecoder('utf-8').decode(files.get(name)!);
  try {
    const params = parseModelParams(JSON.parse(text('model_coefficients_v2.json')));
    const reportStructure = JSON.parse(text('report_structure_v2.json')) as ReportStructure;
    if (!Array.isArray(reportStructure.sections)) throw new Error('report_structure');
    return {
      version: manifest.version,
      source,
      loadedAt: now,
      checksums,
      params,
      modelCard: text('model_card.md'),
      reportStructure,
      sources: parseCsv(text('fuentes_datos.csv')) as unknown as SourceRow[],
      benchmark: parseCsv(text('benchmark_reference.csv')) as unknown as BenchmarkRow[],
    };
  } catch {
    throw new SnapshotValidationError('parse_error', 'content');
  }
}

export { REQUIRED_FILES };
