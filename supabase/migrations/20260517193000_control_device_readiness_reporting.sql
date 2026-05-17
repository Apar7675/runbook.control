create table if not exists public.rb_device_readiness_reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  device_id uuid null,
  computer_name text not null,
  reported_by_user_id uuid null,
  overall_status text not null default 'not_checked',
  score integer null,
  summary text null,
  checks jsonb not null default '[]'::jsonb,
  app_version text null,
  service_version text null,
  os_summary text null,
  machine_summary jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reported_at timestamptz not null default now()
);

alter table public.rb_device_readiness_reports
  add column if not exists shop_id uuid not null,
  add column if not exists device_id uuid null,
  add column if not exists computer_name text not null default '',
  add column if not exists reported_by_user_id uuid null,
  add column if not exists overall_status text not null default 'not_checked',
  add column if not exists score integer null,
  add column if not exists summary text null,
  add column if not exists checks jsonb not null default '[]'::jsonb,
  add column if not exists app_version text null,
  add column if not exists service_version text null,
  add column if not exists os_summary text null,
  add column if not exists machine_summary jsonb null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists reported_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_device_readiness_reports_shop_id_fkey'
      and conrelid = 'public.rb_device_readiness_reports'::regclass
  ) then
    alter table public.rb_device_readiness_reports
      add constraint rb_device_readiness_reports_shop_id_fkey
      foreign key (shop_id) references public.rb_shops(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_device_readiness_reports_device_id_fkey'
      and conrelid = 'public.rb_device_readiness_reports'::regclass
  ) then
    alter table public.rb_device_readiness_reports
      add constraint rb_device_readiness_reports_device_id_fkey
      foreign key (device_id) references public.rb_devices(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_device_readiness_reports_reported_by_user_id_fkey'
      and conrelid = 'public.rb_device_readiness_reports'::regclass
  ) then
    alter table public.rb_device_readiness_reports
      add constraint rb_device_readiness_reports_reported_by_user_id_fkey
      foreign key (reported_by_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

alter table public.rb_device_readiness_reports
  drop constraint if exists rb_device_readiness_reports_overall_status_check;

alter table public.rb_device_readiness_reports
  add constraint rb_device_readiness_reports_overall_status_check
  check (overall_status = any (array['ready'::text, 'needs_attention'::text, 'not_ready'::text, 'not_checked'::text]));

alter table public.rb_device_readiness_reports
  drop constraint if exists rb_device_readiness_reports_score_check;

alter table public.rb_device_readiness_reports
  add constraint rb_device_readiness_reports_score_check
  check (score is null or (score >= 0 and score <= 100));

alter table public.rb_device_readiness_reports
  drop constraint if exists rb_device_readiness_reports_checks_array_check;

alter table public.rb_device_readiness_reports
  add constraint rb_device_readiness_reports_checks_array_check
  check (jsonb_typeof(checks) = 'array');

create index if not exists rb_device_readiness_reports_shop_reported_idx
  on public.rb_device_readiness_reports (shop_id, reported_at desc);

create index if not exists rb_device_readiness_reports_device_reported_idx
  on public.rb_device_readiness_reports (device_id, reported_at desc);

create index if not exists rb_device_readiness_reports_status_idx
  on public.rb_device_readiness_reports (overall_status, reported_at desc);

grant all on table public.rb_device_readiness_reports to service_role;
