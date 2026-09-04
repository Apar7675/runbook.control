-- Run only after all migrations in an empty/disposable Supabase database.
-- This actor test creates synthetic rows inside one transaction and rolls every
-- change back. It must never be pointed at a live project.
-- Example: psql "$RUNBOOK_DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1
--   -f supabase/tests/f05_employee_client_boundary_actor.sql

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'f0500000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'f05-actor-a@example.invalid',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f0500000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'f05-actor-b@example.invalid',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f0500000-0000-4000-8000-000000000103',
    'authenticated',
    'authenticated',
    'f05-inactive@example.invalid',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f0500000-0000-4000-8000-000000000104',
    'authenticated',
    'authenticated',
    'f05-outsider@example.invalid',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  );

insert into public.rb_shops (id, name)
values
  ('f0500000-0000-4000-8000-000000000001', 'F05 Synthetic Shop A'),
  ('f0500000-0000-4000-8000-000000000002', 'F05 Synthetic Shop B');

insert into public.rb_shop_members (id, shop_id, user_id, role, is_active)
values
  (
    'f0500000-0000-4000-8000-000000000301',
    'f0500000-0000-4000-8000-000000000001',
    'f0500000-0000-4000-8000-000000000101',
    'member',
    true
  ),
  (
    'f0500000-0000-4000-8000-000000000302',
    'f0500000-0000-4000-8000-000000000001',
    'f0500000-0000-4000-8000-000000000102',
    'member',
    true
  ),
  (
    'f0500000-0000-4000-8000-000000000303',
    'f0500000-0000-4000-8000-000000000001',
    'f0500000-0000-4000-8000-000000000103',
    'member',
    false
  );

insert into public.employees (
  id,
  shop_id,
  auth_user_id,
  employee_code,
  display_name,
  role,
  is_active,
  email,
  phone,
  home_address_1,
  social_security_number,
  mobile_pin_salt_base64,
  mobile_pin_hash_base64
)
values
  (
    'f0500000-0000-4000-8000-000000000201',
    'f0500000-0000-4000-8000-000000000001',
    'f0500000-0000-4000-8000-000000000101',
    'SYN-A',
    'Synthetic Actor A',
    'employee',
    true,
    'synthetic-a@example.invalid',
    '000-000-0001',
    'Synthetic Address A',
    'SYNTHETIC-SSN-A',
    'SYNTHETIC-SALT-A',
    'SYNTHETIC-HASH-A'
  ),
  (
    'f0500000-0000-4000-8000-000000000202',
    'f0500000-0000-4000-8000-000000000001',
    'f0500000-0000-4000-8000-000000000102',
    'SYN-B',
    'Synthetic Actor B',
    'employee',
    true,
    'synthetic-b@example.invalid',
    '000-000-0002',
    'Synthetic Address B',
    'SYNTHETIC-SSN-B',
    'SYNTHETIC-SALT-B',
    'SYNTHETIC-HASH-B'
  ),
  (
    'f0500000-0000-4000-8000-000000000203',
    'f0500000-0000-4000-8000-000000000001',
    'f0500000-0000-4000-8000-000000000103',
    'SYN-INACTIVE',
    'Synthetic Inactive Member',
    'employee',
    true,
    'synthetic-inactive@example.invalid',
    '000-000-0003',
    'Synthetic Address C',
    'SYNTHETIC-SSN-C',
    'SYNTHETIC-SALT-C',
    'SYNTHETIC-HASH-C'
  ),
  (
    'f0500000-0000-4000-8000-000000000204',
    'f0500000-0000-4000-8000-000000000002',
    'f0500000-0000-4000-8000-000000000104',
    'SYN-OUTSIDER',
    'Synthetic Outsider',
    'employee',
    true,
    'synthetic-outsider@example.invalid',
    '000-000-0004',
    'Synthetic Address D',
    'SYNTHETIC-SSN-D',
    'SYNTHETIC-SALT-D',
    'SYNTHETIC-HASH-D'
  );

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"f0500000-0000-4000-8000-000000000101","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'f0500000-0000-4000-8000-000000000101',
  true
);
set local role authenticated;

do $actor_a$
declare
  row_count integer;
  projected_id uuid;
  current_employee_json jsonb;
  projected_avatar_256 text;
  projected_avatar_512 text;
begin
  begin
    perform 1 from public.employees limit 1;
    raise exception 'F05 authenticated actor unexpectedly selected employees directly';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.employees
    set display_name = 'Unexpected direct write'
    where id = 'f0500000-0000-4000-8000-000000000201';
    raise exception 'F05 authenticated actor unexpectedly updated employees directly';
  exception
    when insufficient_privilege then null;
  end;

  select pg_catalog.count(*), pg_catalog.max(self_row.id::text)::uuid
    into row_count, projected_id
  from public.rb_mobile_employee_self(
    'f0500000-0000-4000-8000-000000000001'
  ) as self_row;

  if row_count <> 1
    or projected_id <> 'f0500000-0000-4000-8000-000000000201' then
    raise exception 'F05 signed-in employee projection did not return exactly the actor';
  end if;

  select pg_catalog.count(*)
    into row_count
  from public.rb_mobile_employee_self(
    'f0500000-0000-4000-8000-000000000002'
  );

  if row_count <> 0 then
    raise exception 'F05 signed-in employee projection crossed the shop boundary';
  end if;

  select pg_catalog.count(*)
    into row_count
  from public.rb_mobile_employee_directory(
    'f0500000-0000-4000-8000-000000000001'
  );

  if row_count <> 3 then
    raise exception 'F05 approved directory did not return the three active synthetic employees';
  end if;

  select pg_catalog.count(*)
    into row_count
  from public.rb_mobile_employee_directory(
    'f0500000-0000-4000-8000-000000000002'
  );

  if row_count <> 0 then
    raise exception 'F05 approved directory crossed the caller membership boundary';
  end if;

  if not public.rb_can_read_shop_avatar_object(
    'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000202/avatar_256.jpg'
  ) then
    raise exception 'F05 active member cannot read an active shop employee avatar';
  end if;

  if public.rb_can_read_shop_avatar_object(
    'f0500000-0000-4000-8000-000000000002/employees/f0500000-0000-4000-8000-000000000204/avatar_256.jpg'
  ) then
    raise exception 'F05 avatar read helper crossed the caller membership boundary';
  end if;

  if not public.rb_can_manage_my_avatar_object(
    'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000201/avatar_256.jpg'
  ) then
    raise exception 'F05 active employee cannot manage their own avatar object';
  end if;

  if public.rb_can_manage_my_avatar_object(
    'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000202/avatar_256.jpg'
  ) then
    raise exception 'F05 avatar manage helper accepted another employee path';
  end if;

  select pg_catalog.jsonb_strip_nulls(pg_catalog.to_jsonb(current_row))
    into current_employee_json
  from public.current_employee() as current_row;

  if current_employee_json is null
    or not (current_employee_json ? 'id')
    or not (current_employee_json ? 'shop_id')
    or (current_employee_json - 'id' - 'shop_id') <> '{}'::jsonb then
    raise exception
      'F05 current_employee returned fields outside the safe id/shop projection: %',
      current_employee_json;
  end if;

  select
    avatar_row.avatar_url_256,
    avatar_row.avatar_url_512
    into projected_avatar_256, projected_avatar_512
  from public.rb_mobile_update_my_avatar(
    'f0500000-0000-4000-8000-000000000001',
    'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000201/avatar_256.jpg',
    'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000201/avatar_512.jpg'
  ) as avatar_row;

  if projected_avatar_256 <> 'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000201/avatar_256.jpg'
    or projected_avatar_512 <> 'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000201/avatar_512.jpg' then
    raise exception 'F05 self-avatar RPC returned unexpected paths';
  end if;

  begin
    perform public.rb_mobile_update_my_avatar(
      'f0500000-0000-4000-8000-000000000001',
      'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000202/avatar_256.jpg',
      'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000202/avatar_512.jpg'
    );
    raise exception 'F05 self-avatar RPC accepted another employee path';
  exception
    when invalid_parameter_value then null;
  end;
end
$actor_a$;

reset role;

do $owner_check$
begin
  if exists (
    select 1
    from public.employees as e
    where e.id = 'f0500000-0000-4000-8000-000000000202'
      and (
        e.avatar_url_256 is not null
        or e.avatar_url_512 is not null
      )
  ) then
    raise exception 'F05 actor changed another synthetic employee avatar';
  end if;
end
$owner_check$;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"f0500000-0000-4000-8000-000000000103","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'f0500000-0000-4000-8000-000000000103',
  true
);
set local role authenticated;

do $inactive_actor$
declare
  row_count integer;
begin
  select pg_catalog.count(*)
    into row_count
  from public.rb_mobile_employee_self(
    'f0500000-0000-4000-8000-000000000001'
  );

  if row_count <> 0 then
    raise exception 'F05 inactive membership received the self projection';
  end if;

  select pg_catalog.count(*)
    into row_count
  from public.rb_mobile_employee_directory(
    'f0500000-0000-4000-8000-000000000001'
  );

  if row_count <> 0 then
    raise exception 'F05 inactive membership received the directory projection';
  end if;

  if public.rb_can_read_shop_avatar_object(
    'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000201/avatar_256.jpg'
  ) or public.rb_can_manage_my_avatar_object(
    'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000203/avatar_256.jpg'
  ) then
    raise exception 'F05 inactive membership retained avatar object access';
  end if;

  begin
    perform public.rb_mobile_update_my_avatar(
      'f0500000-0000-4000-8000-000000000001',
      'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000203/avatar_256.jpg',
      'f0500000-0000-4000-8000-000000000001/employees/f0500000-0000-4000-8000-000000000203/avatar_512.jpg'
    );
    raise exception 'F05 inactive membership unexpectedly updated an avatar';
  exception
    when insufficient_privilege then null;
  end;
end
$inactive_actor$;

reset role;
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $anon_actor$
begin
  begin
    perform public.rb_mobile_employee_self(
      'f0500000-0000-4000-8000-000000000001'
    );
    raise exception 'F05 anon unexpectedly executed an employee projection';
  exception
    when insufficient_privilege then null;
  end;
end
$anon_actor$;

reset role;

rollback;
