create table if not exists public.rb_software_releases (
  id uuid primary key default gen_random_uuid(),
  app_name text not null,
  version text not null,
  channel text not null default 'stable',
  status text not null default 'draft',
  required boolean not null default false,
  release_notes text null,
  minimum_supported_version text null,
  rollback_version text null,
  created_by uuid null,
  approved_by uuid null,
  created_at timestamptz not null default now(),
  published_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.rb_software_releases
  add column if not exists app_name text not null default 'desktop',
  add column if not exists version text not null default '0.0.0',
  add column if not exists channel text not null default 'stable',
  add column if not exists status text not null default 'draft',
  add column if not exists required boolean not null default false,
  add column if not exists release_notes text null,
  add column if not exists minimum_supported_version text null,
  add column if not exists rollback_version text null,
  add column if not exists created_by uuid null,
  add column if not exists approved_by uuid null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists published_at timestamptz null,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.rb_software_packages (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null,
  file_name text not null,
  storage_path text null,
  download_url text null,
  sha256 text not null,
  size_bytes bigint null,
  platform text not null default 'windows',
  architecture text not null default 'x64',
  created_at timestamptz not null default now()
);

alter table public.rb_software_packages
  add column if not exists release_id uuid,
  add column if not exists file_name text not null default '',
  add column if not exists storage_path text null,
  add column if not exists download_url text null,
  add column if not exists sha256 text not null default '',
  add column if not exists size_bytes bigint null,
  add column if not exists platform text not null default 'windows',
  add column if not exists architecture text not null default 'x64',
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.rb_software_rollouts (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null,
  target_type text not null,
  target_shop_id uuid null,
  target_device_id uuid null,
  channel text not null default 'stable',
  required boolean not null default false,
  status text not null default 'planned',
  starts_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rb_software_rollouts
  add column if not exists release_id uuid,
  add column if not exists target_type text not null default 'all',
  add column if not exists target_shop_id uuid null,
  add column if not exists target_device_id uuid null,
  add column if not exists channel text not null default 'stable',
  add column if not exists required boolean not null default false,
  add column if not exists status text not null default 'planned',
  add column if not exists starts_at timestamptz null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.rb_device_software_status (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid null,
  device_id uuid null,
  device_name text null,
  desktop_version text null,
  service_version text null,
  workstation_version text null,
  mobile_version text null,
  channel text not null default 'stable',
  update_status text not null default 'unknown',
  pending_release_id uuid null,
  last_check_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rb_device_software_status
  add column if not exists shop_id uuid null,
  add column if not exists device_id uuid null,
  add column if not exists device_name text null,
  add column if not exists desktop_version text null,
  add column if not exists service_version text null,
  add column if not exists workstation_version text null,
  add column if not exists mobile_version text null,
  add column if not exists channel text not null default 'stable',
  add column if not exists update_status text not null default 'unknown',
  add column if not exists pending_release_id uuid null,
  add column if not exists last_check_at timestamptz null,
  add column if not exists last_error text null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.rb_software_update_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid null,
  device_id uuid null,
  release_id uuid null,
  app_name text not null,
  from_version text null,
  to_version text null,
  event_type text not null,
  message text null,
  created_at timestamptz not null default now()
);

alter table public.rb_software_update_events
  add column if not exists shop_id uuid null,
  add column if not exists device_id uuid null,
  add column if not exists release_id uuid null,
  add column if not exists app_name text not null default 'desktop',
  add column if not exists from_version text null,
  add column if not exists to_version text null,
  add column if not exists event_type text not null default 'checked',
  add column if not exists message text null,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_software_releases_created_by_fkey'
      and conrelid = 'public.rb_software_releases'::regclass
  ) then
    alter table public.rb_software_releases
      add constraint rb_software_releases_created_by_fkey
      foreign key (created_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_software_releases_approved_by_fkey'
      and conrelid = 'public.rb_software_releases'::regclass
  ) then
    alter table public.rb_software_releases
      add constraint rb_software_releases_approved_by_fkey
      foreign key (approved_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_software_packages_release_id_fkey'
      and conrelid = 'public.rb_software_packages'::regclass
  ) then
    alter table public.rb_software_packages
      add constraint rb_software_packages_release_id_fkey
      foreign key (release_id) references public.rb_software_releases(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_software_rollouts_release_id_fkey'
      and conrelid = 'public.rb_software_rollouts'::regclass
  ) then
    alter table public.rb_software_rollouts
      add constraint rb_software_rollouts_release_id_fkey
      foreign key (release_id) references public.rb_software_releases(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_software_rollouts_target_shop_id_fkey'
      and conrelid = 'public.rb_software_rollouts'::regclass
  ) then
    alter table public.rb_software_rollouts
      add constraint rb_software_rollouts_target_shop_id_fkey
      foreign key (target_shop_id) references public.rb_shops(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_software_rollouts_target_device_id_fkey'
      and conrelid = 'public.rb_software_rollouts'::regclass
  ) then
    alter table public.rb_software_rollouts
      add constraint rb_software_rollouts_target_device_id_fkey
      foreign key (target_device_id) references public.rb_devices(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_device_software_status_shop_id_fkey'
      and conrelid = 'public.rb_device_software_status'::regclass
  ) then
    alter table public.rb_device_software_status
      add constraint rb_device_software_status_shop_id_fkey
      foreign key (shop_id) references public.rb_shops(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_device_software_status_device_id_fkey'
      and conrelid = 'public.rb_device_software_status'::regclass
  ) then
    alter table public.rb_device_software_status
      add constraint rb_device_software_status_device_id_fkey
      foreign key (device_id) references public.rb_devices(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_device_software_status_pending_release_id_fkey'
      and conrelid = 'public.rb_device_software_status'::regclass
  ) then
    alter table public.rb_device_software_status
      add constraint rb_device_software_status_pending_release_id_fkey
      foreign key (pending_release_id) references public.rb_software_releases(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_software_update_events_shop_id_fkey'
      and conrelid = 'public.rb_software_update_events'::regclass
  ) then
    alter table public.rb_software_update_events
      add constraint rb_software_update_events_shop_id_fkey
      foreign key (shop_id) references public.rb_shops(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_software_update_events_device_id_fkey'
      and conrelid = 'public.rb_software_update_events'::regclass
  ) then
    alter table public.rb_software_update_events
      add constraint rb_software_update_events_device_id_fkey
      foreign key (device_id) references public.rb_devices(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_software_update_events_release_id_fkey'
      and conrelid = 'public.rb_software_update_events'::regclass
  ) then
    alter table public.rb_software_update_events
      add constraint rb_software_update_events_release_id_fkey
      foreign key (release_id) references public.rb_software_releases(id) on delete set null;
  end if;
end $$;

alter table public.rb_software_releases
  drop constraint if exists rb_software_releases_app_name_check;

alter table public.rb_software_releases
  add constraint rb_software_releases_app_name_check
  check (app_name = any (array['desktop'::text, 'service'::text, 'workstation'::text, 'mobile'::text, 'control'::text]));

alter table public.rb_software_releases
  drop constraint if exists rb_software_releases_channel_check;

alter table public.rb_software_releases
  add constraint rb_software_releases_channel_check
  check (channel = any (array['dev'::text, 'beta'::text, 'stable'::text]));

alter table public.rb_software_releases
  drop constraint if exists rb_software_releases_status_check;

alter table public.rb_software_releases
  add constraint rb_software_releases_status_check
  check (status = any (array['draft'::text, 'active'::text, 'retired'::text, 'blocked'::text]));

alter table public.rb_software_packages
  drop constraint if exists rb_software_packages_platform_check;

alter table public.rb_software_packages
  add constraint rb_software_packages_platform_check
  check (platform = any (array['windows'::text, 'ios'::text, 'android'::text, 'web'::text]));

alter table public.rb_software_packages
  drop constraint if exists rb_software_packages_architecture_check;

alter table public.rb_software_packages
  add constraint rb_software_packages_architecture_check
  check (architecture = any (array['x64'::text, 'arm64'::text, 'universal'::text, 'none'::text]));

alter table public.rb_software_rollouts
  drop constraint if exists rb_software_rollouts_target_type_check;

alter table public.rb_software_rollouts
  add constraint rb_software_rollouts_target_type_check
  check (target_type = any (array['all'::text, 'shop'::text, 'device'::text, 'beta'::text]));

alter table public.rb_software_rollouts
  drop constraint if exists rb_software_rollouts_channel_check;

alter table public.rb_software_rollouts
  add constraint rb_software_rollouts_channel_check
  check (channel = any (array['dev'::text, 'beta'::text, 'stable'::text]));

alter table public.rb_software_rollouts
  drop constraint if exists rb_software_rollouts_status_check;

alter table public.rb_software_rollouts
  add constraint rb_software_rollouts_status_check
  check (status = any (array['planned'::text, 'active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text]));

alter table public.rb_device_software_status
  drop constraint if exists rb_device_software_status_channel_check;

alter table public.rb_device_software_status
  add constraint rb_device_software_status_channel_check
  check (channel = any (array['dev'::text, 'beta'::text, 'stable'::text]));

alter table public.rb_device_software_status
  drop constraint if exists rb_device_software_status_update_status_check;

alter table public.rb_device_software_status
  add constraint rb_device_software_status_update_status_check
  check (update_status = any (array['unknown'::text, 'current'::text, 'available'::text, 'required'::text, 'installing'::text, 'succeeded'::text, 'failed'::text, 'blocked'::text, 'pending_restart'::text]));

alter table public.rb_software_update_events
  drop constraint if exists rb_software_update_events_app_name_check;

alter table public.rb_software_update_events
  add constraint rb_software_update_events_app_name_check
  check (app_name = any (array['desktop'::text, 'service'::text, 'workstation'::text, 'mobile'::text, 'control'::text]));

alter table public.rb_software_update_events
  drop constraint if exists rb_software_update_events_event_type_check;

alter table public.rb_software_update_events
  add constraint rb_software_update_events_event_type_check
  check (
    event_type = any (
      array[
        'checked'::text,
        'available'::text,
        'download_started'::text,
        'download_succeeded'::text,
        'download_failed'::text,
        'install_started'::text,
        'install_succeeded'::text,
        'install_failed'::text,
        'rollback_started'::text,
        'rollback_succeeded'::text,
        'rollback_failed'::text,
        'blocked'::text
      ]
    )
  );

create unique index if not exists rb_software_releases_app_version_channel_key
  on public.rb_software_releases (app_name, version, channel);

create index if not exists rb_software_releases_app_channel_status_idx
  on public.rb_software_releases (app_name, channel, status);

create index if not exists rb_software_packages_release_id_idx
  on public.rb_software_packages (release_id);

create index if not exists rb_software_rollouts_release_status_idx
  on public.rb_software_rollouts (release_id, status);

create index if not exists rb_software_rollouts_target_shop_id_idx
  on public.rb_software_rollouts (target_shop_id);

create index if not exists rb_software_rollouts_target_device_id_idx
  on public.rb_software_rollouts (target_device_id);

create index if not exists rb_device_software_status_shop_id_idx
  on public.rb_device_software_status (shop_id);

create index if not exists rb_device_software_status_device_id_idx
  on public.rb_device_software_status (device_id);

create index if not exists rb_device_software_status_update_status_idx
  on public.rb_device_software_status (update_status);

create index if not exists rb_software_update_events_shop_created_idx
  on public.rb_software_update_events (shop_id, created_at desc);

create index if not exists rb_software_update_events_device_created_idx
  on public.rb_software_update_events (device_id, created_at desc);

create index if not exists rb_software_update_events_release_created_idx
  on public.rb_software_update_events (release_id, created_at desc);

alter table public.rb_software_releases enable row level security;
alter table public.rb_software_packages enable row level security;
alter table public.rb_software_rollouts enable row level security;
alter table public.rb_device_software_status enable row level security;
alter table public.rb_software_update_events enable row level security;

drop policy if exists "software_releases_select_control_admin" on public.rb_software_releases;
create policy "software_releases_select_control_admin"
on public.rb_software_releases
for select
to authenticated
using (
  exists (
    select 1
    from public.rb_control_admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists "software_packages_select_control_admin" on public.rb_software_packages;
create policy "software_packages_select_control_admin"
on public.rb_software_packages
for select
to authenticated
using (
  exists (
    select 1
    from public.rb_control_admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists "software_rollouts_select_control_admin" on public.rb_software_rollouts;
create policy "software_rollouts_select_control_admin"
on public.rb_software_rollouts
for select
to authenticated
using (
  exists (
    select 1
    from public.rb_control_admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists "device_software_status_select_control_admin" on public.rb_device_software_status;
create policy "device_software_status_select_control_admin"
on public.rb_device_software_status
for select
to authenticated
using (
  exists (
    select 1
    from public.rb_control_admins a
    where a.user_id = auth.uid()
  )
);

drop policy if exists "software_update_events_select_control_admin" on public.rb_software_update_events;
create policy "software_update_events_select_control_admin"
on public.rb_software_update_events
for select
to authenticated
using (
  exists (
    select 1
    from public.rb_control_admins a
    where a.user_id = auth.uid()
  )
);

grant select on table public.rb_software_releases to authenticated;
grant select on table public.rb_software_packages to authenticated;
grant select on table public.rb_software_rollouts to authenticated;
grant select on table public.rb_device_software_status to authenticated;
grant select on table public.rb_software_update_events to authenticated;

grant all on table public.rb_software_releases to service_role;
grant all on table public.rb_software_packages to service_role;
grant all on table public.rb_software_rollouts to service_role;
grant all on table public.rb_device_software_status to service_role;
grant all on table public.rb_software_update_events to service_role;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pronamespace = 'public'::regnamespace
  ) then
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'trg_rb_software_releases_updated_at'
        and tgrelid = 'public.rb_software_releases'::regclass
    ) then
      create trigger trg_rb_software_releases_updated_at
      before update on public.rb_software_releases
      for each row execute function public.set_updated_at();
    end if;

    if not exists (
      select 1
      from pg_trigger
      where tgname = 'trg_rb_software_rollouts_updated_at'
        and tgrelid = 'public.rb_software_rollouts'::regclass
    ) then
      create trigger trg_rb_software_rollouts_updated_at
      before update on public.rb_software_rollouts
      for each row execute function public.set_updated_at();
    end if;

    if not exists (
      select 1
      from pg_trigger
      where tgname = 'trg_rb_device_software_status_updated_at'
        and tgrelid = 'public.rb_device_software_status'::regclass
    ) then
      create trigger trg_rb_device_software_status_updated_at
      before update on public.rb_device_software_status
      for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;
