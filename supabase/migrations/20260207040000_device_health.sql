-- Device Health: last check-in + reported version
-- Safe additive migration.

create extension if not exists pgcrypto;

alter table public.rb_devices
  add column if not exists last_checkin_at timestamptz,
  add column if not exists reported_version text;

-- Device check-in RPC:
-- - Device sends plaintext deviceKey + version
-- - DB hashes deviceKey and matches rb_devices.device_key_hash
-- - Updates last_checkin_at + reported_version for active devices only
create or replace function public.rb_device_checkin(
  p_device_key text,
  p_reported_version text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_device_id uuid;
begin
  if p_device_key is null or length(trim(p_device_key)) = 0 then
    raise exception 'missing device key';
  end if;

  if p_reported_version is null or length(trim(p_reported_version)) = 0 then
    raise exception 'missing version';
  end if;

  v_hash := encode(digest(p_device_key, 'sha256'), 'hex');

  select id into v_device_id
  from public.rb_devices
  where device_key_hash = v_hash
    and status = 'active'
  limit 1;

  if v_device_id is null then
    raise exception 'invalid or inactive device';
  end if;

  update public.rb_devices
  set
    last_checkin_at = now(),
    reported_version = p_reported_version
  where id = v_device_id;
end;
$$;

revoke all on function public.rb_device_checkin(text, text) from public;
grant execute on function public.rb_device_checkin(text, text) to anon;
grant execute on function public.rb_device_checkin(text, text) to authenticated;
