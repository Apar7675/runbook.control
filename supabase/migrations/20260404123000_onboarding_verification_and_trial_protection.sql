create extension if not exists pgcrypto;
create table if not exists public.rb_onboarding_state (
  user_id uuid primary key,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  shop_name text not null default '',
  device_id text,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.rb_onboarding_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  channel text not null check (channel in ('email', 'sms')),
  destination text not null default '',
  destination_hash text not null default '',
  code_hash text not null default '',
  expires_at timestamptz not null,
  verified_at timestamptz,
  attempts integer not null default 0,
  sent_count integer not null default 0,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rb_onboarding_codes_user_channel_key unique (user_id, channel)
);
create index if not exists rb_onboarding_codes_destination_hash_idx
  on public.rb_onboarding_codes (channel, destination_hash);
alter table public.rb_onboarding_state
  add constraint rb_onboarding_state_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.rb_onboarding_codes
  add constraint rb_onboarding_codes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.rb_shops add column if not exists trial_device_id text;
alter table public.rb_shops add column if not exists trial_email_hash text;
alter table public.rb_shops add column if not exists trial_phone_hash text;
alter table public.rb_shops add column if not exists trial_restricted boolean not null default false;
alter table public.rb_shops add column if not exists trial_restriction_reason text;
create index if not exists rb_shops_trial_device_id_idx on public.rb_shops (trial_device_id);
create index if not exists rb_shops_trial_email_hash_idx on public.rb_shops (trial_email_hash);
create index if not exists rb_shops_trial_phone_hash_idx on public.rb_shops (trial_phone_hash);
