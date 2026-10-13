/**
 * Lector XLSX mínimo (puerto de `_read_xlsx_sheet_rows` de model/engine_reference.py).
 * Solo se usa en tests/scripts para comprobar que `base_morrowage.xlsx` (hoja `Parametros`)
 * y `model_coefficients_v2.json` describen el mismo modelo. Celdas literales únicamente.
 */
import { unzipSync, strFromU8 } from 'fflate';

function colToIndex(letters: string): number {
  let out = 0;
  for (const ch of letters) out = out * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  return out - 1;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function textOf(fragment: string): string {
  const parts = [...fragment.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) =>
    decodeXml(m[1] ?? ''),
  );
  return parts.join('');
}

export function readXlsxSheetRows(bytes: Uint8Array, sheetName: string): Array<Array<string | number | boolean | null>> {
  const files = unzipSync(bytes);
  const read = (name: string): string => {
    const f = files[name];
    if (!f) throw new Error(`XLSX: falta ${name}`);
    return strFromU8(f).replace(/^﻿/, '');
  };

  const shared: string[] = [];
  if (files['xl/sharedStrings.xml']) {
    for (const si of read('xl/sharedStrings.xml').matchAll(
      /<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g,
    )) {
      shared.push(textOf(si[1] ?? ''));
    }
  }

  const wb = read('xl/workbook.xml');
  const rels = read('xl/_rels/workbook.xml.rels');
  const ridToTarget = new Map<string, string>();
  for (const m of rels.matchAll(/<(?:\w+:)?Relationship\b([^>]*?)\/?>/g)) {
    const attrs = m[1] ?? '';
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) ridToTarget.set(id, target);
  }

  let target: string | undefined;
  for (const m of wb.matchAll(/<(?:\w+:)?sheet\b([^>]*?)\/?>/g)) {
    const attrs = m[1] ?? '';
    if (/\bname="([^"]+)"/.exec(attrs)?.[1] === sheetName) {
      const rid = /\br:id="([^"]+)"/.exec(attrs)?.[1];
      if (rid) target = ridToTarget.get(rid);
      break;
    }
  }
  if (!target) throw new Error(`XLSX: hoja no encontrada: ${sheetName}`);
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const xml = read(sheetPath);

  const cells = new Map<string, string | number | boolean | null>();
  let maxR = -1;
  let maxC = -1;
  for (const m of xml.matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
    const attrs = m[1] ?? '';
    const inner = m[2] ?? '';
    const ref = /\br="([A-Z]+)(\d+)"/.exec(attrs);
    if (!ref) continue;
    const col = colToIndex(ref[1] ?? '');
    const row = Number(ref[2]) - 1;
    const typ = /\bt="([^"]+)"/.exec(attrs)?.[1];
    let value: string | number | boolean | null = null;
    if (typ === 'inlineStr') {
      value = textOf(inner);
    } else {
      const v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner)?.[1];
      if (v !== undefined) {
        if (typ === 's') value = shared[Number(v)] ?? null;
        else if (typ === 'b') value = v === '1';
        else if (typ === 'str' || typ === 'e') value = decodeXml(v);
        else {
          const n = Number(v);
          value = Number.isNaN(n) ? decodeXml(v) : n;
        }
      }
    }
    cells.set(`${row}:${col}`, value);
    maxR = Math.max(maxR, row);
    maxC = Math.max(maxC, col);
  }

  const rows: Array<Array<string | number | boolean | null>> = [];
  for (let r = 0; r <= maxR; r++) {
    const row: Array<string | number | boolean | null> = [];
    for (let c = 0; c <= maxC; c++) row.push(cells.get(`${r}:${c}`) ?? null);
    rows.push(row);
  }
  return rows;
}

/** Parámetros de la hoja `Parametros` como { nombre: valor }. */
export function readParametros(bytes: Uint8Array): Record<string, string | number | boolean | null> {
  const rows = readXlsxSheetRows(bytes, 'Parametros');
  const header = (rows[0] ?? []).map((h) => (h === null ? '' : String(h)));
  const iName = header.indexOf('parametro');
  const iVal = header.indexOf('valor');
  if (iName < 0 || iVal < 0) throw new Error('Parametros: columnas inesperadas');
  const out: Record<string, string | number | boolean | null> = {};
  for (const row of rows.slice(1)) {
    const name = row[iName];
    if (name) out[String(name)] = row[iVal] ?? null;
  }
  return out;
}
