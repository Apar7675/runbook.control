alter table public.rb_shops
  add column if not exists trial_override_reason text,
  add column if not exists billing_amount numeric(12,2),
  add column if not exists billing_interval text,
  add column if not exists next_billing_date timestamptz,
  add column if not exists manual_billing_status text,
  add column if not exists manual_billing_override boolean not null default false,
  add column if not exists billing_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_shops_manual_billing_status_check'
  ) then
    alter table public.rb_shops
      add constraint rb_shops_manual_billing_status_check
      check (
        manual_billing_status is null
        or manual_billing_status in (
          'trial_active',
          'trial_extended',
          'trial_ended',
          'payment_required',
          'paid_active',
          'suspended'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rb_shops_billing_interval_check'
  ) then
    alter table public.rb_shops
      add constraint rb_shops_billing_interval_check
      check (
        billing_interval is null
        or billing_interval in ('month', 'quarter', 'year', 'custom')
      );
  end if;
end $$;
