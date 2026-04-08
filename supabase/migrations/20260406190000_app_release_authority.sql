alter table public.rb_update_packages
  add column if not exists app_id text not null default 'desktop';

alter table public.rb_update_packages
  add column if not exists min_supported_version text;

alter table public.rb_update_packages
  add column if not exists required_update boolean not null default false;

alter table public.rb_update_packages
  add column if not exists published_at timestamp with time zone;

alter table public.rb_update_packages
  add column if not exists is_current boolean not null default false;

alter table public.rb_update_packages
  add column if not exists installer_kind text not null default 'installer';

alter table public.rb_update_packages
  add column if not exists file_name text;

alter table public.rb_update_packages
  drop constraint if exists rb_update_packages_app_id_check;

alter table public.rb_update_packages
  add constraint rb_update_packages_app_id_check
  check (app_id in ('desktop', 'workstation'));

alter table public.rb_update_packages
  drop constraint if exists rb_update_packages_installer_kind_check;

alter table public.rb_update_packages
  add constraint rb_update_packages_installer_kind_check
  check (installer_kind in ('installer', 'archive', 'other'));

alter table public.rb_update_packages
  drop constraint if exists rb_update_packages_channel_version_key;

create unique index if not exists rb_update_packages_app_channel_version_key
  on public.rb_update_packages (app_id, channel, version);

create unique index if not exists rb_update_packages_one_current_per_app_channel
  on public.rb_update_packages (app_id, channel)
  where is_current = true;
