# F04 Legacy Manufacturing Containment Verification

This document is a RunBook.Control operational verification procedure. It does
not change the RunBook authority model: local manufacturing data remains owned
by the Desktop company shell.

The local migration is:

- `supabase/migrations/20260904123134_deny_legacy_manufacturing_client_access.sql`

Production application is blocked for separate owner approval. Do not run the
migration from this procedure. Do not use an application service-role key to
perform this check.

## Owner-run live metadata check

Run the following verbatim in the approved Supabase SQL Editor. It reads only
migration and PostgreSQL catalog metadata. It does not select application rows
or invoke application functions, and it always rolls back.

```sql
begin transaction read only;

select version
from supabase_migrations.schema_migrations
where version = '20260904123134';

with targets(table_name) as (
  values
    ('attachments'), ('balloon_sets'), ('component_aliases'),
    ('component_files'), ('components'), ('daily_logs'),
    ('inspection_sets'), ('jobs'), ('op_sessions'), ('operations'),
    ('operators'), ('po_line_items'), ('purchase_orders'),
    ('routing_operations'), ('tenants'), ('travelers')
)
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
join targets t on t.table_name = c.relname
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

with targets(table_name) as (
  values
    ('attachments'), ('balloon_sets'), ('component_aliases'),
    ('component_files'), ('components'), ('daily_logs'),
    ('inspection_sets'), ('jobs'), ('op_sessions'), ('operations'),
    ('operators'), ('po_line_items'), ('purchase_orders'),
    ('routing_operations'), ('tenants'), ('travelers')
)
select
  p.table_name,
  p.grantee,
  p.privilege_type,
  p.is_grantable
from information_schema.table_privileges p
join targets t on t.table_name = p.table_name
where p.table_schema = 'public'
  and p.grantee in ('PUBLIC', 'anon', 'authenticated')
order by p.table_name, p.grantee, p.privilege_type;

with targets(table_name) as (
  values
    ('attachments'), ('balloon_sets'), ('component_aliases'),
    ('component_files'), ('components'), ('daily_logs'),
    ('inspection_sets'), ('jobs'), ('op_sessions'), ('operations'),
    ('operators'), ('po_line_items'), ('purchase_orders'),
    ('routing_operations'), ('tenants'), ('travelers')
),
roles(role_name) as (
  values ('anon'), ('authenticated')
)
select
  c.relname as table_name,
  r.rolname as role_name,
  has_schema_privilege(r.oid, n.oid, 'USAGE') as schema_usage,
  has_table_privilege(r.oid, c.oid, 'SELECT') as can_select,
  has_table_privilege(r.oid, c.oid, 'INSERT') as can_insert,
  has_table_privilege(r.oid, c.oid, 'UPDATE') as can_update,
  has_table_privilege(r.oid, c.oid, 'DELETE') as can_delete,
  has_table_privilege(r.oid, c.oid, 'TRUNCATE') as can_truncate,
  has_table_privilege(r.oid, c.oid, 'REFERENCES') as can_reference,
  has_table_privilege(r.oid, c.oid, 'TRIGGER') as can_trigger
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
join targets t on t.table_name = c.relname
join pg_catalog.pg_roles r
  on r.rolname in (select role_name from roles)
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname, r.rolname;

select
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in (
    'attachments', 'balloon_sets', 'component_aliases',
    'component_files', 'components', 'daily_logs',
    'inspection_sets', 'jobs', 'op_sessions', 'operations',
    'operators', 'po_line_items', 'purchase_orders',
    'routing_operations', 'tenants', 'travelers'
  )
order by tablename, policyname;

rollback;
```

Expected post-migration metadata:

- the migration-version query returns `20260904123134`;
- the RLS query returns exactly 16 rows and every `rls_enabled` value is true;
- the recorded-grant query returns no rows;
- every effective table privilege (`can_*`) is false (`schema_usage` may remain
  true because this migration intentionally does not change schema access);
- the policy query returns no rows.

If any expectation fails, stop. Do not apply additional SQL or attempt a repair
in the live project without a separately reviewed production procedure.
