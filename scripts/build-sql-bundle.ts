/**
 * Genera `supabase/bundle.sql`: todas las migraciones, en orden, en UN archivo para pegar en
 * Supabase → SQL Editor → Run (proyecto nuevo). `npm run db:bundle`.
 * Las migraciones de ops y de pagos son idempotentes; la inicial crea los tipos, así que el bundle es
 * para un proyecto NUEVO. En uno existente, ejecuta solo las migraciones que falten.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'supabase', 'migrations');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

const parts = [
  '-- MorrowAge · esquema completo (bundle de migraciones, en orden).',
  '-- Generado con `npm run db:bundle`. Pégalo en Supabase → SQL Editor → New query → Run.',
  '-- Solo para un proyecto NUEVO. En uno existente ejecuta únicamente las migraciones que falten.',
  `-- Migraciones incluidas: ${files.join(', ')}`,
  '',
  ...files.flatMap((f) => [`-- ==== ${f} ====`, fs.readFileSync(path.join(DIR, f), 'utf8').trimEnd(), '']),
  '-- ==== Comprobación final ====',
  "select (select count(*) from pg_tables where schemaname = 'public') as tablas,",
  "       (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) as tablas_sin_rls,",
  "       (select count(*) from pg_proc where proname in ('ma_order_mark_paid', 'ma_order_claim_fulfillment', 'purge_expired_data', 'increment_funnel_counter')) as funciones;",
  '-- Esperado: tablas = 9, tablas_sin_rls = 0, funciones = 4.',
  '',
];

const out = path.join(ROOT, 'supabase', 'bundle.sql');
fs.writeFileSync(out, parts.join('\n'));
console.log(`supabase/bundle.sql generado (${files.length} migraciones, ${fs.statSync(out).size} bytes)`);
