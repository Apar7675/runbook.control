-- Run only after all migrations in an empty/disposable Supabase database.
-- Metadata only: this read-only transaction never selects application rows.
-- Example: psql "$RUNBOOK_DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1
--   -f supabase/tests/f06_messaging_boundary_catalog.sql

begin transaction read only;

do $assert$
declare
  messaging_tables constant text[] := array[
    'conversation_archives',
    'conversation_members',
    'conversations',
    'message_reactions',
    'message_reads',
    'messages',
    'messaging_roster'
  ];
  expected_policies constant text[] := array[
    'rb_messaging_conversation_archives_select_actor',
    'rb_messaging_conversation_archives_delete_actor_compat',
    'rb_messaging_conversation_members_select_member',
    'rb_messaging_conversations_select_member',
    'rb_messaging_message_reactions_select_member',
    'rb_messaging_message_reads_select_actor',
    'rb_messaging_messages_select_member',
    'rb_messaging_messages_insert_actor_compat',
    'rb_messaging_roster_select_active_actor_shop'
  ];
  private_helpers constant text[] := array[
    'public.rb_sync_employee_messaging_roster()',
    'public.rb_messaging_shop_has_full_remote_access(uuid)',
    'public.rb_messaging_require_actor_employee_id(uuid)'
  ];
  entrypoints constant text[] := array[
    'public.rb_messaging_actor_employee_id(uuid)',
    'public.rb_messaging_assert_actor_employee_id(uuid,uuid)',
    'public.rb_messaging_can_read_conversation(uuid,uuid)',
    'public.rb_messaging_can_read_message(uuid,uuid,uuid)',
    'public.rb_messaging_roster(uuid)',
    'public.rb_messaging_find_dm(uuid,uuid)',
    'public.rb_messaging_get_or_create_dm(uuid,uuid)',
    'public.rb_messaging_create_conversation(uuid,text,text,uuid[])',
    'public.rb_messaging_list_messages(uuid,uuid,integer)',
    'public.rb_messaging_send_message(uuid,uuid,text)',
    'public.rb_messaging_send_dm(uuid,uuid,text)',
    'public.rb_messaging_conversation_header(uuid,uuid)',
    'public.rb_messaging_inbox(uuid)',
    'public.rb_messaging_archived_inbox(uuid)',
    'public.rb_messaging_dm_summary(uuid)',
    'public.rb_messaging_mark_read(uuid,uuid)',
    'public.rb_messaging_archive_for_me(uuid,uuid)',
    'public.rb_messaging_unarchive_for_me(uuid,uuid)',
    'public.rb_messaging_reaction_summary(uuid,uuid)',
    'public.rb_messaging_toggle_reaction(uuid,uuid,uuid,text)'
  ];
  compatibility constant text[] := array[
    'public.get_inbox(uuid)',
    'public.get_conversation_header(uuid,uuid)',
    'public.get_archived_inbox(uuid)',
    'public.archive_conversation_for_me(uuid,uuid)',
    'public.create_conversation(uuid,text,text,uuid[])',
    'public.get_or_create_dm(uuid,uuid,uuid)',
    'public.get_or_create_dm(uuid,uuid)',
    'public.mark_conversation_read_now(uuid)',
    'public.mark_conversation_read_now(uuid,uuid)',
    'public.get_reaction_summary_for_conversation(uuid,uuid)',
    'public.toggle_my_message_reaction(uuid,uuid,uuid,text)'
  ];
  retired_absent_or_no_execute constant text[] := array[
    'public.archive_conversation(uuid,uuid)',
    'public.create_conversation_with_members(uuid,text,text,uuid[])',
    'public.get_conversation_titles(uuid)',
    'public.get_unread_counts(uuid)',
    'public.rename_group_conversation(uuid,uuid,text)',
    'public.my_roster_active(uuid)',
    'public.rb_is_active_in_messaging(uuid)',
    'public.rb_is_conversation_member(uuid,uuid)',
    'public.rb_me_roster_active(uuid)',
    'public.bump_conversation_updated_at()',
    'public.conversations_title_check()'
  ];
  table_name text;
  column_name text;
  policy_name text;
  signature text;
  table_oid oid;
  function_oid oid;
  expected boolean;
  expected_command text;
begin
  foreach table_name in array messaging_tables loop
    table_oid := pg_catalog.to_regclass('public.' || table_name);
    if table_oid is null then
      raise exception 'F06 messaging table is missing: %', table_name;
    end if;

    if not (
      select class.relrowsecurity
      from pg_catalog.pg_class as class
      where class.oid = table_oid
    ) then
      raise exception 'F06 RLS is disabled: %', table_name;
    end if;

    if pg_catalog.has_table_privilege('anon', table_oid, 'SELECT')
       or pg_catalog.has_table_privilege('anon', table_oid, 'INSERT')
       or pg_catalog.has_table_privilege('anon', table_oid, 'UPDATE')
       or pg_catalog.has_table_privilege('anon', table_oid, 'DELETE')
       or pg_catalog.has_any_column_privilege('anon', table_oid, 'SELECT')
       or pg_catalog.has_any_column_privilege('anon', table_oid, 'INSERT')
       or pg_catalog.has_any_column_privilege('anon', table_oid, 'UPDATE')
       or pg_catalog.has_any_column_privilege('anon', table_oid, 'REFERENCES') then
      raise exception 'F06 anon retains a messaging table/column privilege: %', table_name;
    end if;

    expected := table_name in ('messages', 'message_reactions');
    if pg_catalog.has_table_privilege('authenticated', table_oid, 'SELECT') is distinct from expected then
      raise exception 'F06 authenticated table SELECT shape is wrong: %', table_name;
    end if;

    expected := table_name = 'conversation_archives';
    if pg_catalog.has_table_privilege('authenticated', table_oid, 'DELETE') is distinct from expected then
      raise exception 'F06 authenticated table DELETE shape is wrong: %', table_name;
    end if;

    if pg_catalog.has_table_privilege('authenticated', table_oid, 'INSERT')
       or pg_catalog.has_table_privilege('authenticated', table_oid, 'UPDATE')
       or pg_catalog.has_table_privilege('authenticated', table_oid, 'TRUNCATE')
       or pg_catalog.has_table_privilege('authenticated', table_oid, 'REFERENCES')
       or pg_catalog.has_table_privilege('authenticated', table_oid, 'TRIGGER') then
      raise exception 'F06 authenticated retains a broad messaging privilege: %', table_name;
    end if;

    if not pg_catalog.has_table_privilege('service_role', table_oid, 'SELECT')
       or not pg_catalog.has_table_privilege('service_role', table_oid, 'INSERT')
       or not pg_catalog.has_table_privilege('service_role', table_oid, 'UPDATE')
       or not pg_catalog.has_table_privilege('service_role', table_oid, 'DELETE') then
      raise exception 'F06 service_role lost required messaging table authority: %', table_name;
    end if;

    for column_name in
      select attribute.attname
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid = table_oid
        and attribute.attnum > 0
        and not attribute.attisdropped
      order by attribute.attnum
    loop
      expected := table_name = 'messages'
        and column_name in ('shop_id', 'conversation_id', 'sender_employee_id', 'body');
      if pg_catalog.has_column_privilege('authenticated', table_oid, column_name, 'INSERT') is distinct from expected then
        raise exception 'F06 authenticated INSERT column shape is wrong: %.%', table_name, column_name;
      end if;

      expected := table_name in ('messages', 'message_reactions')
        or (
          table_name = 'conversation_archives'
          and column_name in ('shop_id', 'conversation_id', 'employee_id')
        );
      if pg_catalog.has_column_privilege('authenticated', table_oid, column_name, 'SELECT') is distinct from expected then
        raise exception 'F06 authenticated SELECT column shape is wrong: %.%', table_name, column_name;
      end if;

      if pg_catalog.has_column_privilege('authenticated', table_oid, column_name, 'UPDATE')
         or pg_catalog.has_column_privilege('authenticated', table_oid, column_name, 'REFERENCES') then
        raise exception 'F06 authenticated retained an unexpected column privilege: %.%', table_name, column_name;
      end if;
    end loop;
  end loop;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = any(messaging_tables)
  ) <> pg_catalog.cardinality(expected_policies) then
    raise exception 'F06 messaging policy count is not exact';
  end if;

  foreach policy_name in array expected_policies loop
    expected_command := case
      when policy_name = 'rb_messaging_messages_insert_actor_compat' then 'INSERT'
      when policy_name = 'rb_messaging_conversation_archives_delete_actor_compat' then 'DELETE'
      else 'SELECT'
    end;

    if not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = any(messaging_tables)
        and policy.policyname = policy_name
        and policy.cmd = expected_command
        and policy.permissive = 'PERMISSIVE'
        and policy.roles = array['authenticated']::name[]
    ) then
      raise exception 'F06 policy definition is missing or wrong: %', policy_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = any(messaging_tables)
      and not (policy.policyname = any(expected_policies))
  ) then
    raise exception 'F06 an unexpected messaging policy remains';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'messages'
      and policy.policyname = 'rb_messaging_messages_insert_actor_compat'
      and policy.with_check like '%rb_messaging_actor_employee_id%'
      and policy.with_check like '%rb_messaging_can_read_conversation%'
  ) then
    raise exception 'F06 expand INSERT policy is not sender/member bound';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'conversation_archives'
      and policy.policyname = 'rb_messaging_conversation_archives_delete_actor_compat'
      and policy.qual like '%rb_messaging_actor_employee_id%'
      and policy.qual like '%rb_messaging_can_read_conversation%'
  ) then
    raise exception 'F06 expand archive DELETE policy is not actor/member bound';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_proc as proc on proc.oid = trigger.tgfoid
    join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
    where trigger.tgrelid = 'public.messages'::regclass
      and not trigger.tgisinternal
      and trigger.tgenabled <> 'D'
      and namespace.nspname = 'public'
      and proc.proname = 'rb_touch_conversation_updated_at'
  ) <> 1 then
    raise exception 'F06 expected exactly one active message timestamp trigger';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_proc as proc on proc.oid = trigger.tgfoid
    join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
    where trigger.tgrelid = 'public.employees'::regclass
      and not trigger.tgisinternal
      and trigger.tgenabled <> 'D'
      and namespace.nspname = 'public'
      and proc.proname = 'rb_sync_employee_messaging_roster'
  ) <> 1 then
    raise exception 'F06 expected exactly one active employee roster projection trigger';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = 'public.messages'::regclass
      and not trigger.tgisinternal
      and trigger.tgname = 'trg_bump_conversation_updated_at'
  ) then
    raise exception 'F06 duplicate legacy message timestamp trigger remains installed';
  end if;

  foreach signature in array private_helpers loop
    function_oid := pg_catalog.to_regprocedure(signature);
    if function_oid is null then
      raise exception 'F06 private helper is missing: %', signature;
    end if;
    if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE') then
      raise exception 'F06 private helper is client-callable: %', signature;
    end if;
    expected := signature <> 'public.rb_sync_employee_messaging_roster()';
    if pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE') is distinct from expected then
      raise exception 'F06 private helper service_role ACL is wrong: %', signature;
    end if;
  end loop;

  foreach signature in array entrypoints loop
    function_oid := pg_catalog.to_regprocedure(signature);
    if function_oid is null then
      raise exception 'F06 entrypoint is missing: %', signature;
    end if;

    if not (
      select proc.prosecdef
      from pg_catalog.pg_proc as proc
      where proc.oid = function_oid
    ) then
      raise exception 'F06 entrypoint is not SECURITY DEFINER: %', signature;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc as proc,
           pg_catalog.unnest(coalesce(proc.proconfig, array[]::text[])) as setting(value)
      where proc.oid = function_oid
        and setting.value = 'search_path=pg_catalog, public'
    ) or not exists (
      select 1
      from pg_catalog.pg_proc as proc,
           pg_catalog.unnest(coalesce(proc.proconfig, array[]::text[])) as setting(value)
      where proc.oid = function_oid
        and setting.value = 'row_security=off'
    ) then
      raise exception 'F06 entrypoint runtime settings are not pinned: %', signature;
    end if;

    if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
       or not pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
       or not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE') then
      raise exception 'F06 entrypoint ACL is wrong: %', signature;
    end if;
  end loop;

  foreach signature in array compatibility loop
    function_oid := pg_catalog.to_regprocedure(signature);
    if function_oid is null then
      raise exception 'F06 expand compatibility signature is missing: %', signature;
    end if;
    if not (
      select proc.prosecdef
      from pg_catalog.pg_proc as proc
      where proc.oid = function_oid
    ) then
      raise exception 'F06 compatibility wrapper is not SECURITY DEFINER: %', signature;
    end if;
    if not exists (
      select 1
      from pg_catalog.pg_proc as proc,
           pg_catalog.unnest(coalesce(proc.proconfig, array[]::text[])) as setting(value)
      where proc.oid = function_oid
        and setting.value = 'search_path=pg_catalog, public'
    ) or not exists (
      select 1
      from pg_catalog.pg_proc as proc,
           pg_catalog.unnest(coalesce(proc.proconfig, array[]::text[])) as setting(value)
      where proc.oid = function_oid
        and setting.value = 'row_security=off'
    ) then
      raise exception 'F06 compatibility wrapper runtime settings are not pinned: %', signature;
    end if;
    if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
       or not pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE') then
      raise exception 'F06 compatibility ACL is wrong: %', signature;
    end if;
  end loop;

  foreach signature in array retired_absent_or_no_execute loop
    function_oid := pg_catalog.to_regprocedure(signature);
    if function_oid is not null and (
      pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
    ) then
      raise exception 'F06 retired function exists with EXECUTE privilege: %', signature;
    end if;
  end loop;

  if pg_catalog.pg_get_function_arguments(
    pg_catalog.to_regprocedure('public.rb_messaging_send_message(uuid,uuid,text)')
  ) like '%sender%'
     or pg_catalog.pg_get_function_arguments(
       pg_catalog.to_regprocedure('public.rb_messaging_send_dm(uuid,uuid,text)')
     ) like '%sender%' then
    raise exception 'F06 a hardened send entrypoint accepts a sender identity';
  end if;

  raise notice 'F06 messaging catalog assertions passed';
end
$assert$;

rollback;
