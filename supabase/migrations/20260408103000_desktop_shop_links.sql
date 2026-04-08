begin;

create table if not exists public.rb_desktop_shop_links (
  shop_id uuid not null,
  device_id uuid not null,
  device_name text not null default '',
  status text not null default 'active',
  device_role text,
  linked_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint rb_desktop_shop_links_pkey primary key (shop_id, device_id),
  constraint rb_desktop_shop_links_shop_id_fkey
    foreign key (shop_id) references public.rb_shops(id) on delete cascade,
  constraint rb_desktop_shop_links_status_check
    check (status in ('active', 'inactive')),
  constraint rb_desktop_shop_links_role_check
    check (device_role is null or device_role in ('primary', 'secondary'))
);

create index if not exists rb_desktop_shop_links_device_id_idx
  on public.rb_desktop_shop_links (device_id);

create unique index if not exists rb_desktop_shop_links_one_primary_per_shop
  on public.rb_desktop_shop_links (shop_id)
  where device_role = 'primary';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rb_devices'
      and column_name = 'device_type'
  ) then
    insert into public.rb_desktop_shop_links (
      shop_id,
      device_id,
      device_name,
      status,
      device_role,
      linked_at,
      updated_at
    )
    select
      shop_id,
      id,
      coalesce(name, ''),
      case
        when lower(coalesce(status, 'active')) = 'inactive' then 'inactive'
        else 'active'
      end,
      case
        when lower(coalesce(device_role, '')) in ('primary', 'secondary') then lower(device_role)
        else null
      end,
      coalesce(created_at, now()),
      now()
    from public.rb_devices
    where shop_id is not null
      and lower(coalesce(device_type, 'desktop')) = 'desktop'
    on conflict (shop_id, device_id) do update
    set
      device_name = excluded.device_name,
      status = excluded.status,
      device_role = excluded.device_role,
      updated_at = excluded.updated_at;
  else
    insert into public.rb_desktop_shop_links (
      shop_id,
      device_id,
      device_name,
      status,
      device_role,
      linked_at,
      updated_at
    )
    select
      shop_id,
      id,
      coalesce(name, ''),
      case
        when lower(coalesce(status, 'active')) = 'inactive' then 'inactive'
        else 'active'
      end,
      case
        when lower(coalesce(device_role, '')) in ('primary', 'secondary') then lower(device_role)
        else null
      end,
      coalesce(created_at, now()),
      now()
    from public.rb_devices
    where shop_id is not null
    on conflict (shop_id, device_id) do update
    set
      device_name = excluded.device_name,
      status = excluded.status,
      device_role = excluded.device_role,
      updated_at = excluded.updated_at;
  end if;
end $$;

alter table public.rb_desktop_shop_links enable row level security;

commit;
