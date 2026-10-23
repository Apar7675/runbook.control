-- Concatenate fixture + target migration + this file into the disposable CI DB.
-- All assertions abort psql with ON_ERROR_STOP; final rollback removes the fixture.
insert into public.time_events(employee_id,shop_id,event_type,client_ts,server_ts,needs_review,policy_result)
select '00000000-0000-4000-8000-0000000000a1'::uuid,
 '00000000-0000-4000-8000-000000000011'::uuid,
 kind, stamp::timestamptz, stamp::timestamptz + interval '2 days', pending,
 case when pending then 'PENDING_REVIEW' else 'APPROVED' end
from (values
 ('CLOCK_IN','2026-01-04 08:00:00+00',false),
 ('BREAK_START','2026-01-04 10:00:00+00',false),
 ('BREAK_END','2026-01-04 10:15:00+00',false),
 ('LUNCH_START','2026-01-04 12:00:00+00',false),
 ('LUNCH_END','2026-01-04 12:30:00+00',false),
 ('CLOCK_OUT','2026-01-04 17:00:00+00',false),
 ('CLOCK_IN','2026-01-10 23:00:00+00',true),
 ('CLOCK_OUT','2026-01-11 01:00:00+00',true),
 ('CLOCK_IN','2026-01-20 23:00:00+00',false),
 ('CLOCK_OUT','2026-01-21 01:00:00+00',false),
 ('BREAK_END','2026-02-08 08:00:00+00',false),
 ('LUNCH_START','2026-02-08 09:00:00+00',false),
 ('LUNCH_END','2026-02-08 09:30:00+00',false),
 ('BREAK_START','2026-02-08 10:00:00+00',false)
) v(kind,stamp,pending);
-- Same timestamp events use deterministic receipt order, then id order.
insert into public.time_events(id,employee_id,shop_id,event_type,client_ts,server_ts)
values
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','CLOCK_IN','2026-02-01 08:00+00','2026-02-01 09:00+00'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','BREAK_START','2026-02-01 08:00+00','2026-02-01 10:00+00'),
('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','CLOCK_OUT','2026-02-01 08:00+00','2026-02-01 10:00+00');
-- Unrelated employee/shop rows must not alter the selected stream.
insert into public.time_events(employee_id,shop_id,event_type,client_ts)
values
('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-000000000011','CLOCK_IN','2026-01-04 00:00+00'),
('00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-000000000022','CLOCK_IN','2026-01-04 00:00+00'),
('00000000-0000-4000-8000-0000000000d4','00000000-0000-4000-8000-000000000011','CLOCK_IN','2026-01-04 00:00+00'),
('00000000-0000-4000-8000-0000000000e5','00000000-0000-4000-8000-000000000011','CLOCK_IN','2026-01-04 00:00+00');
create temporary table source_before as table public.time_events;
do $test$
declare r record; total bigint;
begin
  select * into r from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-04') where day='2026-01-04';
  assert r.work_seconds=29700 and r.break_seconds=900 and r.lunch_seconds=1800 and r.total_seconds=29700, 'modern states / net work / client time';
  assert r.status='IN_WORKING' and r.last_event_ts='2026-01-10 23:00+00'::timestamptz, 'last state belongs to reporting week';
  select count(*) into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-04');
  assert total=7, 'exactly seven date rows';
  select work_seconds into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-11') where day='2026-01-11';
  assert total=3600, 'prior-week carry / pending evidence is not silently approved or discarded';
  select sum(work_seconds) into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-18') where day in ('2026-01-20','2026-01-21');
  assert total=7200, 'overnight time survives both days';
  select count(*) into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-18') where day in ('2026-01-20','2026-01-21') and work_seconds=3600;
  assert total=2, 'overnight split is exact';
  select sum(work_seconds+break_seconds+lunch_seconds) into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-02-01');
  assert total=0, 'same timestamp tie order cannot invent elapsed time';
  select sum(work_seconds+break_seconds+lunch_seconds) into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-02-08');
  assert total=0, 'orphan break/lunch events cannot start a shift';
  select sum(work_seconds+break_seconds+lunch_seconds) into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-02-15');
  assert total=0, 'prior-week orphan activity cannot override clocked-out state';
  assert not exists(select 1 from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1',null)), 'null week returns no date rows';
  assert (select not prosecdef from pg_proc where oid='public.timeclock_weekly_summary(uuid,uuid,date)'::regprocedure), 'function remains security invoker';
end
$test$;
-- Explicit UTC calendar is invariant under caller session zone and DST rules.
create temporary table utc_result as select * from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-18');
set local timezone='America/New_York';
do $test$
begin
 assert not exists((select * from utc_result except select * from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-18')) union all
 (select * from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-18') except select * from utc_result)), 'session timezone must not change server days';
end
$test$;
set local timezone='Pacific/Auckland';
do $test$
begin
 assert not exists((select * from utc_result except select * from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-18')) union all
 (select * from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-18') except select * from utc_result)), 'session timezone must not change UTC arithmetic';
end
$test$;
-- Read-only behavior includes retaining review flags and every source column.
do $test$
begin
 assert not exists((table source_before except table public.time_events) union all (table public.time_events except table source_before)), 'summary must not mutate source';
end
$test$;
-- Open streams clamp at transaction now; a future punch never contributes time/state.
insert into public.time_events(employee_id,shop_id,event_type,client_ts)
values
('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','CLOCK_IN',now()-interval '90 minutes'),
('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','CLOCK_OUT',now()+interval '1 day');
do $test$
declare total bigint;
begin
 select sum(work_seconds) into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1',(now() at time zone 'UTC')::date-1);
 assert total=5400, 'open segment stops at now, including midnight carry';
 select sum(work_seconds+break_seconds+lunch_seconds) into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1',(now() at time zone 'UTC')::date+7);
 assert total=0, 'future week cannot accrue time';
end
$test$;
-- Exercise the real handler as an unprivileged actor under RLS.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $test$
declare total bigint;
begin
 select sum(work_seconds) into total from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-04');
 assert total=33300, 'own employee retains scoped recorded work';
 assert not exists(select 1 from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000b2','2026-01-04') where work_seconds<>0 or last_event_ts is not null), 'another employee cannot be read by changing RPC arguments';
 assert not exists(select 1 from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-0000000000c3','2026-01-04') where work_seconds<>0 or last_event_ts is not null), 'cross-shop rows remain hidden';
 assert not exists(select 1 from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-0000000000a1','2026-01-04') where work_seconds<>0 or last_event_ts is not null), 'shop and employee must both match';
end
$test$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
do $test$
begin
 assert not exists(select 1 from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','2026-01-04') where work_seconds<>0 or last_event_ts is not null), 'actor without employee row sees no event stream';
end
$test$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
do $test$
begin
 assert not exists(select 1 from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000d4','2026-01-04') where work_seconds<>0 or last_event_ts is not null), 'inactive employee cannot read prior evidence';
end
$test$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
do $test$
begin
 assert not exists(select 1 from public.timeclock_weekly_summary('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000e5','2026-01-04') where work_seconds<>0 or last_event_ts is not null), 'inactive shop membership cannot read prior evidence';
 assert not has_table_privilege(current_user,'public.employees','select'), 'fixture must preserve server-only employees';
end
$test$;
reset role;
rollback;
\echo PASS: weekly summary arithmetic, UTC calendar, source retention and RLS actors
