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
