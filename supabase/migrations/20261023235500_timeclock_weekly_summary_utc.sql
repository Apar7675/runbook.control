-- Correct the existing read-only RPC without changing its signature or grants.
-- UTC is an explicit compatibility calendar, not a configured company/payroll zone.
-- Submitted evidence (including pending review) is reported; no approval is implied.
create or replace function public.timeclock_weekly_summary(
  p_shop_id uuid, p_employee_id uuid, p_week_start date
)
returns table(
  day date, work_seconds bigint, break_seconds bigint, lunch_seconds bigint,
  total_seconds bigint, last_event_ts timestamptz, status text
)
language sql stable security invoker
set search_path = pg_catalog, public
as $function$
with bounds as (
  select
    p_week_start::timestamp at time zone 'UTC' as start_ts,
    (p_week_start + 7)::timestamp at time zone 'UTC' as end_ts,
    least(now(), (p_week_start + 7)::timestamp at time zone 'UTC') as stop_ts
),
-- Carry both prior activity and the last shift boundary; orphan break/lunch
-- events must never start a shift.
preceding_event as (
  select te.id, te.event_type, te.client_ts, te.server_ts
  from public.time_events te cross join bounds b
  where te.shop_id = p_shop_id and te.employee_id = p_employee_id
    and te.client_ts < b.start_ts and te.client_ts < b.stop_ts
  order by te.client_ts desc, te.server_ts desc, te.id desc
  limit 1
),
preceding_shift as (
  select te.id, te.event_type, te.client_ts, te.server_ts
  from public.time_events te cross join bounds b
  where te.shop_id = p_shop_id and te.employee_id = p_employee_id
    and te.client_ts < b.start_ts and te.client_ts < b.stop_ts
    and te.event_type in ('CLOCK_IN', 'CLOCK_OUT')
  order by te.client_ts desc, te.server_ts desc, te.id desc
  limit 1
),
week_events as (
  select te.id, te.event_type, te.client_ts, te.server_ts
  from public.time_events te cross join bounds b
  where te.shop_id = p_shop_id and te.employee_id = p_employee_id
    and te.client_ts >= b.start_ts and te.client_ts < b.stop_ts
),
events as (
  select * from preceding_event
  union
  select * from preceding_shift
  union
  select * from week_events
),
ordered_events as (
  select e.*, row_number() over (order by client_ts, server_ts, id) as sequence
  from events e
),
shift_states as (
  select e.*, max(sequence) filter (where event_type in ('CLOCK_IN', 'CLOCK_OUT'))
    over (order by sequence rows unbounded preceding) as shift_sequence
  from ordered_events e
),
segments as (
  select e.id, e.client_ts, e.server_ts,
    coalesce(
      lead(e.client_ts) over (order by e.sequence),
      b.stop_ts
    ) as segment_end,
    case when marker.event_type = 'CLOCK_IN' then case e.event_type
      when 'CLOCK_IN' then 'IN_WORKING'
      when 'BREAK_END' then 'IN_WORKING'
      when 'LUNCH_END' then 'IN_WORKING'
      when 'BREAK_START' then 'IN_BREAK'
      when 'LUNCH_START' then 'IN_LUNCH'
      else 'OUT'
    end else 'OUT' end as activity
  from shift_states e
  left join ordered_events marker on marker.sequence = e.shift_sequence
  cross join bounds b
),
week_days as (
  select p_week_start + n as day,
    (p_week_start + n)::timestamp at time zone 'UTC' as start_ts,
    (p_week_start + n + 1)::timestamp at time zone 'UTC' as end_ts
  from generate_series(0, 6) as days(n)
  where p_week_start is not null
),
seconds_by_day as (
  select d.day,
    floor(coalesce(sum(extract(epoch from
      least(s.segment_end, d.end_ts) - greatest(s.client_ts, d.start_ts)
    )) filter (where s.activity = 'IN_WORKING'), 0))::bigint as work_seconds,
    floor(coalesce(sum(extract(epoch from
      least(s.segment_end, d.end_ts) - greatest(s.client_ts, d.start_ts)
    )) filter (where s.activity = 'IN_BREAK'), 0))::bigint as break_seconds,
    floor(coalesce(sum(extract(epoch from
      least(s.segment_end, d.end_ts) - greatest(s.client_ts, d.start_ts)
    )) filter (where s.activity = 'IN_LUNCH'), 0))::bigint as lunch_seconds
  from week_days d
  left join segments s on s.client_ts < d.end_ts
    and s.segment_end > d.start_ts and s.segment_end > s.client_ts
  group by d.day
),
last_event as (
  select client_ts, activity
  from segments
  order by client_ts desc, server_ts desc, id desc
  limit 1
)
select d.day, d.work_seconds, d.break_seconds, d.lunch_seconds,
  -- Work segments already exclude break/lunch; never deduct them a second time.
  d.work_seconds as total_seconds,
  l.client_ts as last_event_ts, coalesce(l.activity, 'OUT') as status
from seconds_by_day d left join last_event l on true
order by d.day;
$function$;
comment on function public.timeclock_weekly_summary(uuid, uuid, date) is
  'Read-only submitted activity in UTC server days; client timestamps, modern punch events, overnight carry. Work/total exclude break and lunch. Not approval, payroll, or a configured company timezone. Security invoker preserves time_events RLS.';
