alter table public.rb_delete_operations
  drop constraint if exists rb_delete_operations_status_check;

alter table public.rb_delete_operations
  add constraint rb_delete_operations_status_check
  check (status in ('pending', 'running', 'failed', 'partial_failed', 'completed'));

alter table public.rb_shops
  add column if not exists deletion_status text not null default 'active',
  add column if not exists deletion_started_at timestamptz,
  add column if not exists deletion_operation_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_shops_deletion_status_check'
      and conrelid = 'public.rb_shops'::regclass
  ) then
    alter table public.rb_shops
      add constraint rb_shops_deletion_status_check
      check (deletion_status in ('active', 'deleting'));
  end if;
end $$;

create index if not exists rb_shops_deletion_status_idx
  on public.rb_shops (deletion_status);

create or replace function public.rb_delete_shop_business_data(
  p_shop_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_components_deleted integer := 0;
  v_purchase_orders_deleted integer := 0;
begin
  if p_shop_id is null then
    raise exception 'missing shop id';
  end if;

  delete from public.message_reactions
  where shop_id = p_shop_id;

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

  delete from public.conversation_archives
  where shop_id = p_shop_id;

  delete from public.conversation_members
  where shop_id = p_shop_id
     or employee_id in (
       select e.id
       from public.employees e
       where e.shop_id = p_shop_id
     );

  delete from public.messages
  where shop_id = p_shop_id;

  delete from public.conversations
  where shop_id = p_shop_id;

  delete from public.messaging_roster
  where shop_id = p_shop_id;

  delete from public.time_events
  where shop_id = p_shop_id;

  delete from public.time_off_requests
  where shop_id = p_shop_id;

  delete from public.employee_roles
  where shop_id = p_shop_id;

  delete from public.holiday_calendar
  where shop_id = p_shop_id;

  delete from public.time_off_balances
  where shop_id = p_shop_id;

  delete from public.time_off_policy
  where shop_id = p_shop_id;

  delete from public.timeclock_settings
  where shop_id = p_shop_id;

  delete from public.push_tokens
  where shop_id = p_shop_id;

  delete from public.chat_blocks
  where shop_id = p_shop_id;

  delete from public.chat_threads
  where shop_id = p_shop_id;

  delete from public.purchase_orders
  where shop_id = p_shop_id::text;
  get diagnostics v_purchase_orders_deleted = row_count;

  delete from public.components
  where shop_id = p_shop_id::text;
  get diagnostics v_components_deleted = row_count;

  delete from public.shop_members
  where shop_id = p_shop_id;

  delete from public.rb_support_bundles
  where shop_id = p_shop_id;

  delete from public.rb_update_policy
  where shop_id = p_shop_id;

  return jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'components_deleted', v_components_deleted,
    'purchase_orders_deleted', v_purchase_orders_deleted
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
begin
  if p_shop_id is null then
    raise exception 'missing shop id';
  end if;

  if to_regclass('public.rb_device_tokens') is not null then
    delete from public.rb_device_tokens
    where device_id in (
      select d.id
      from public.rb_devices d
      where d.shop_id = p_shop_id
    );
  end if;

  if to_regclass('public.rb_device_activation_tokens') is not null then
    delete from public.rb_device_activation_tokens
    where shop_id = p_shop_id
       or device_id in (
         select d.id
         from public.rb_devices d
         where d.shop_id = p_shop_id
       );
  end if;

  if to_regclass('public.rb_onboarding_codes') is not null
     and to_regclass('public.rb_onboarding_state') is not null then
    delete from public.rb_onboarding_codes
    where user_id in (
      select s.user_id
      from public.rb_onboarding_state s
      where s.shop_id = p_shop_id
    );
  end if;

  if to_regclass('public.rb_onboarding_state') is not null then
    delete from public.rb_onboarding_state
    where shop_id = p_shop_id;
  end if;

  delete from public.employees
  where shop_id = p_shop_id;

  delete from public.rb_shop_members
  where shop_id = p_shop_id;

  delete from public.rb_devices
  where shop_id = p_shop_id;

  delete from public.rb_shops
  where id = p_shop_id;

  return jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id
  );
end;
$function$;

revoke all on function public.rb_delete_shop_business_data(uuid) from public;
revoke all on function public.rb_delete_shop_business_data(uuid) from anon;
revoke all on function public.rb_delete_shop_business_data(uuid) from authenticated;
grant execute on function public.rb_delete_shop_business_data(uuid) to service_role;

revoke all on function public.rb_delete_shop_core_data(uuid) from public;
revoke all on function public.rb_delete_shop_core_data(uuid) from anon;
revoke all on function public.rb_delete_shop_core_data(uuid) from authenticated;
grant execute on function public.rb_delete_shop_core_data(uuid) to service_role;
