# Weekly timeclock summary compatibility contract

The existing `public.timeclock_weekly_summary(uuid, uuid, date)` RPC keeps its arguments, seven-column result, security-invoker behavior and existing grants. This migration is source only until separately applied through the normal database release process.

## Calendar and evidence

The date argument starts seven UTC server calendar days. No shop/company timezone is currently stored by Control. UTC is an explicit compatibility basis, consistent with the existing cloud time-off event-date trigger; it is not a claim that a company selected UTC. PostgreSQL session timezone and the phone timezone cannot change the returned dates. A company reporting-zone setting requires a separate reviewed contract and UI.

The RPC summarizes submitted punch evidence, including rows still marked `needs_review`. It does not approve punches, change review flags, produce payroll, decide paid breaks or certify payable hours. Existing source rows and policy evidence remain unchanged.

The event's `client_ts` records the punch time; `server_ts` only breaks ties between simultaneous client times, followed by event ID. Offline receipt delay must not move work into a different day.

## Durations

- `CLOCK_IN`, `BREAK_END` and `LUNCH_END` begin working segments.
- `BREAK_START` and `LUNCH_START` begin their respective nonworking segments.
- `CLOCK_OUT` ends the active segment.
- Each segment is split across every UTC day it overlaps. The last activity and last clock-in/out boundary before the week supply carry-in state. Break/lunch events outside an active shift cannot create work or nonworking hours. Open segments stop at the earlier of transaction time and the reporting-window end; future events never accrue time.
- `work_seconds` is net recorded working time. Break and lunch durations are separate. `total_seconds` equals `work_seconds`, so break/lunch are not deducted twice. None of these fields is called paid time.
- Existing `status` vocabulary (`IN_WORKING`, `IN_BREAK`, `IN_LUNCH`, `OUT`) is retained; `last_event_ts` is the last visible event before the cutoff.

A missing clock-out can carry activity into later days. The summary does not invent automatic clock-outs or silently repair evidence; such rows require review.

## Verification and release

The manual-only Control CI workflow runs PostgreSQL 17 in a disposable service and streams, in order:

1. `supabase/tests/timeclock_weekly_summary_fixture.sql`
2. `supabase/migrations/20261023235500_timeclock_weekly_summary_utc.sql`
3. `supabase/tests/timeclock_weekly_summary.sql`

The fixture creates only synthetic auth/employee/event tables and the current F05 active-identity helper and SELECT RLS, executes the actual migration function, checks arithmetic/carry-in/overnight/receipt delay/tie ordering/open and future windows/session-timezone invariance/source retention, and calls the RPC as an unprivileged actor for same-employee, other-employee, cross-shop, inactive-employee and inactive-membership access. The transaction rolls back all fixture state. Never run the fixture against an application database.

These tests establish the checked-in function behavior under a minimal representative schema. They do not certify a live database schema, migration application, payroll policy or end-to-end provider configuration.
