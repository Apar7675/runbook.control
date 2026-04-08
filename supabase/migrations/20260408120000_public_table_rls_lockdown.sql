alter table public.rb_onboarding_state enable row level security;
alter table public.rb_onboarding_codes enable row level security;
alter table public.rb_trial_usage_history enable row level security;

drop policy if exists rb_onboarding_state_deny_client_access on public.rb_onboarding_state;
create policy rb_onboarding_state_deny_client_access
  on public.rb_onboarding_state
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists rb_onboarding_codes_deny_client_access on public.rb_onboarding_codes;
create policy rb_onboarding_codes_deny_client_access
  on public.rb_onboarding_codes
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists rb_trial_usage_history_deny_client_access on public.rb_trial_usage_history;
create policy rb_trial_usage_history_deny_client_access
  on public.rb_trial_usage_history
  for all
  to anon, authenticated
  using (false)
  with check (false);
