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
