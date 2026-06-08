alter table public.rb_devices
  add column if not exists local_install_id text,
  add column if not exists machine_fingerprint text,
  add column if not exists local_computer_name text,
  add column if not exists replaced_by_device_id uuid,
  add column if not exists replaced_at timestamptz,
  add column if not exists replacement_restore_generation integer,
  add column if not exists replacement_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_devices_replaced_by_device_id_fkey'
      and conrelid = 'public.rb_devices'::regclass
  ) then
    alter table public.rb_devices
      add constraint rb_devices_replaced_by_device_id_fkey
      foreign key (replaced_by_device_id) references public.rb_devices(id) on delete set null;
  end if;
end $$;

create index if not exists rb_devices_local_install_id_idx
  on public.rb_devices (local_install_id);

create index if not exists rb_devices_machine_fingerprint_idx
  on public.rb_devices (machine_fingerprint);

create index if not exists rb_devices_replaced_by_device_id_idx
  on public.rb_devices (replaced_by_device_id);
