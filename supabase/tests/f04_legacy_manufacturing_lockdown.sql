-- Run after all migrations in a disposable PostgreSQL/Supabase database.
-- This test reads catalog metadata only and always rolls back.
-- Example: psql "$RUNBOOK_DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1
--   -f supabase/tests/f04_legacy_manufacturing_lockdown.sql

begin transaction read only;

do $assert$
declare
  expected_tables constant text[] := array[
    'public.attachments',
    'public.balloon_sets',
    'public.component_aliases',
    'public.component_files',
    'public.components',
    'public.daily_logs',
    'public.inspection_sets',
    'public.jobs',
    'public.op_sessions',
    'public.operations',
    'public.operators',
    'public.po_line_items',
    'public.purchase_orders',
    'public.routing_operations',
    'public.tenants',
    'public.travelers'
  ];
  expected_table text;
  expected_role text;
  target_oid oid;
  target_role_oid oid;
  distinct_table_count integer;
begin
  if cardinality(expected_tables) <> 16 then
    raise exception 'F04 assertion definition must contain exactly 16 tables';
  end if;

  select count(distinct item)
    into distinct_table_count
  from unnest(expected_tables) as target(item);

  if distinct_table_count <> cardinality(expected_tables) then
    raise exception 'F04 assertion definition contains duplicate tables';
  end if;

  foreach expected_table in array expected_tables loop
    select c.oid
      into target_oid
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = split_part(expected_table, '.', 1)
      and c.relname = split_part(expected_table, '.', 2)
      and c.relkind in ('r', 'p');

    if target_oid is null then
      raise exception 'F04 target table is missing: %', expected_table;
    end if;

    if not (
      select c.relrowsecurity
      from pg_catalog.pg_class c
      where c.oid = target_oid
    ) then
      raise exception 'F04 target table does not have RLS enabled: %', expected_table;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_policies p
      where p.schemaname = split_part(expected_table, '.', 1)
        and p.tablename = split_part(expected_table, '.', 2)
    ) then
      raise exception 'F04 target table unexpectedly has an RLS policy: %', expected_table;
    end if;

    foreach expected_role in array array['anon', 'authenticated'] loop
      select r.oid
        into target_role_oid
      from pg_catalog.pg_roles r
      where r.rolname = expected_role;

      if target_role_oid is null then
        raise exception 'Required Supabase role is missing: %', expected_role;
      end if;

      if has_table_privilege(target_role_oid, target_oid, 'SELECT')
        or has_table_privilege(target_role_oid, target_oid, 'INSERT')
        or has_table_privilege(target_role_oid, target_oid, 'UPDATE')
        or has_table_privilege(target_role_oid, target_oid, 'DELETE')
        or has_table_privilege(target_role_oid, target_oid, 'TRUNCATE')
        or has_table_privilege(target_role_oid, target_oid, 'REFERENCES')
        or has_table_privilege(target_role_oid, target_oid, 'TRIGGER')
        or has_table_privilege(target_role_oid, target_oid, 'MAINTAIN') then
        raise exception 'F04 target table remains accessible to role %: %', expected_role, expected_table;
      end if;

      if has_any_column_privilege(target_role_oid, target_oid, 'SELECT')
        or has_any_column_privilege(target_role_oid, target_oid, 'INSERT')
        or has_any_column_privilege(target_role_oid, target_oid, 'UPDATE')
        or has_any_column_privilege(target_role_oid, target_oid, 'REFERENCES') then
        raise exception 'F04 target table has a client column grant for role %: %', expected_role, expected_table;
      end if;
    end loop;
  end loop;

  raise notice 'F04 lockdown assertions passed for all 16 legacy manufacturing tables';
end
$assert$;

rollback;
