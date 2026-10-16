-- MorrowAge · esquema completo (bundle de migraciones, en orden).
-- Generado con `npm run db:bundle`. Pégalo en Supabase → SQL Editor → New query → Run.
-- Solo para un proyecto NUEVO. En uno existente ejecuta únicamente las migraciones que falten.
-- Migraciones incluidas: 20261007000000_init_schema.sql, 20261007000100_ops_counters_and_purge.sql, 20261016000000_paypal_payments.sql

-- ==== 20261007000000_init_schema.sql ====
-- MorrowAge v4 · Supabase/Postgres schema
-- Apply in a dedicated migration. All user-facing writes should go through server Route Handlers.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.lead_status as enum ('requested','generating','delivered','failed','paid','deleted');
create type public.order_status as enum ('pending','paid','failed','refunded');
create type public.deletion_status as enum ('received','verifying','completed','rejected_legal_hold');

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.calculations (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null,
  locale text not null check (locale in ('es','en','pt')),
  market_hint_coarse text,
  input_payload jsonb not null,
  output_payload jsonb not null,
  model_version text not null default '2.1',
  app_version text not null,
  scope_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists calculations_expires_at_idx on public.calculations(expires_at);
create index if not exists calculations_session_hash_idx on public.calculations(session_hash);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.calculations(id) on delete cascade,
  email citext not null,
  locale text not null check (locale in ('es','en','pt')),
  service_consent_at timestamptz not null,
  marketing_opt_in boolean not null default false,
  marketing_consent_at timestamptz,
  subscription_waitlist_opt_in boolean not null default false,
  status public.lead_status not null default 'requested',
  delivery_provider_id text,
  delivery_error_class text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_email_idx on public.leads(email);
create index if not exists leads_status_idx on public.leads(status);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  calculation_id uuid not null references public.calculations(id) on delete cascade,
  verification_id text not null unique,
  access_tier text not null check (access_tier in ('validation_full','paid_full')),
  token_hash text not null unique,
  token_expires_at timestamptz not null,
  generated_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_sent_at timestamptz,
  pdf_checksum_sha256 text,
  package_version text not null default '4.0'
);

create index if not exists reports_token_expires_idx on public.reports(token_expires_at);
create index if not exists reports_lead_idx on public.reports(lead_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  calculation_id uuid not null references public.calculations(id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (char_length(currency) = 3),
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  payload_sha256 text not null,
  status text not null check (status in ('processing','processed','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_class text
);

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  locale text not null check (locale in ('es','en','pt')),
  verification_id text,
  status public.deletion_status not null default 'received',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text
);

create index if not exists deletion_requests_email_idx on public.deletion_requests(email);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  metadata_safe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Safe admin projection. Intentionally excludes calculation payload and report token/hash.
create or replace view public.admin_leads_safe
with (security_invoker = true)
as
select
  l.id,
  l.email,
  l.locale,
  l.marketing_opt_in,
  l.subscription_waitlist_opt_in,
  l.status,
  l.created_at,
  l.updated_at,
  r.id as report_id,
  r.verification_id,
  r.delivered_at,
  r.last_sent_at
from public.leads l
left join public.reports r on r.lead_id = l.id;

alter table public.admin_users enable row level security;
alter table public.calculations enable row level security;
alter table public.leads enable row level security;
alter table public.reports enable row level security;
alter table public.orders enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.admin_audit_log enable row level security;

-- No anon/authenticated direct access to calculations, reports, orders, webhook events or deletion requests.
-- Server route handlers use the service role after performing authz/validation.

drop policy if exists "admin can see own admin membership" on public.admin_users;
create policy "admin can see own admin membership"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "admins can read leads" on public.leads;
create policy "admins can read leads"
on public.leads
for select
to authenticated
using (exists (
  select 1 from public.admin_users au where au.user_id = auth.uid()
));

drop policy if exists "admins can read audit log" on public.admin_audit_log;
create policy "admins can read audit log"
on public.admin_audit_log
for select
to authenticated
using (exists (
  select 1 from public.admin_users au where au.user_id = auth.uid()
));

-- Explicitly no SELECT policies for calculations/reports/orders/webhook events/deletion_requests.
-- Important: do not add admin SELECT to calculations. Re-send is a server action using service role.

revoke all on public.calculations from anon, authenticated;
revoke all on public.reports from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;
revoke all on public.deletion_requests from anon, authenticated;

grant select on public.leads to authenticated;
grant select on public.admin_users to authenticated;
grant select on public.admin_audit_log to authenticated;
grant select on public.admin_leads_safe to authenticated;

-- Updated-at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Operational cleanup should run server-side with service role:
-- delete calculations/reports past retention, then cascade dependent sensitive records where policy permits.

-- ==== 20261007000100_ops_counters_and_purge.sql ====
-- MorrowAge v4 · operaciones (añadido por la implementación; ver DECISIONS.md 2026-10-07)
--  1) Contadores agregados de funnel SIN PII (alimentan /admin sin tocar health payload).
--  2) Función de purga por retención (REPORT_RETENTION_DAYS) ejecutada solo por service_role.

create table if not exists public.funnel_counters (
  day date not null,
  locale text not null check (locale in ('es','en','pt')),
  event text not null check (char_length(event) between 1 and 64),
  dim text not null default '' check (char_length(dim) <= 64),
  count bigint not null default 0 check (count >= 0),
  primary key (day, locale, event, dim)
);

alter table public.funnel_counters enable row level security;
revoke all on public.funnel_counters from anon, authenticated;
-- Sin políticas: solo service_role (route handlers server-side tras authz) puede leer/escribir.

create or replace function public.increment_funnel_counter(
  p_day date,
  p_locale text,
  p_event text,
  p_dim text default '',
  p_by bigint default 1
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.funnel_counters as fc (day, locale, event, dim, count)
  values (p_day, p_locale, p_event, coalesce(p_dim, ''), greatest(p_by, 0))
  on conflict (day, locale, event, dim)
  do update set count = fc.count + excluded.count;
$$;

revoke all on function public.increment_funnel_counter(date, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.increment_funnel_counter(date, text, text, text, bigint) to service_role;

-- Purga por retención. Las calculations con pedidos (orders.calculation_id ON DELETE RESTRICT) no se
-- borran (obligación contable): solo se vacía el payload de salud.
create or replace function public.purge_expired_data(p_now timestamptz default now())
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted int := 0;
  v_scrubbed int := 0;
begin
  delete from public.calculations c
  where c.expires_at < p_now
    and not exists (select 1 from public.orders o where o.calculation_id = c.id);
  get diagnostics v_deleted = row_count;

  update public.calculations c
  set input_payload = '{}'::jsonb,
      output_payload = '{}'::jsonb
  where c.expires_at < p_now
    and exists (select 1 from public.orders o where o.calculation_id = c.id)
    and (c.input_payload <> '{}'::jsonb or c.output_payload <> '{}'::jsonb);
  get diagnostics v_scrubbed = row_count;

  return jsonb_build_object('calculations', v_deleted, 'scrubbed', v_scrubbed);
end;
$$;

revoke all on function public.purge_expired_data(timestamptz) from public, anon, authenticated;
grant execute on function public.purge_expired_data(timestamptz) to service_role;

create index if not exists funnel_counters_day_idx on public.funnel_counters(day desc);

-- Defensa en profundidad: Supabase concede por defecto ALL a anon/authenticated sobre tablas nuevas.
-- Las políticas ya impiden el acceso, pero retiramos también los privilegios no necesarios.
revoke all on public.leads from anon;
revoke insert, update, delete, truncate, references, trigger on public.leads from authenticated;
revoke all on public.admin_users from anon;
revoke insert, update, delete, truncate, references, trigger on public.admin_users from authenticated;
revoke all on public.admin_audit_log from anon;
revoke insert, update, delete, truncate, references, trigger on public.admin_audit_log from authenticated;
revoke all on public.admin_leads_safe from anon;
revoke insert, update, delete, truncate, references, trigger on public.admin_leads_safe from authenticated;

-- ==== 20261016000000_paypal_payments.sql ====
-- MorrowAge v4 · pagos con PayPal Checkout (Orders v2). Añadido por la implementación;
-- ver DECISIONS.md (2026-10-16). Idempotente: se puede ejecutar más de una vez.
--
--  1) reports.access_tier admite `preview_locked` (vista previa difuminada, sin informe completo).
--  2) orders: proveedor (stripe | paypal), ids de PayPal únicos, estado de entrega y reintentos.
--  3) Transiciones atómicas que ejecuta solo service_role:
--       ma_order_mark_paid(...)            → 'paid' | 'already_paid' | 'mismatch'
--       ma_order_claim_fulfillment(...)    → true si ESTE proceso obtiene la entrega en exclusiva
--     Así dos procesos (captura del navegador + webhook + cron) nunca entregan dos veces.
--
-- Los eventos de webhook de PayPal reutilizan `stripe_webhook_events` (event_id, tipo, estado):
-- los ids de PayPal (`WH-…`) no colisionan con los de Stripe (`evt_…`).

alter table public.reports drop constraint if exists reports_access_tier_check;
alter table public.reports
  add constraint reports_access_tier_check
  check (access_tier in ('validation_full', 'paid_full', 'preview_locked'));

alter table public.orders add column if not exists provider text not null default 'stripe';
alter table public.orders drop constraint if exists orders_provider_check;
alter table public.orders add constraint orders_provider_check check (provider in ('stripe', 'paypal'));

alter table public.orders add column if not exists paypal_order_id text;
alter table public.orders add column if not exists paypal_capture_id text;
alter table public.orders add column if not exists sandbox boolean not null default false;
alter table public.orders add column if not exists fulfillment_status text not null default 'not_started';
alter table public.orders drop constraint if exists orders_fulfillment_status_check;
alter table public.orders
  add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('not_started', 'claimed', 'delivered', 'failed'));
alter table public.orders add column if not exists fulfillment_claimed_at timestamptz;
alter table public.orders add column if not exists fulfillment_attempts integer not null default 0;
alter table public.orders add column if not exists last_error_class text;
-- Aceptación de términos y renuncia al desistimiento (producto digital entregado al instante).
alter table public.orders add column if not exists terms_accepted_at timestamptz;

create unique index if not exists orders_paypal_order_id_key on public.orders (paypal_order_id) where paypal_order_id is not null;
create unique index if not exists orders_paypal_capture_id_key on public.orders (paypal_capture_id) where paypal_capture_id is not null;
create index if not exists orders_fulfillment_idx on public.orders (status, fulfillment_status);
create index if not exists orders_calculation_idx on public.orders (calculation_id);

create or replace function public.ma_order_mark_paid(
  p_order uuid,
  p_paypal_order text,
  p_capture text,
  p_amount integer,
  p_currency text,
  p_sandbox boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.orders%rowtype;
begin
  select * into v_row from public.orders where id = p_order for update;
  if not found then
    return 'mismatch';
  end if;

  if v_row.status = 'paid' then
    -- Misma captura: reintento legítimo (webhook + navegador). Otra captura: no se toca.
    if v_row.paypal_capture_id is not distinct from p_capture then
      return 'already_paid';
    end if;
    return 'mismatch';
  end if;

  if v_row.status <> 'pending'
     or v_row.provider <> 'paypal'
     or v_row.amount_minor <> p_amount
     or upper(v_row.currency) <> upper(p_currency)
     or (v_row.paypal_order_id is not null and v_row.paypal_order_id <> p_paypal_order) then
    return 'mismatch';
  end if;

  update public.orders
     set status = 'paid',
         paid_at = now(),
         paypal_order_id = p_paypal_order,
         paypal_capture_id = p_capture,
         sandbox = coalesce(p_sandbox, false),
         last_error_class = null
   where id = p_order;
  return 'paid';
exception
  when unique_violation then
    -- Esa captura ya pertenece a otro pedido.
    return 'mismatch';
end;
$$;

create or replace function public.ma_order_claim_fulfillment(p_order uuid, p_stale_minutes integer default 10)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.orders
     set fulfillment_status = 'claimed',
         fulfillment_claimed_at = now(),
         fulfillment_attempts = fulfillment_attempts + 1
   where id = p_order
     and status = 'paid'
     and (
       fulfillment_status in ('not_started', 'failed')
       or (fulfillment_status = 'claimed' and fulfillment_claimed_at < now() - make_interval(mins => greatest(p_stale_minutes, 1)))
     )
  returning id into v_id;
  return v_id is not null;
end;
$$;

revoke all on function public.ma_order_mark_paid(uuid, text, text, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.ma_order_mark_paid(uuid, text, text, integer, text, boolean) to service_role;
revoke all on function public.ma_order_claim_fulfillment(uuid, integer) from public, anon, authenticated;
grant execute on function public.ma_order_claim_fulfillment(uuid, integer) to service_role;

-- Comprobación final (debe devolver 2 funciones y 9 columnas nuevas en orders):
--   select count(*) from pg_proc where proname in ('ma_order_mark_paid', 'ma_order_claim_fulfillment');
--   select count(*) from information_schema.columns
--    where table_name = 'orders' and column_name in
--      ('provider','paypal_order_id','paypal_capture_id','sandbox','fulfillment_status','fulfillment_claimed_at','fulfillment_attempts','last_error_class','terms_accepted_at');

-- ==== Comprobación final ====
select (select count(*) from pg_tables where schemaname = 'public') as tablas,
       (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) as tablas_sin_rls,
       (select count(*) from pg_proc where proname in ('ma_order_mark_paid', 'ma_order_claim_fulfillment', 'purge_expired_data', 'increment_funnel_counter')) as funciones;
-- Esperado: tablas = 9, tablas_sin_rls = 0, funciones = 4.
