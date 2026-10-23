-- Disposable PostgreSQL fixture only. Never run this file against an application DB.
begin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.employees(
 id uuid primary key, shop_id uuid not null, auth_user_id uuid not null,
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.rb_shop_members(shop_id uuid not null, user_id uuid not null, is_active boolean not null default true);
create table public.time_events(
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  shop_id uuid not null,
  event_type text not null check(event_type in ('CLOCK_IN','CLOCK_OUT','BREAK_START','BREAK_END','LUNCH_START','LUNCH_END')),
  client_ts timestamptz not null,
  server_ts timestamptz not null default now(),
  needs_review boolean not null default false,
  policy_result text
);
-- Current F05 hardened identity helper and the existing time_events SELECT rule.
-- The summary itself remains invoker; clients receive no direct employee/member grant.
create function public.current_employee_clock()
returns table(employee_id uuid, shop_id uuid) language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select e.id, e.shop_id
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id and m.user_id = e.auth_user_id and m.is_active = true
  where e.auth_user_id = auth.uid() and e.is_active = true
  order by e.created_at, e.id
  limit 1
$function$;
alter table public.employees enable row level security;
alter table public.rb_shop_members enable row level security;
alter table public.time_events enable row level security;
create policy time_events_select_own on public.time_events for select to authenticated using(
  exists(select 1 from public.current_employee_clock() ce
    where ce.employee_id = time_events.employee_id and ce.shop_id = time_events.shop_id)
);
grant usage on schema public, auth to authenticated;
grant select on public.time_events to authenticated;
insert into public.employees(id,shop_id,auth_user_id) values
('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000002'),
('00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000003');
insert into public.employees(id,shop_id,auth_user_id,is_active) values
('00000000-0000-4000-8000-0000000000d4','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000004',false),
('00000000-0000-4000-8000-0000000000e5','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000005',true);
insert into public.rb_shop_members(shop_id,user_id,is_active)
select shop_id,auth_user_id,auth_user_id<>'00000000-0000-4000-8000-000000000005'::uuid from public.employees;
