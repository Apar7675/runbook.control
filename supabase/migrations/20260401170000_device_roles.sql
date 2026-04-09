alter table public.rb_devices
  add column if not exists device_role text;
alter table public.rb_devices
  drop constraint if exists rb_devices_device_role_check;
alter table public.rb_devices
  add constraint rb_devices_device_role_check
  check (device_role is null or device_role in ('primary', 'secondary'));
create unique index if not exists rb_devices_one_primary_per_shop
  on public.rb_devices (shop_id)
  where device_role = 'primary';
