alter table public.rb_shop_members
  add column if not exists is_active boolean not null default true;

create index if not exists rb_shop_members_shop_user_active_idx
  on public.rb_shop_members (shop_id, user_id, is_active);

create or replace function public.rb_disable_employee_authoritative(
  p_shop_id uuid,
  p_employee_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_shop_name text;
  v_employee record;
  v_membership_role text;
  v_active_admin_count integer;
begin
  if p_shop_id is null then
    raise exception 'missing shop id';
  end if;

  if p_employee_id is null then
    raise exception 'missing employee id';
  end if;

  if p_actor_user_id is null then
    raise exception 'missing actor user id';
  end if;

  select name into v_shop_name
  from public.rb_shops
  where id = p_shop_id;

  if v_shop_name is null then
    raise exception 'shop not found';
  end if;

  select *
  into v_employee
  from public.employees
  where id = p_employee_id
    and shop_id = p_shop_id;

  if v_employee.id is null then
    raise exception 'employee not found';
  end if;

  if v_employee.auth_user_id is not null then
    select role
    into v_membership_role
    from public.rb_shop_members
    where shop_id = p_shop_id
      and user_id = v_employee.auth_user_id;

    if coalesce(v_membership_role, '') in ('owner', 'admin') then
      select count(*)
      into v_active_admin_count
      from public.rb_shop_members
      where shop_id = p_shop_id
        and is_active = true
        and role in ('owner', 'admin')
        and user_id <> v_employee.auth_user_id;

      if v_active_admin_count <= 0 then
        raise exception 'cannot disable the last active owner/admin-backed employee from the shop';
      end if;
    end if;
  end if;

  update public.employees
  set status = 'Inactive',
      is_active = false,
      runbook_access_enabled = false,
      mobile_access_enabled = false,
      workstation_access_enabled = false
  where id = p_employee_id
    and shop_id = p_shop_id;

  if v_employee.auth_user_id is not null then
    update public.rb_shop_members
    set is_active = false
    where shop_id = p_shop_id
      and user_id = v_employee.auth_user_id;
  end if;

  insert into public.rb_audit_log (
    actor_user_id,
    actor_kind,
    action,
    target_type,
    target_id,
    shop_id,
    meta
  )
  values (
    p_actor_user_id,
    'user',
    'employee.disabled',
    'employee',
    p_employee_id::text,
    p_shop_id,
    jsonb_build_object(
      'employee_code', v_employee.employee_code,
      'display_name', v_employee.display_name,
      'authority', 'control',
      'delete_model', 'soft_disable',
      'membership_deactivated', v_employee.auth_user_id is not null
    )
  );

  if v_employee.auth_user_id is not null then
    perform public.rb_issue_remote_cleanup_command(
      'desktop',
      'revoke_shop_access',
      'employee_disabled',
      p_shop_id,
      v_shop_name,
      v_employee.auth_user_id,
      p_employee_id,
      null,
      jsonb_build_object('scope', 'employee', 'authority', 'control', 'delete_model', 'soft_disable')
    );

    perform public.rb_issue_remote_cleanup_command(
      'mobile',
      'revoke_shop_access',
      'employee_disabled',
      p_shop_id,
      v_shop_name,
      v_employee.auth_user_id,
      p_employee_id,
      null,
      jsonb_build_object('scope', 'employee', 'authority', 'control', 'delete_model', 'soft_disable')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'employee_id', p_employee_id,
    'display_name', v_employee.display_name,
    'employee_code', v_employee.employee_code,
    'status', 'Inactive',
    'history_preserved', true
  );
end;
$function$;

create or replace function public.rb_remove_employee_authoritative(
  p_shop_id uuid,
  p_employee_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
begin
  return public.rb_disable_employee_authoritative(
    p_shop_id,
    p_employee_id,
    p_actor_user_id
  );
end;
$function$;

revoke all on function public.rb_disable_employee_authoritative(uuid, uuid, uuid) from public;
revoke all on function public.rb_disable_employee_authoritative(uuid, uuid, uuid) from anon;
revoke all on function public.rb_disable_employee_authoritative(uuid, uuid, uuid) from authenticated;
grant execute on function public.rb_disable_employee_authoritative(uuid, uuid, uuid) to service_role;

revoke all on function public.rb_remove_employee_authoritative(uuid, uuid, uuid) from public;
revoke all on function public.rb_remove_employee_authoritative(uuid, uuid, uuid) from anon;
revoke all on function public.rb_remove_employee_authoritative(uuid, uuid, uuid) from authenticated;
grant execute on function public.rb_remove_employee_authoritative(uuid, uuid, uuid) to service_role;
