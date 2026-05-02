-- Control-owned Mobile timeclock submit policy.
-- Mobile submits punch evidence to /api/mobile/timeclock/events; Control evaluates policy
-- and writes public.time_events. Direct Mobile time_events writes are intentionally being retired.

alter table public.rb_shops
  add column if not exists mobile_timeclock_enabled boolean not null default false,
  add column if not exists mobile_punch_policy text not null default 'DISABLED',
  add column if not exists mobile_punch_failure_mode text not null default 'BLOCK',
  add column if not exists mobile_geofence_lat numeric null,
  add column if not exists mobile_geofence_lng numeric null,
  add column if not exists mobile_geofence_radius_meters integer null,
  add column if not exists mobile_max_gps_accuracy_meters integer null,
  add column if not exists mobile_allowed_network_cidrs jsonb null,
  add column if not exists mobile_allowed_wifi_ssids jsonb null,
  add column if not exists mobile_allowed_wifi_bssids jsonb null;

alter table public.employees
  add column if not exists mobile_timeclock_enabled boolean not null default false,
  add column if not exists mobile_timeclock_requires_review boolean not null default false;

alter table public.time_events
  add column if not exists gps_latitude numeric null,
  add column if not exists gps_longitude numeric null,
  add column if not exists gps_accuracy_meters numeric null,
  add column if not exists location_captured_at timestamptz null,
  add column if not exists network_type text null,
  add column if not exists wifi_ssid text null,
  add column if not exists wifi_bssid text null,
  add column if not exists local_ip text null,
  add column if not exists app_platform text null,
  add column if not exists policy_result text null,
  add column if not exists policy_reason text null,
  add column if not exists policy_evidence jsonb null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rb_shops_mobile_punch_policy_check'
  ) then
    alter table public.rb_shops
      add constraint rb_shops_mobile_punch_policy_check
      check (
        mobile_punch_policy in (
          'DISABLED',
          'ALLOW_ANYWHERE',
          'GPS_GEOFENCE',
          'LOCAL_NETWORK',
          'GPS_OR_LOCAL_NETWORK',
          'GPS_AND_LOCAL_NETWORK'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rb_shops_mobile_punch_failure_mode_check'
  ) then
    alter table public.rb_shops
      add constraint rb_shops_mobile_punch_failure_mode_check
      check (mobile_punch_failure_mode in ('BLOCK', 'PENDING_REVIEW'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'time_events_policy_result_check'
  ) then
    alter table public.time_events
      add constraint time_events_policy_result_check
      check (policy_result is null or policy_result in ('APPROVED', 'PENDING_REVIEW', 'BLOCKED'));
  end if;
end $$;

comment on column public.rb_shops.mobile_timeclock_enabled is
  'Control-owned shop gate for Mobile timeclock submissions.';

comment on column public.rb_shops.mobile_punch_policy is
  'Server-side Mobile punch evidence policy. Mobile evidence is advisory only until Control evaluates it.';

comment on column public.rb_shops.mobile_punch_failure_mode is
  'Whether failed Mobile punch policy checks are blocked or stored as needs_review time_events.';

comment on column public.employees.mobile_timeclock_enabled is
  'Employee-level Control gate for punching from Mobile.';

comment on column public.employees.mobile_timeclock_requires_review is
  'Forces accepted Mobile punches to needs_review until an authority reviews them.';

comment on column public.time_events.policy_evidence is
  'Mobile punch evidence captured at submission time plus server policy evaluation details.';
