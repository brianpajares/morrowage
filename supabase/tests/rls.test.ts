/**
 * AT-33 · RLS. Ejecuta las migraciones reales de `supabase/migrations/` sobre PGlite (Postgres 17 en
 * proceso) emulando roles y `auth.uid()` de Supabase, y comprueba qué puede leer cada rol.
 * La misma verificación se repite contra el proyecto Supabase real en `docs/evidence/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATIONS = path.resolve(import.meta.dirname, '../migrations');
const ADMIN_ID = randomUUID();
const OTHER_ID = randomUUID();

let db: PGlite;
const ids = { calc: randomUUID(), lead: randomUUID(), report: randomUUID(), calcWithOrder: randomUUID(), order: randomUUID() };

async function as<T>(role: 'anon' | 'authenticated' | 'service_role' | 'postgres', sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub ?? ''}', false);`);
  await db.exec(role === 'postgres' ? 'reset role;' : `set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

async function denied(sql: string): Promise<boolean> {
  try {
    await db.query(sql);
    return false;
  } catch (e) {
    return /permission denied|row-level security/i.test(String(e));
  }
}

const rows = async (sql: string) => (await db.query(sql)).rows;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto, citext } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  for (const f of fs.readdirSync(MIGRATIONS).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
  }

  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN_ID}', 'admin@morrowage.test'), ('${OTHER_ID}', 'user@morrowage.test');
    insert into public.admin_users (user_id) values ('${ADMIN_ID}');
    insert into public.calculations (id, session_hash, locale, input_payload, output_payload, app_version, scope_accepted_at, expires_at)
      values ('${ids.calc}', 'h', 'es', '{"age_years":52}', '{"morrow_age":47.7}', '4.0.0', now(), now() + interval '30 days'),
             ('${ids.calcWithOrder}', 'h2', 'en', '{"age_years":60}', '{"morrow_age":58.2}', '4.0.0', now(), now() - interval '1 day');
    insert into public.leads (id, calculation_id, email, locale, service_consent_at)
      values ('${ids.lead}', '${ids.calc}', 'person@morrowage.test', 'es', now());
    insert into public.reports (id, lead_id, calculation_id, verification_id, access_tier, token_hash, token_expires_at)
      values ('${ids.report}', '${ids.lead}', '${ids.calc}', 'MA-26-AAAAAA', 'validation_full', 'sha-hash-1', now() + interval '7 days');
    insert into public.orders (id, calculation_id, amount_minor, currency)
      values ('${ids.order}', '${ids.calcWithOrder}', 1900, 'USD');
    insert into public.deletion_requests (email, locale) values ('person@morrowage.test', 'es');
    insert into public.stripe_webhook_events (event_id, event_type, payload_sha256, status) values ('evt_1', 'x', 'h', 'processed');
  `);
});

afterAll(async () => {
  await db.close();
});

describe('AT-33 · RLS (migraciones reales)', () => {
  it('todas las tablas de public tienen RLS activo', async () => {
    const off = await rows(`select tablename from pg_tables where schemaname='public' and not rowsecurity`);
    expect(off).toEqual([]);
  });

  it('anon no puede leer ninguna tabla sensible', async () => {
    await as('anon', null, async () => {
      for (const t of ['calculations', 'reports', 'orders', 'stripe_webhook_events', 'deletion_requests', 'funnel_counters']) {
        expect(await denied(`select * from public.${t}`), t).toBe(true);
      }
      // leads: sin política para anon → 0 filas (no error).
      expect(await denied('select * from public.leads')).toBe(true);
      expect(await denied('select * from public.admin_users')).toBe(true);
      expect(await denied(`insert into public.leads (calculation_id, email, locale, service_consent_at) values ('${ids.calc}', 'x@y.zz', 'es', now())`)).toBe(true);
    });
  });

  it('usuario autenticado NO admin no lee leads ni tablas sensibles', async () => {
    await as('authenticated', OTHER_ID, async () => {
      expect(await rows('select * from public.leads')).toHaveLength(0);
      expect(await rows('select * from public.admin_users')).toHaveLength(0);
      expect(await rows('select * from public.admin_audit_log')).toHaveLength(0);
      for (const t of ['calculations', 'reports', 'orders', 'stripe_webhook_events', 'deletion_requests', 'funnel_counters']) {
        expect(await denied(`select * from public.${t}`), t).toBe(true);
      }
      expect(await denied('select * from public.admin_leads_safe')).toBe(true);
    });
  });

  it('el frontend admin lee leads pero NUNCA calculations, reports (token_hash), orders ni deletion_requests', async () => {
    await as('authenticated', ADMIN_ID, async () => {
      const leads = await rows('select id, email from public.leads');
      expect(leads).toHaveLength(1);
      expect(await rows('select user_id from public.admin_users')).toHaveLength(1);
      expect(await denied('select * from public.calculations')).toBe(true);
      expect(await denied('select input_payload from public.calculations')).toBe(true);
      expect(await denied('select token_hash from public.reports')).toBe(true);
      expect(await denied('select * from public.orders')).toBe(true);
      expect(await denied('select * from public.deletion_requests')).toBe(true);
      expect(await denied('select * from public.stripe_webhook_events')).toBe(true);
      // Un admin tampoco puede escribir leads desde el frontend.
      expect(await denied(`update public.leads set status = 'deleted'`)).toBe(true);
      expect(await denied(`delete from public.leads`)).toBe(true);
      expect(await denied(`insert into public.admin_users (user_id) values ('${OTHER_ID}')`)).toBe(true);
    });
  });

  it('la vista admin_leads_safe (vía service_role) no expone payload, resultado crudo ni token', async () => {
    await as('service_role', null, async () => {
      const [row] = await rows('select * from public.admin_leads_safe');
      expect(row).toBeDefined();
      const keys = Object.keys(row as object);
      expect(keys).toEqual(
        expect.arrayContaining(['id', 'email', 'locale', 'status', 'verification_id', 'delivered_at', 'last_sent_at']),
      );
      for (const forbidden of ['input_payload', 'output_payload', 'token_hash', 'token_expires_at', 'calculation_id']) {
        expect(keys).not.toContain(forbidden);
      }
    });
  });

  it('service_role lee y escribe (los route handlers actúan tras authz)', async () => {
    await as('service_role', null, async () => {
      expect(await rows('select * from public.calculations')).toHaveLength(2);
      await db.query(`select public.increment_funnel_counter(current_date, 'es', 'landing_view', '', 1)`);
      await db.query(`select public.increment_funnel_counter(current_date, 'es', 'landing_view', '', 2)`);
      const [c] = await rows(`select count from public.funnel_counters where event = 'landing_view'`);
      expect(Number((c as { count: string | number }).count)).toBe(3);
    });
  });

  it('anon/authenticated no pueden ejecutar funciones operativas', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await as(role, OTHER_ID, async () => {
        expect(await denied(`select public.increment_funnel_counter(current_date, 'es', 'x', '', 1)`)).toBe(true);
        expect(await denied(`select public.purge_expired_data(now())`)).toBe(true);
      });
    }
  });

  it('purge_expired_data borra lo vencido sin pedidos y solo vacía el payload de lo que tiene pedidos', async () => {
    await as('service_role', null, async () => {
      const [{ purge_expired_data: out }] = (await rows(`select public.purge_expired_data(now() + interval '60 days')`)) as Array<{
        purge_expired_data: { calculations: number; scrubbed: number };
      }>;
      expect(out.calculations).toBe(1); // la calculation con lead/report (cascada)
      expect(out.scrubbed).toBe(1); // la que tiene order
      expect(await rows('select * from public.leads')).toHaveLength(0);
      expect(await rows('select * from public.reports')).toHaveLength(0);
      const [kept] = await rows(`select input_payload, output_payload from public.calculations where id = '${ids.calcWithOrder}'`);
      expect(kept).toEqual({ input_payload: {}, output_payload: {} });
    });
  });
});
