-- Run after all migrations in a disposable PostgreSQL/Supabase database.
-- This test reads catalog metadata only and always rolls back.
-- Example: psql "$RUNBOOK_DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1
--   -f supabase/tests/f05_employee_client_boundary_catalog.sql

begin transaction read only;

do $assert$
declare
  employee_table_oid oid := to_regclass('public.employees');
  target_role text;
  target_role_oid oid;
  target_signature text;
  target_function_oid oid;
  actual_output_names text[];
  actual_output_types text[];
  expected_output_names constant text[] := array[
    'id',
    'shop_id',
    'display_name',
    'is_active',
    'avatar_url_256',
    'avatar_url_512'
  ];
  expected_output_types constant text[] := array[
    'uuid',
    'uuid',
    'text',
    'boolean',
    'text',
    'text'
  ];
  projection_signatures constant text[] := array[
    'public.rb_mobile_employee_self(uuid)',
    'public.rb_mobile_employee_directory(uuid)',
    'public.rb_mobile_update_my_avatar(uuid,text,text)'
  ];
  hardened_helper_signatures constant text[] := array[
    'public.current_employee()',
    'public.current_employee_clock()',
    'public.current_employee_id(uuid)',
    'public.get_my_employee_id(uuid)',
    'public.is_foreman_employee(uuid)',
    'public.is_messaging_active_employee(uuid)',
    'public.my_employee()',
    'public.my_employee_id(uuid)',
    'public.rb_current_employee_id(uuid)',
    'public.rb_my_employee_id(uuid)',
    'public.rb_can_read_shop_avatar_object(text)',
    'public.rb_can_manage_my_avatar_object(text)',
    'public.rb_mobile_employee_self(uuid)',
    'public.rb_mobile_employee_directory(uuid)',
    'public.rb_mobile_update_my_avatar(uuid,text,text)'
  ];
begin
  if employee_table_oid is null then
    raise exception 'F05 target table is missing: public.employees';
  end if;

  if not (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    where c.oid = employee_table_oid
  ) then
    raise exception 'F05 employees table does not have RLS enabled';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies as p
    where p.schemaname = 'public'
      and p.tablename = 'employees'
  ) then
    raise exception 'F05 employees table unexpectedly has an RLS policy';
  end if;

  if not exists (
    select 1
    from storage.buckets as b
    where b.id = 'avatars'
      and b.public = false
  ) then
    raise exception 'F05 avatars bucket is missing or public';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies as p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname = any (array[
        'avatars_read 1oj01fe_0',
        'avatars_read 1oj01fe_1',
        'avatars_read',
        'avatars_update_authenticated',
        'avatars_upload_authenticated 1oj01fe_0',
        'avatars_upload_authenticated'
      ])
  ) then
    raise exception 'F05 legacy broad avatar policy remains installed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies as p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname not in (
        'rb_avatars_select_active_shop_member',
        'rb_avatars_insert_self',
        'rb_avatars_update_self'
      )
      and (
        coalesce(p.qual, '') like '%avatars%'
        or coalesce(p.with_check, '') like '%avatars%'
      )
  ) then
    raise exception 'F05 an unexpected policy still authorizes the avatars bucket';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies as p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname = 'rb_avatars_select_active_shop_member'
      and p.cmd = 'SELECT'
      and p.roles = array['authenticated']::name[]
      and coalesce(p.qual, '') like '%avatars%'
      and coalesce(p.qual, '') like '%rb_can_read_shop_avatar_object%'
  ) then
    raise exception 'F05 active-shop avatar SELECT policy is missing or unsafe';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies as p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname = 'rb_avatars_insert_self'
      and p.cmd = 'INSERT'
      and p.roles = array['authenticated']::name[]
      and coalesce(p.with_check, '') like '%avatars%'
      and coalesce(p.with_check, '') like '%rb_can_manage_my_avatar_object%'
  ) then
    raise exception 'F05 self-only avatar INSERT policy is missing or unsafe';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies as p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname = 'rb_avatars_update_self'
      and p.cmd = 'UPDATE'
      and p.roles = array['authenticated']::name[]
      and coalesce(p.qual, '') like '%avatars%'
      and coalesce(p.qual, '') like '%rb_can_manage_my_avatar_object%'
      and coalesce(p.with_check, '') like '%avatars%'
      and coalesce(p.with_check, '') like '%rb_can_manage_my_avatar_object%'
  ) then
    raise exception 'F05 self-only avatar UPDATE policy is missing or unsafe';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_policies as p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname ~ '^rb_avatars_'
  ) <> 3 then
    raise exception 'F05 avatar policy scope is not exactly three policies';
  end if;

  foreach target_role in array array['anon', 'authenticated'] loop
    select r.oid
      into target_role_oid
    from pg_catalog.pg_roles as r
    where r.rolname = target_role;

    if target_role_oid is null then
      raise exception 'Required Supabase role is missing: %', target_role;
    end if;

    if has_table_privilege(target_role_oid, employee_table_oid, 'SELECT')
      or has_table_privilege(target_role_oid, employee_table_oid, 'INSERT')
      or has_table_privilege(target_role_oid, employee_table_oid, 'UPDATE')
      or has_table_privilege(target_role_oid, employee_table_oid, 'DELETE')
      or has_table_privilege(target_role_oid, employee_table_oid, 'TRUNCATE')
      or has_table_privilege(target_role_oid, employee_table_oid, 'REFERENCES')
      or has_table_privilege(target_role_oid, employee_table_oid, 'TRIGGER') then
      raise exception 'F05 employees table remains accessible to role %', target_role;
    end if;

    if has_any_column_privilege(target_role_oid, employee_table_oid, 'SELECT')
      or has_any_column_privilege(target_role_oid, employee_table_oid, 'INSERT')
      or has_any_column_privilege(target_role_oid, employee_table_oid, 'UPDATE')
      or has_any_column_privilege(target_role_oid, employee_table_oid, 'REFERENCES') then
      raise exception 'F05 employees table has a client column grant for role %', target_role;
    end if;
  end loop;

  if not has_table_privilege('service_role', employee_table_oid, 'SELECT')
    or not has_table_privilege('service_role', employee_table_oid, 'INSERT')
    or not has_table_privilege('service_role', employee_table_oid, 'UPDATE')
    or not has_table_privilege('service_role', employee_table_oid, 'DELETE') then
    raise exception 'F05 server-side employees compatibility privileges are missing';
  end if;

  foreach target_signature in array projection_signatures loop
    target_function_oid := to_regprocedure(target_signature)::oid;
    if target_function_oid is null then
      raise exception 'F05 projection function is missing: %', target_signature;
    end if;

    select
      pg_catalog.array_agg(args.arg_name order by args.ordinality),
      pg_catalog.array_agg(pg_catalog.format_type(args.arg_type, null) order by args.ordinality)
      into actual_output_names, actual_output_types
    from pg_catalog.pg_proc as p
    cross join lateral pg_catalog.unnest(
      p.proallargtypes,
      p.proargmodes,
      p.proargnames
    ) with ordinality as args(arg_type, arg_mode, arg_name, ordinality)
    where p.oid = target_function_oid
      and args.arg_mode = 't';

    if actual_output_names is distinct from expected_output_names
      or actual_output_types is distinct from expected_output_types then
      raise exception
        'F05 unsafe projection contract for %: names %, types %',
        target_signature,
        actual_output_names,
        actual_output_types;
    end if;
  end loop;

  foreach target_signature in array hardened_helper_signatures loop
    target_function_oid := to_regprocedure(target_signature)::oid;
    if target_function_oid is null then
      raise exception 'F05 hardened function is missing: %', target_signature;
    end if;

    if not (
      select p.prosecdef
      from pg_catalog.pg_proc as p
      where p.oid = target_function_oid
    ) then
      raise exception 'F05 function is not SECURITY DEFINER: %', target_signature;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc as p
      cross join lateral pg_catalog.unnest(
        coalesce(p.proconfig, array[]::text[])
      ) as config(setting)
      where p.oid = target_function_oid
        and config.setting = 'search_path=pg_catalog, public'
    ) then
      raise exception 'F05 function has an unsafe search_path: %', target_signature;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc as p
      cross join lateral pg_catalog.unnest(
        coalesce(p.proconfig, array[]::text[])
      ) as config(setting)
      where p.oid = target_function_oid
        and config.setting = 'row_security=off'
    ) then
      raise exception 'F05 function does not pin row_security off: %', target_signature;
    end if;

    if has_function_privilege('anon', target_function_oid, 'EXECUTE') then
      raise exception 'F05 function remains executable by anon: %', target_signature;
    end if;

    if not has_function_privilege('authenticated', target_function_oid, 'EXECUTE') then
      raise exception 'F05 function is not executable by authenticated: %', target_signature;
    end if;

    if not has_function_privilege('service_role', target_function_oid, 'EXECUTE') then
      raise exception 'F05 function is not executable by service_role: %', target_signature;
    end if;
  end loop;

  if pg_catalog.pg_get_functiondef(to_regprocedure('public.current_employee()'))
      ~* 'select[[:space:]]+e\.\*' then
    raise exception 'F05 current_employee still selects the whole employees row';
  end if;

  raise notice 'F05 employee client-boundary catalog assertions passed';
end
$assert$;

rollback;
