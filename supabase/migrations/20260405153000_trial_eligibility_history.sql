alter table public.rb_shops add column if not exists trial_consumed_at timestamptz;
alter table public.rb_shops add column if not exists trial_eligibility_reason text;
create table if not exists public.rb_trial_usage_history (
  id uuid primary key default gen_random_uuid(),
  source_shop_id uuid,
  shop_name text not null default '',
  user_id uuid,
  device_id text,
  email_hash text,
  phone_hash text,
  outcome text not null default 'clean_trial' check (outcome in ('clean_trial', 'restricted_trial', 'billing_required')),
  eligibility_reason text not null default 'clean_trial',
  consumed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rb_shops_trial_consumed_at_idx on public.rb_shops (trial_consumed_at);
create index if not exists rb_shops_trial_eligibility_reason_idx on public.rb_shops (trial_eligibility_reason);
create index if not exists rb_trial_usage_history_user_id_idx on public.rb_trial_usage_history (user_id);
create index if not exists rb_trial_usage_history_device_id_idx on public.rb_trial_usage_history (device_id);
create index if not exists rb_trial_usage_history_email_hash_idx on public.rb_trial_usage_history (email_hash);
create index if not exists rb_trial_usage_history_phone_hash_idx on public.rb_trial_usage_history (phone_hash);
create index if not exists rb_trial_usage_history_consumed_at_idx on public.rb_trial_usage_history (consumed_at desc);
alter table public.rb_trial_usage_history
  add constraint rb_trial_usage_history_source_shop_id_fkey
  foreign key (source_shop_id) references public.rb_shops(id) on delete set null;
alter table public.rb_trial_usage_history
  add constraint rb_trial_usage_history_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
