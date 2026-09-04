-- F05: keep the employees table server-only while preserving the minimal Mobile
-- identity, directory, and self-avatar capabilities through reviewed projections.
-- This migration changes authorization and function definitions only. It does not
-- read, move, update, or delete existing employee rows when applied.

alter table public.employees enable row level security;

revoke all privileges on table public.employees from public, anon, authenticated;

-- Table-level REVOKE does not remove a separately recorded column grant. Revoke
-- every current column privilege as well so schema drift cannot retain a narrow
-- client path to a protected field.
do $revoke_employee_columns$
declare
  employee_columns text;
begin
  select pg_catalog.string_agg(
      pg_catalog.quote_ident(a.attname),
      ', '
      order by a.attnum
    )
    into employee_columns
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.employees'::regclass
    and a.attnum > 0
    and not a.attisdropped;

  if employee_columns is null then
    raise exception 'public.employees has no revocable columns';
  end if;

  execute pg_catalog.format(
    'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on table public.employees from public, anon, authenticated',
    employee_columns
  );
end
$revoke_employee_columns$;

drop policy if exists "employees read self" on public.employees;
drop policy if exists "employees_foreman_manage" on public.employees;
drop policy if exists "employees_read_if_active_in_messaging" on public.employees;
drop policy if exists "employees_select_own" on public.employees;
drop policy if exists "employees_select_same_shop" on public.employees;
drop policy if exists "employees_select_self" on public.employees;
drop policy if exists "employees_update_self" on public.employees;

-- These two legacy policies query employees directly while evaluating another
-- table's RLS expression. Replace their reachability with the already-present
-- authenticated policies backed by the hardened employee-id helpers below.
drop policy if exists "conversation_members_select_self" on public.conversation_members;
drop policy if exists "roster_select_shop_member" on public.messaging_roster;

-- The legacy avatar policies allow every authenticated user to overwrite every
-- object in the bucket, which bypasses a self-only employees update. Remove the
-- broad paths before creating active-member/self-only replacements below.
drop policy if exists "avatars_read 1oj01fe_0" on storage.objects;
drop policy if exists "avatars_read 1oj01fe_1" on storage.objects;
drop policy if exists "avatars_read" on storage.objects;
drop policy if exists "avatars_update_authenticated" on storage.objects;
drop policy if exists "avatars_upload_authenticated 1oj01fe_0" on storage.objects;
drop policy if exists "avatars_upload_authenticated" on storage.objects;

-- Employee photos are private identity data. Preserve an existing bucket and its
-- contents while ensuring downloads continue through authorized signed URLs.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update
set public = false;

-- Legacy RLS policies still call current_employee(). Preserve only the two values
-- those policies need. Every other employees field, including PII and capability
-- fields, is NULL in the returned composite value.
create or replace function public.current_employee()
returns public.employees
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select pg_catalog.jsonb_populate_record(
    null::public.employees,
    pg_catalog.jsonb_build_object('id', e.id, 'shop_id', e.shop_id)
  )
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.auth_user_id = auth.uid()
    and e.is_active = true
  order by e.created_at, e.id
  limit 1
$function$;

create or replace function public.current_employee_clock()
returns table(employee_id uuid, shop_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select e.id, e.shop_id
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.auth_user_id = auth.uid()
    and e.is_active = true
  order by e.created_at, e.id
  limit 1
$function$;

create or replace function public.current_employee_id(_shop_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select e.id
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.shop_id = _shop_id
    and e.auth_user_id = auth.uid()
    and e.is_active = true
  limit 1
$function$;

create or replace function public.get_my_employee_id(_shop_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  v_employee_id uuid;
begin
  select e.id
    into v_employee_id
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.shop_id = _shop_id
    and e.auth_user_id = auth.uid()
    and e.is_active = true
  limit 1;

  if v_employee_id is null then
    raise exception using
      errcode = '42501',
      message = 'active employee membership required';
  end if;

  return v_employee_id;
end
$function$;

create or replace function public.is_foreman_employee(_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select exists (
    select 1
    from public.employees as e
    join public.rb_shop_members as m
      on m.shop_id = e.shop_id
     and m.user_id = e.auth_user_id
     and m.is_active = true
    where e.shop_id = _shop_id
      and e.auth_user_id = auth.uid()
      and e.is_active = true
      and e.role = 'foreman'
  )
$function$;

create or replace function public.is_messaging_active_employee(_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select exists (
    select 1
    from public.messaging_roster as mr
    join public.employees as e
      on e.id = mr.employee_id
     and e.shop_id = mr.shop_id
     and e.is_active = true
    join public.rb_shop_members as m
      on m.shop_id = e.shop_id
     and m.user_id = e.auth_user_id
     and m.is_active = true
    where mr.shop_id = _shop_id
      and e.auth_user_id = auth.uid()
      and mr.is_active = true
  )
$function$;

create or replace function public.my_employee()
returns table(id uuid, shop_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select e.id, e.shop_id
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.auth_user_id = auth.uid()
    and e.is_active = true
  order by e.created_at, e.id
  limit 1
$function$;

create or replace function public.my_employee_id(_shop_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select e.id
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.auth_user_id = auth.uid()
    and e.shop_id = _shop_id
    and e.is_active = true
  limit 1
$function$;

create or replace function public.rb_current_employee_id(_shop_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select e.id
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.shop_id = _shop_id
    and e.auth_user_id = auth.uid()
    and e.is_active = true
  limit 1
$function$;

create or replace function public.rb_my_employee_id(_shop_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select e.id
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.auth_user_id = auth.uid()
    and e.shop_id = _shop_id
    and e.is_active = true
  limit 1
$function$;

create or replace function public.rb_can_read_shop_avatar_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select exists (
    select 1
    from public.employees as target_employee
    join public.rb_shop_members as caller_membership
      on caller_membership.shop_id = target_employee.shop_id
     and caller_membership.user_id = auth.uid()
     and caller_membership.is_active = true
    where target_employee.is_active = true
      and target_employee.shop_id::text = pg_catalog.split_part(p_object_name, '/', 1)
      and pg_catalog.split_part(p_object_name, '/', 2) = 'employees'
      and target_employee.id::text = pg_catalog.split_part(p_object_name, '/', 3)
      and pg_catalog.split_part(p_object_name, '/', 4) in ('avatar_256.jpg', 'avatar_512.jpg')
      and pg_catalog.split_part(p_object_name, '/', 5) = ''
  )
$function$;

create or replace function public.rb_can_manage_my_avatar_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select exists (
    select 1
    from public.employees as caller_employee
    join public.rb_shop_members as caller_membership
      on caller_membership.shop_id = caller_employee.shop_id
     and caller_membership.user_id = caller_employee.auth_user_id
     and caller_membership.is_active = true
    where caller_employee.auth_user_id = auth.uid()
      and caller_employee.is_active = true
      and caller_employee.shop_id::text = pg_catalog.split_part(p_object_name, '/', 1)
      and pg_catalog.split_part(p_object_name, '/', 2) = 'employees'
      and caller_employee.id::text = pg_catalog.split_part(p_object_name, '/', 3)
      and pg_catalog.split_part(p_object_name, '/', 4) in ('avatar_256.jpg', 'avatar_512.jpg')
      and pg_catalog.split_part(p_object_name, '/', 5) = ''
  )
$function$;

create policy "rb_avatars_select_active_shop_member"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'avatars'
  and public.rb_can_read_shop_avatar_object(name)
);

create policy "rb_avatars_insert_self"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and public.rb_can_manage_my_avatar_object(name)
);

create policy "rb_avatars_update_self"
on storage.objects
as permissive
for update
to authenticated
using (
  bucket_id = 'avatars'
  and public.rb_can_manage_my_avatar_object(name)
)
with check (
  bucket_id = 'avatars'
  and public.rb_can_manage_my_avatar_object(name)
);

-- Approved Mobile projection for the signed-in employee. No auth-user id,
-- employee code, role, contact data, address data, access flags, or PIN material
-- is returned.
create or replace function public.rb_mobile_employee_self(p_shop_id uuid)
returns table(
  id uuid,
  shop_id uuid,
  display_name text,
  is_active boolean,
  avatar_url_256 text,
  avatar_url_512 text
)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select
    e.id,
    e.shop_id,
    e.display_name,
    e.is_active,
    e.avatar_url_256,
    e.avatar_url_512
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.shop_id = p_shop_id
    and e.auth_user_id = auth.uid()
    and e.is_active = true
  limit 1
$function$;

-- Approved Mobile directory projection. The caller must be an active member and
-- an active employee in the requested shop. Only display identity is returned.
create or replace function public.rb_mobile_employee_directory(p_shop_id uuid)
returns table(
  id uuid,
  shop_id uuid,
  display_name text,
  is_active boolean,
  avatar_url_256 text,
  avatar_url_512 text
)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select
    e.id,
    e.shop_id,
    e.display_name,
    e.is_active,
    e.avatar_url_256,
    e.avatar_url_512
  from public.employees as e
  where e.shop_id = p_shop_id
    and e.is_active = true
    and exists (
      select 1
      from public.employees as caller_employee
      join public.rb_shop_members as caller_membership
        on caller_membership.shop_id = caller_employee.shop_id
       and caller_membership.user_id = caller_employee.auth_user_id
       and caller_membership.is_active = true
      where caller_employee.shop_id = p_shop_id
        and caller_employee.auth_user_id = auth.uid()
        and caller_employee.is_active = true
    )
  order by e.display_name, e.id
$function$;

-- The employee id is intentionally not a parameter. An authenticated caller can
-- update only the active employee row mapped to their own active membership.
create or replace function public.rb_mobile_update_my_avatar(
  p_shop_id uuid,
  p_avatar_url_256 text,
  p_avatar_url_512 text
)
returns table(
  id uuid,
  shop_id uuid,
  display_name text,
  is_active boolean,
  avatar_url_256 text,
  avatar_url_512 text
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  v_employee_id uuid;
  v_expected_prefix text;
begin
  select e.id
    into v_employee_id
  from public.employees as e
  join public.rb_shop_members as m
    on m.shop_id = e.shop_id
   and m.user_id = e.auth_user_id
   and m.is_active = true
  where e.shop_id = p_shop_id
    and e.auth_user_id = auth.uid()
    and e.is_active = true
  limit 1;

  if v_employee_id is null then
    raise exception using
      errcode = '42501',
      message = 'active employee membership required';
  end if;

  v_expected_prefix := p_shop_id::text || '/employees/' || v_employee_id::text || '/';

  if p_avatar_url_256 is distinct from (v_expected_prefix || 'avatar_256.jpg')
     or p_avatar_url_512 is distinct from (v_expected_prefix || 'avatar_512.jpg') then
    raise exception using
      errcode = '22023',
      message = 'avatar paths must target the signed-in employee';
  end if;

  return query
  update public.employees as e
  set avatar_url_256 = p_avatar_url_256,
      avatar_url_512 = p_avatar_url_512,
      avatar_updated_at = pg_catalog.clock_timestamp()
  where e.id = v_employee_id
    and e.shop_id = p_shop_id
  returning
    e.id,
    e.shop_id,
    e.display_name,
    e.is_active,
    e.avatar_url_256,
    e.avatar_url_512;
end
$function$;

-- CREATE OR REPLACE retains old ACLs, so reset every client-callable helper.
revoke all privileges on function public.current_employee() from public, anon, authenticated;
revoke all privileges on function public.current_employee_clock() from public, anon, authenticated;
revoke all privileges on function public.current_employee_id(uuid) from public, anon, authenticated;
revoke all privileges on function public.get_my_employee_id(uuid) from public, anon, authenticated;
revoke all privileges on function public.is_foreman_employee(uuid) from public, anon, authenticated;
revoke all privileges on function public.is_messaging_active_employee(uuid) from public, anon, authenticated;
revoke all privileges on function public.my_employee() from public, anon, authenticated;
revoke all privileges on function public.my_employee_id(uuid) from public, anon, authenticated;
revoke all privileges on function public.rb_current_employee_id(uuid) from public, anon, authenticated;
revoke all privileges on function public.rb_my_employee_id(uuid) from public, anon, authenticated;
revoke all privileges on function public.rb_can_read_shop_avatar_object(text) from public, anon, authenticated;
revoke all privileges on function public.rb_can_manage_my_avatar_object(text) from public, anon, authenticated;
revoke all privileges on function public.rb_mobile_employee_self(uuid) from public, anon, authenticated;
revoke all privileges on function public.rb_mobile_employee_directory(uuid) from public, anon, authenticated;
revoke all privileges on function public.rb_mobile_update_my_avatar(uuid, text, text) from public, anon, authenticated;

grant execute on function public.current_employee() to authenticated, service_role;
grant execute on function public.current_employee_clock() to authenticated, service_role;
grant execute on function public.current_employee_id(uuid) to authenticated, service_role;
grant execute on function public.get_my_employee_id(uuid) to authenticated, service_role;
grant execute on function public.is_foreman_employee(uuid) to authenticated, service_role;
grant execute on function public.is_messaging_active_employee(uuid) to authenticated, service_role;
grant execute on function public.my_employee() to authenticated, service_role;
grant execute on function public.my_employee_id(uuid) to authenticated, service_role;
grant execute on function public.rb_current_employee_id(uuid) to authenticated, service_role;
grant execute on function public.rb_my_employee_id(uuid) to authenticated, service_role;
grant execute on function public.rb_can_read_shop_avatar_object(text) to authenticated, service_role;
grant execute on function public.rb_can_manage_my_avatar_object(text) to authenticated, service_role;
grant execute on function public.rb_mobile_employee_self(uuid) to authenticated, service_role;
grant execute on function public.rb_mobile_employee_directory(uuid) to authenticated, service_role;
grant execute on function public.rb_mobile_update_my_avatar(uuid, text, text) to authenticated, service_role;
