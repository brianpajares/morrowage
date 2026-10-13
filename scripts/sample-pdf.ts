/**
 * Genera PDFs de muestra (datos sintéticos de spec/test_vectors.json) en `.scratch/` para
 * inspección visual: `npx tsx scripts/sample-pdf.ts [TC01] [es|en|pt]`.
 */
import fs from 'node:fs';
import path from 'node:path';
import vectors from '../spec/test_vectors.json';
import { loadBundledSnapshot } from '../src/lib/drive/bundled';
import { getBundledModelParams } from '../src/lib/model/bundled';
import type { Inputs } from '../src/lib/model/input-spec';
import { isLocale, type Locale } from '../src/lib/locales';
import { buildReportData } from '../src/lib/report/build';
import { renderReportPdf } from '../src/reports/pdf/render';

const id = process.argv[2] ?? 'TC01';
const loc = process.argv[3] ?? 'es';
const locale: Locale = isLocale(loc) ? loc : 'es';

const vector = vectors.vectors.find((v) => v.id === id);
if (!vector) throw new Error(`Vector desconocido: ${id}`);

const params = getBundledModelParams();
const data = buildReportData({
  inputs: vector.inputs as Inputs,
  params,
  verificationId: 'MA-26-8F3C2A',
  appVersion: '4.0.0',
  accessTier: 'validation_full',
  locale,
  generatedAt: new Date().toISOString(),
});
const pdf = await renderReportPdf({
  data,
  locale,
  params,
  sources: loadBundledSnapshot().sources,
  tokenExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  retentionDays: 30,
});
const out = path.resolve(import.meta.dirname, '..', '.scratch');
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, `sample-${id}-${locale}.pdf`);
fs.writeFileSync(file, pdf.bytes);
console.log(`${file} (${pdf.bytes.length} bytes, sha256 ${pdf.sha256.slice(0, 12)}…)`);
