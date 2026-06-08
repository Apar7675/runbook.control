create or replace function public.rb_register_main_desktop_replacement(
  p_shop_id uuid,
  p_old_active_primary_desktop_id text,
  p_old_active_primary_local_install_id text,
  p_old_active_primary_machine_fingerprint text,
  p_old_active_primary_computer_name text,
  p_old_restore_generation integer,
  p_new_device_id uuid,
  p_new_local_install_id text,
  p_new_machine_fingerprint text,
  p_new_computer_name text,
  p_new_restore_generation integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_new public.rb_devices%rowtype;
  v_old public.rb_devices%rowtype;
  v_previous_primary public.rb_devices%rowtype;
  v_old_lookup text := nullif(trim(coalesce(p_old_active_primary_desktop_id, '')), '');
  v_old_local_install_id text := nullif(trim(coalesce(p_old_active_primary_local_install_id, '')), '');
  v_old_machine_fingerprint text := nullif(trim(coalesce(p_old_active_primary_machine_fingerprint, '')), '');
  v_old_computer_name text := nullif(trim(coalesce(p_old_active_primary_computer_name, '')), '');
  v_new_local_install_id text := nullif(trim(coalesce(p_new_local_install_id, '')), '');
  v_new_machine_fingerprint text := nullif(trim(coalesce(p_new_machine_fingerprint, '')), '');
  v_new_computer_name text := nullif(trim(coalesce(p_new_computer_name, '')), '');
  v_warnings jsonb := '[]'::jsonb;
begin
  if p_shop_id is null then
    raise exception 'shop_id is required';
  end if;

  if p_new_device_id is null then
    raise exception 'new_device_id is required';
  end if;

  perform id
  from public.rb_devices
  where shop_id = p_shop_id
  order by id
  for update;

  select *
    into v_new
  from public.rb_devices
  where id = p_new_device_id
    and shop_id = p_shop_id
  limit 1;

  if v_new.id is null then
    raise exception 'new_device_not_registered';
  end if;

  select *
    into v_previous_primary
  from public.rb_devices
  where shop_id = p_shop_id
    and device_role = 'primary'
    and id <> p_new_device_id
  order by created_at desc
  limit 1;

  if v_old_lookup is not null and v_old_lookup ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select *
      into v_old
    from public.rb_devices
    where shop_id = p_shop_id
      and id = v_old_lookup::uuid
      and id <> p_new_device_id
    limit 1;
  end if;

  if v_old.id is null and v_old_lookup is not null then
    select *
      into v_old
    from public.rb_devices
    where shop_id = p_shop_id
      and local_install_id = v_old_lookup
      and id <> p_new_device_id
    order by created_at desc
    limit 1;
  end if;

  if v_old.id is null and v_old_local_install_id is not null then
    select *
      into v_old
    from public.rb_devices
    where shop_id = p_shop_id
      and local_install_id = v_old_local_install_id
      and id <> p_new_device_id
    order by created_at desc
    limit 1;
  end if;

  if v_old.id is null and v_old_machine_fingerprint is not null then
    select *
      into v_old
    from public.rb_devices
    where shop_id = p_shop_id
      and machine_fingerprint = v_old_machine_fingerprint
      and id <> p_new_device_id
    order by created_at desc
    limit 1;
  end if;

  if v_old.id is null and v_previous_primary.id is not null then
    v_old := v_previous_primary;
  end if;

  if v_old.id is null then
    v_warnings := v_warnings || jsonb_build_array('old_device_not_found');
  else
    if v_previous_primary.id is not null and v_previous_primary.id <> v_old.id then
      v_warnings := v_warnings || jsonb_build_array('previous_primary_was_different');
    end if;

    if (v_old_local_install_id is not null and v_old.local_install_id is not null and v_old.local_install_id <> v_old_local_install_id)
      or (v_old_machine_fingerprint is not null and v_old.machine_fingerprint is not null and v_old.machine_fingerprint <> v_old_machine_fingerprint)
      or (v_old_computer_name is not null and v_old.local_computer_name is not null and v_old.local_computer_name <> v_old_computer_name) then
      v_warnings := v_warnings || jsonb_build_array('old_identity_mismatch');
    end if;
  end if;

  update public.rb_devices
  set device_role = null
  where shop_id = p_shop_id
    and device_role = 'primary';

  if v_old.id is not null then
    update public.rb_devices
    set
      status = 'replaced',
      device_role = null,
      replaced_by_device_id = p_new_device_id,
      replaced_at = v_now,
      replacement_restore_generation = p_new_restore_generation,
      replacement_reason = 'backup_restore_replacement'
    where id = v_old.id;
  end if;

  update public.rb_devices
  set
    status = 'active',
    device_type = 'desktop',
    device_role = 'primary',
    local_install_id = v_new_local_install_id,
    machine_fingerprint = v_new_machine_fingerprint,
    local_computer_name = v_new_computer_name
  where id = p_new_device_id
    and shop_id = p_shop_id;

  return jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'old_device_marked_replaced', v_old.id is not null,
    'old_device_id', v_old.id,
    'old_device_name', v_old.name,
    'new_device_primary', true,
    'new_device_id', p_new_device_id,
    'warnings', v_warnings
  );
end;
$$;

revoke all on function public.rb_register_main_desktop_replacement(uuid, text, text, text, text, integer, uuid, text, text, text, integer) from public;
grant execute on function public.rb_register_main_desktop_replacement(uuid, text, text, text, text, integer, uuid, text, text, text, integer) to service_role;
