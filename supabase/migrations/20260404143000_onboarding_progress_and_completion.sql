alter table public.rb_onboarding_state
  add column if not exists current_step text not null default 'profile';

alter table public.rb_onboarding_state
  add column if not exists completed_steps jsonb not null default '[]'::jsonb;

alter table public.rb_onboarding_state
  add column if not exists completed_at timestamptz;

alter table public.rb_onboarding_state
  add column if not exists shop_id uuid;

alter table public.rb_onboarding_state
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.rb_onboarding_state
  add constraint rb_onboarding_state_shop_id_fkey
  foreign key (shop_id) references public.rb_shops(id) on delete set null;
