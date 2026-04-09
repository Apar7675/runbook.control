create or replace function public.rb_delete_shop_authoritative(
  p_shop_id uuid,
  p_confirm_name text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_name text;
  v_member_user_id uuid;
  v_employee_id uuid;
  v_employee_auth_user_id uuid;
  v_device_id uuid;
  v_device_type text;
begin
  if p_shop_id is null then
    raise exception 'missing shop id';
  end if;

  if p_actor_user_id is null then
    raise exception 'missing actor user id';
  end if;

  select name into v_name
  from public.rb_shops
  where id = p_shop_id;

  if v_name is null then
    raise exception 'shop not found';
  end if;

  if coalesce(p_confirm_name, '') <> v_name then
    raise exception 'confirmation name did not match';
  end if;

  insert into public.rb_audit (
    shop_id,
    actor_user_id,
    actor_kind,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    p_shop_id,
    p_actor_user_id,
    'user',
    'shop.deleted',
    'shop',
    p_shop_id,
    jsonb_build_object(
      'name', v_name,
      'authority', 'control',
      'cleanup_model', 'authoritative_remote_cleanup'
    )
  );

  for v_member_user_id in
    select distinct m.user_id
    from public.rb_shop_members m
    where m.shop_id = p_shop_id
      and m.user_id is not null
  loop
    perform public.rb_issue_remote_cleanup_command(
      'desktop',
      'purge_shop_data',
      'shop_deleted',
      p_shop_id,
      v_name,
      v_member_user_id,
      null,
      null,
      jsonb_build_object('scope', 'shop', 'authority', 'control')
    );

    perform public.rb_issue_remote_cleanup_command(
      'mobile',
      'purge_shop_data',
      'shop_deleted',
      p_shop_id,
      v_name,
      v_member_user_id,
      null,
      null,
      jsonb_build_object('scope', 'shop', 'authority', 'control')
    );
  end loop;

  for v_employee_id, v_employee_auth_user_id in
    select e.id, e.auth_user_id
    from public.employees e
    where e.shop_id = p_shop_id
  loop
    if v_employee_auth_user_id is not null then
      perform public.rb_issue_remote_cleanup_command(
        'desktop',
        'revoke_shop_access',
        'shop_deleted',
        p_shop_id,
        v_name,
        v_employee_auth_user_id,
        v_employee_id,
        null,
        jsonb_build_object('scope', 'employee', 'authority', 'control')
      );

      perform public.rb_issue_remote_cleanup_command(
        'mobile',
        'revoke_shop_access',
        'shop_deleted',
        p_shop_id,
        v_name,
        v_employee_auth_user_id,
        v_employee_id,
        null,
        jsonb_build_object('scope', 'employee', 'authority', 'control')
      );
    end if;
  end loop;

  for v_device_id, v_device_type in
    select d.id, coalesce(d.device_type, 'desktop')
    from public.rb_devices d
    where d.shop_id = p_shop_id
  loop
    perform public.rb_issue_remote_cleanup_command(
      case
        when lower(v_device_type) = 'workstation' then 'workstation'
        else 'desktop'
      end,
      case
        when lower(v_device_type) = 'workstation' then 'reset_pairing'
        else 'purge_shop_data'
      end,
      'shop_deleted',
      p_shop_id,
      v_name,
      null,
      null,
      v_device_id,
      jsonb_build_object('scope', 'device', 'device_type', v_device_type, 'authority', 'control')
    );
  end loop;

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
  end if;

  if to_regclass('public.rb_device_activation_tokens') is not null then
    execute $sql$
      delete from public.rb_device_activation_tokens
      where shop_id = $1
         or device_id in (
           select d.id
           from public.rb_devices d
           where d.shop_id = $1
         )
    $sql$
    using p_shop_id;
  end if;

  delete from public.employees
  where shop_id = p_shop_id;

  delete from public.rb_shop_members
  where shop_id = p_shop_id;

  if to_regclass('public.rb_onboarding_codes') is not null
     and to_regclass('public.rb_onboarding_state') is not null then
    execute $sql$
      delete from public.rb_onboarding_codes
      where user_id in (
        select s.user_id
        from public.rb_onboarding_state s
        where s.shop_id = $1
      )
    $sql$
    using p_shop_id;
  end if;

  if to_regclass('public.rb_onboarding_state') is not null then
    execute $sql$
      delete from public.rb_onboarding_state
      where shop_id = $1
    $sql$
    using p_shop_id;
  end if;

  delete from public.rb_shops
  where id = p_shop_id;

  return jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'shop_name', v_name
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
declare
  v_shop_name text;
  v_employee record;
  v_membership_role text;
  v_admin_count integer;
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
    select role into v_membership_role
    from public.rb_shop_members
    where shop_id = p_shop_id
      and user_id = v_employee.auth_user_id;

    if v_membership_role = 'admin' then
      select count(*) into v_admin_count
      from public.rb_shop_members
      where shop_id = p_shop_id
        and role = 'admin';

      if v_admin_count <= 1 then
        raise exception 'cannot remove the last admin-backed employee from the shop';
      end if;
    end if;
  end if;

  insert into public.rb_audit (
    shop_id,
    actor_user_id,
    actor_kind,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    p_shop_id,
    p_actor_user_id,
    'user',
    'employee.removed',
    'employee',
    p_employee_id,
    jsonb_build_object(
      'employee_code', v_employee.employee_code,
      'display_name', v_employee.display_name,
      'authority', 'control'
    )
  );

  if v_employee.auth_user_id is not null then
    perform public.rb_issue_remote_cleanup_command(
      'desktop',
      'revoke_shop_access',
      'employee_removed',
      p_shop_id,
      v_shop_name,
      v_employee.auth_user_id,
      p_employee_id,
      null,
      jsonb_build_object('scope', 'employee', 'authority', 'control')
    );

    perform public.rb_issue_remote_cleanup_command(
      'mobile',
      'revoke_shop_access',
      'employee_removed',
      p_shop_id,
      v_shop_name,
      v_employee.auth_user_id,
      p_employee_id,
      null,
      jsonb_build_object('scope', 'employee', 'authority', 'control')
    );
  end if;

  update public.messaging_roster
  set added_by_employee_id = null
  where shop_id = p_shop_id
    and added_by_employee_id = p_employee_id;

  update public.time_off_requests
  set decided_by_employee_id = null
  where shop_id = p_shop_id
    and decided_by_employee_id = p_employee_id;

  update public.conversations c
  set created_by = fallback.employee_id,
      created_by_employee_id = fallback.employee_id
  from (
    select c2.id as conversation_id,
           (
             select cm.employee_id
             from public.conversation_members cm
             where cm.conversation_id = c2.id
               and cm.employee_id <> p_employee_id
             order by
               case when cm.member_role = 'owner' then 0 else 1 end,
               cm.joined_at asc
             limit 1
           ) as employee_id
    from public.conversations c2
    where c2.shop_id = p_shop_id
      and c2.created_by = p_employee_id
  ) as fallback
  where c.id = fallback.conversation_id
    and fallback.employee_id is not null;

  delete from public.conversations
  where shop_id = p_shop_id
    and created_by = p_employee_id;

  delete from public.message_reactions
  where shop_id = p_shop_id
    and employee_id = p_employee_id;

  delete from public.message_reads
  where employee_id = p_employee_id
     or conversation_id in (
       select c.id
       from public.conversations c
       where c.shop_id = p_shop_id
         and c.created_by = p_employee_id
     );

  delete from public.conversation_archives
  where shop_id = p_shop_id
    and employee_id = p_employee_id;

  delete from public.messages
  where shop_id = p_shop_id
    and sender_employee_id = p_employee_id;

  delete from public.conversation_members
  where shop_id = p_shop_id
    and employee_id = p_employee_id;

  delete from public.messaging_roster
  where shop_id = p_shop_id
    and employee_id = p_employee_id;

  delete from public.time_events
  where shop_id = p_shop_id
    and employee_id = p_employee_id;

  delete from public.time_off_requests
  where shop_id = p_shop_id
    and employee_id = p_employee_id;

  delete from public.employee_roles
  where shop_id = p_shop_id
    and employee_id = p_employee_id;

  if v_employee.auth_user_id is not null then
    delete from public.rb_shop_members
    where shop_id = p_shop_id
      and user_id = v_employee.auth_user_id;
  end if;

  if to_regclass('public.rb_onboarding_state') is not null and v_employee.auth_user_id is not null then
    execute $sql$
      update public.rb_onboarding_state
      set
        shop_id = null,
        completed_at = null,
        completed_steps = '[]'::jsonb,
        current_step = 'profile',
        updated_at = now(),
        last_seen_at = now()
      where user_id = $1
        and shop_id = $2
    $sql$
    using v_employee.auth_user_id, p_shop_id;
  end if;

  delete from public.employees
  where id = p_employee_id;

  return jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'employee_id', p_employee_id,
    'display_name', v_employee.display_name,
    'employee_code', v_employee.employee_code
  );
end;
$function$;
