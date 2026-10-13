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
