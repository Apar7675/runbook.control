create extension if not exists pgcrypto;

create table if not exists public.rb_profiles (
  id uuid primary key,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rb_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_profiles_id_fkey'
      and conrelid = 'public.rb_profiles'::regclass
  ) then
    alter table public.rb_profiles
      add constraint rb_profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

create policy "rb_profiles_select_self"
on public.rb_profiles
for select
to authenticated
using (auth.uid() = id);

create policy "rb_profiles_insert_self"
on public.rb_profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "rb_profiles_update_self"
on public.rb_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

grant select, insert, update on table public.rb_profiles to authenticated;
grant all on table public.rb_profiles to service_role;

create table if not exists public.rb_device_tokens (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  token_hash text not null,
  label text,
  created_at timestamptz not null default now(),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_device_tokens_device_id_fkey'
      and conrelid = 'public.rb_device_tokens'::regclass
  ) then
    alter table public.rb_device_tokens
      add constraint rb_device_tokens_device_id_fkey
      foreign key (device_id) references public.rb_devices(id) on delete cascade;
  end if;
end $$;

create unique index if not exists rb_device_tokens_token_hash_key
  on public.rb_device_tokens (token_hash);

create index if not exists rb_device_tokens_device_id_idx
  on public.rb_device_tokens (device_id, issued_at desc);

create index if not exists rb_device_tokens_active_idx
  on public.rb_device_tokens (device_id, revoked_at, issued_at desc);

grant all on table public.rb_device_tokens to service_role;

create table if not exists public.rb_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_id text not null,
  device_name text,
  device_type text,
  trusted_at timestamptz not null default now(),
  trusted_until timestamptz not null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rb_trusted_devices enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_trusted_devices_user_id_fkey'
      and conrelid = 'public.rb_trusted_devices'::regclass
  ) then
    alter table public.rb_trusted_devices
      add constraint rb_trusted_devices_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

create unique index if not exists rb_trusted_devices_user_device_key
  on public.rb_trusted_devices (user_id, device_id);

create index if not exists rb_trusted_devices_user_until_idx
  on public.rb_trusted_devices (user_id, trusted_until desc);

create policy "rb_trusted_devices_select_self"
on public.rb_trusted_devices
for select
to authenticated
using (auth.uid() = user_id);

create policy "rb_trusted_devices_insert_self"
on public.rb_trusted_devices
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "rb_trusted_devices_update_self"
on public.rb_trusted_devices
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "rb_trusted_devices_delete_self"
on public.rb_trusted_devices
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on table public.rb_trusted_devices to authenticated;
grant all on table public.rb_trusted_devices to service_role;

create table if not exists public.rb_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text,
  actor_kind text not null default 'user',
  action text not null,
  target_type text,
  target_id text,
  shop_id uuid,
  meta jsonb not null default '{}'::jsonb
);

alter table public.rb_audit_log
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists actor_user_id uuid,
  add column if not exists actor_email text,
  add column if not exists actor_kind text not null default 'user',
  add column if not exists action text not null default '',
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists shop_id uuid,
  add column if not exists meta jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_audit_log_actor_user_id_fkey'
      and conrelid = 'public.rb_audit_log'::regclass
  ) then
    alter table public.rb_audit_log
      add constraint rb_audit_log_actor_user_id_fkey
      foreign key (actor_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

create index if not exists rb_audit_log_created_idx
  on public.rb_audit_log (created_at desc);

create index if not exists rb_audit_log_shop_idx
  on public.rb_audit_log (shop_id, created_at desc);

create index if not exists rb_audit_log_action_idx
  on public.rb_audit_log (action, created_at desc);

create index if not exists rb_audit_log_actor_email_idx
  on public.rb_audit_log (actor_email);

grant all on table public.rb_audit_log to service_role;

insert into public.rb_audit_log (
  id,
  created_at,
  actor_user_id,
  actor_email,
  actor_kind,
  action,
  target_type,
  target_id,
  shop_id,
  meta
)
select
  id,
  created_at,
  actor_user_id,
  null,
  coalesce(actor_kind, 'user'),
  action,
  entity_type,
  entity_id,
  shop_id,
  coalesce(details, '{}'::jsonb)
from public.rb_audit
on conflict (id) do nothing;

create table if not exists public.rb_webhook_events (
  id text primary key,
  created_at timestamptz not null default now()
);

create index if not exists rb_webhook_events_created_idx
  on public.rb_webhook_events (created_at desc);

grant all on table public.rb_webhook_events to service_role;

create table if not exists public.rb_idempotency_keys (
  key text primary key,
  created_at timestamptz not null default now()
);

create index if not exists rb_idempotency_keys_created_idx
  on public.rb_idempotency_keys (created_at desc);

grant all on table public.rb_idempotency_keys to service_role;

create table if not exists public.rb_delete_operations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid,
  shop_name text,
  actor_user_id uuid,
  status text not null check (status in ('pending', 'running', 'failed', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result_json jsonb not null default '{}'::jsonb,
  error_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_delete_operations_actor_user_id_fkey'
      and conrelid = 'public.rb_delete_operations'::regclass
  ) then
    alter table public.rb_delete_operations
      add constraint rb_delete_operations_actor_user_id_fkey
      foreign key (actor_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

create index if not exists rb_delete_operations_shop_idx
  on public.rb_delete_operations (shop_id, started_at desc);

create index if not exists rb_delete_operations_status_idx
  on public.rb_delete_operations (status, started_at desc);

grant all on table public.rb_delete_operations to service_role;

delete from public.rb_control_admins a
where not exists (
  select 1
  from auth.users u
  where u.id = a.user_id
);

delete from public.rb_user_prefs p
where not exists (
  select 1
  from auth.users u
  where u.id = p.user_id
);

delete from public.rb_shop_members m
where not exists (
  select 1
  from auth.users u
  where u.id = m.user_id
);

update public.rb_support_bundles b
set uploaded_by = null
where not exists (
  select 1
  from auth.users u
  where u.id = b.uploaded_by
);

update public.rb_update_packages p
set created_by = null
where not exists (
  select 1
  from auth.users u
  where u.id = p.created_by
);

update public.employees e
set auth_user_id = null
where auth_user_id is not null
  and not exists (
    select 1
    from auth.users u
    where u.id = e.auth_user_id
  );

delete from public.employees e
where not exists (
  select 1
  from public.rb_shops s
  where s.id = e.shop_id
);

alter table public.rb_support_bundles
  alter column uploaded_by drop not null;

alter table public.rb_update_packages
  alter column created_by drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_shop_id_fkey'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_shop_id_fkey
      foreign key (shop_id) references public.rb_shops(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_auth_user_id_fkey'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_shop_members_user_id_fkey'
      and conrelid = 'public.rb_shop_members'::regclass
  ) then
    alter table public.rb_shop_members
      add constraint rb_shop_members_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_control_admins_user_id_fkey'
      and conrelid = 'public.rb_control_admins'::regclass
  ) then
    alter table public.rb_control_admins
      add constraint rb_control_admins_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_user_prefs_user_id_fkey'
      and conrelid = 'public.rb_user_prefs'::regclass
  ) then
    alter table public.rb_user_prefs
      add constraint rb_user_prefs_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_support_bundles_uploaded_by_fkey'
      and conrelid = 'public.rb_support_bundles'::regclass
  ) then
    alter table public.rb_support_bundles
      add constraint rb_support_bundles_uploaded_by_fkey
      foreign key (uploaded_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_update_packages_created_by_fkey'
      and conrelid = 'public.rb_update_packages'::regclass
  ) then
    alter table public.rb_update_packages
      add constraint rb_update_packages_created_by_fkey
      foreign key (created_by) references auth.users(id) on delete set null;
  end if;
end $$;

alter table public.employees
  drop constraint if exists employees_auth_user_id_key;

drop index if exists public.employees_auth_user_id_key;

create unique index if not exists employees_shop_auth_unique
  on public.employees (shop_id, auth_user_id)
  where auth_user_id is not null;

update public.rb_shop_members
set role = case
  when lower(role) = 'owner' then 'owner'
  when lower(role) = 'admin' then 'admin'
  when lower(role) in ('manager', 'foreman') then 'admin'
  else 'member'
end;

update public.employees
set role = case
  when lower(role) in ('owner', 'admin', 'manager', 'foreman') then 'foreman'
  else 'employee'
end;

alter table public.rb_shop_members
  drop constraint if exists rb_shop_members_role_check;

alter table public.rb_shop_members
  add constraint rb_shop_members_role_check
  check (role = any (array['owner'::text, 'admin'::text, 'member'::text]));

alter table public.employees
  drop constraint if exists employees_role_check;

alter table public.employees
  add constraint employees_role_check
  check (role = any (array['foreman'::text, 'employee'::text]));
