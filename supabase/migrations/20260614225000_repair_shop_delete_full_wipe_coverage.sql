create or replace function public.rb_delete_rows_by_uuid(
  p_table_name text,
  p_column_name text,
  p_value uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_table regclass;
  v_deleted integer := 0;
begin
  if p_value is null then
    return 0;
  end if;

  v_table := to_regclass(format('public.%I', p_table_name));
  if v_table is null then
    return 0;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table_name
      and column_name = p_column_name
  ) then
    return 0;
  end if;

  execute format('delete from %s where %I = $1', v_table, p_column_name)
  using p_value;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

create or replace function public.rb_delete_rows_by_text(
  p_table_name text,
  p_column_name text,
  p_value text
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_table regclass;
  v_deleted integer := 0;
begin
  if coalesce(p_value, '') = '' then
    return 0;
  end if;

  v_table := to_regclass(format('public.%I', p_table_name));
  if v_table is null then
    return 0;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table_name
      and column_name = p_column_name
  ) then
    return 0;
  end if;

  execute format('delete from %s where %I = $1', v_table, p_column_name)
  using p_value;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

create or replace function public.rb_delete_shop_business_data(
  p_shop_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_counts jsonb := '{}'::jsonb;
  v_deleted integer := 0;
begin
  if p_shop_id is null then
    raise exception 'missing shop id';
  end if;

  v_deleted := public.rb_delete_rows_by_uuid('message_reactions', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('message_reactions', v_deleted);

  if to_regclass('public.message_reads') is not null then
    delete from public.message_reads
    where conversation_id in (
        select c.id
        from public.conversations c
        where c.shop_id = p_shop_id
      )
      or employee_id in (
        select e.id
        from public.employees e
        where e.shop_id = p_shop_id
      );
    get diagnostics v_deleted = row_count;
    v_counts := v_counts || jsonb_build_object('message_reads', v_deleted);
  end if;

  v_deleted := public.rb_delete_rows_by_uuid('conversation_archives', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('conversation_archives', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('conversation_members', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('conversation_members', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('messages', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('messages', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('conversations', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('conversations', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('messaging_roster', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('messaging_roster', v_deleted);

  v_deleted := public.rb_delete_rows_by_uuid('time_events', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('time_events', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('time_off_requests', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('time_off_requests', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('employee_roles', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('employee_roles', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('holiday_calendar', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('holiday_calendar', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('time_off_balances', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('time_off_balances', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('time_off_policy', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('time_off_policy', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('timeclock_settings', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('timeclock_settings', v_deleted);

  v_deleted := public.rb_delete_rows_by_uuid('push_tokens', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('push_tokens', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('chat_blocks', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('chat_blocks', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('chat_threads', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('chat_threads', v_deleted);

  v_deleted := public.rb_delete_rows_by_uuid('rb_mobile_inspection_report_references', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('mobile_inspection_report_references', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_device_readiness_reports', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('device_readiness_reports', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_device_software_status', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('device_software_status', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_software_update_events', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('software_update_events', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_software_rollouts', 'target_shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('software_rollouts', v_deleted);

  v_deleted := public.rb_delete_rows_by_text('purchase_orders', 'shop_id', p_shop_id::text);
  v_counts := v_counts || jsonb_build_object('purchase_orders', v_deleted);
  v_deleted := public.rb_delete_rows_by_text('components', 'shop_id', p_shop_id::text);
  v_counts := v_counts || jsonb_build_object('components', v_deleted);

  v_deleted := public.rb_delete_rows_by_uuid('shop_members', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('shop_members', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_support_bundles', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('support_bundles', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_update_policy', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('update_policy', v_deleted);

  return jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'deleted', v_counts
  );
end;
$function$;

create or replace function public.rb_delete_shop_core_data(
  p_shop_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_counts jsonb := '{}'::jsonb;
  v_deleted integer := 0;
begin
  if p_shop_id is null then
    raise exception 'missing shop id';
  end if;

  if to_regclass('public.rb_device_tokens') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'rb_device_tokens'
        and column_name = 'shop_id'
    ) then
      execute $sql$
        delete from public.rb_device_tokens
        where shop_id = $1
           or device_id in (
             select d.id
             from public.rb_devices d
             where d.shop_id = $1
           )
      $sql$
      using p_shop_id;
    else
      execute $sql$
        delete from public.rb_device_tokens
        where device_id in (
          select d.id
          from public.rb_devices d
          where d.shop_id = $1
        )
      $sql$
      using p_shop_id;
    end if;
    get diagnostics v_deleted = row_count;
    v_counts := v_counts || jsonb_build_object('device_tokens', v_deleted);
  end if;

  v_deleted := public.rb_delete_rows_by_uuid('rb_device_activation_tokens', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('device_activation_tokens', v_deleted);

  if to_regclass('public.rb_onboarding_codes') is not null
     and to_regclass('public.rb_onboarding_state') is not null then
    delete from public.rb_onboarding_codes
    where user_id in (
      select s.user_id
      from public.rb_onboarding_state s
      where s.shop_id = p_shop_id
    );
    get diagnostics v_deleted = row_count;
    v_counts := v_counts || jsonb_build_object('onboarding_codes', v_deleted);
  end if;

  v_deleted := public.rb_delete_rows_by_uuid('rb_onboarding_state', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('onboarding_state', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('employees', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('employees', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_shop_members', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('shop_members', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_devices', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('devices', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_audit', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('audit', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_audit_log', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('audit_log', v_deleted);
  v_deleted := public.rb_delete_rows_by_uuid('rb_remote_cleanup_commands', 'shop_id', p_shop_id);
  v_counts := v_counts || jsonb_build_object('remote_cleanup_commands', v_deleted);

  delete from public.rb_shops
  where id = p_shop_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('shops', v_deleted);

  return jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'deleted', v_counts
  );
end;
$function$;

revoke all on function public.rb_delete_rows_by_uuid(text, text, uuid) from public;
revoke all on function public.rb_delete_rows_by_uuid(text, text, uuid) from anon;
revoke all on function public.rb_delete_rows_by_uuid(text, text, uuid) from authenticated;
grant execute on function public.rb_delete_rows_by_uuid(text, text, uuid) to service_role;

revoke all on function public.rb_delete_rows_by_text(text, text, text) from public;
revoke all on function public.rb_delete_rows_by_text(text, text, text) from anon;
revoke all on function public.rb_delete_rows_by_text(text, text, text) from authenticated;
grant execute on function public.rb_delete_rows_by_text(text, text, text) to service_role;

revoke all on function public.rb_delete_shop_business_data(uuid) from public;
revoke all on function public.rb_delete_shop_business_data(uuid) from anon;
revoke all on function public.rb_delete_shop_business_data(uuid) from authenticated;
grant execute on function public.rb_delete_shop_business_data(uuid) to service_role;

revoke all on function public.rb_delete_shop_core_data(uuid) from public;
revoke all on function public.rb_delete_shop_core_data(uuid) from anon;
revoke all on function public.rb_delete_shop_core_data(uuid) from authenticated;
grant execute on function public.rb_delete_shop_core_data(uuid) to service_role;

notify pgrst, 'reload schema';
