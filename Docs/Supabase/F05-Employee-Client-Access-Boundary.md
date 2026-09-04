# F05 Employee Client-Access Boundary Verification

The local F05 change keeps `public.employees` server-only and gives Mobile three
reviewed RPCs containing only employee id, shop id, display name, active state,
and avatar paths. Every RPC resolves authority from the signed-in user and an
active `public.rb_shop_members` row. The avatar RPC resolves the employee id on
the server and accepts no employee-id parameter. The migration also replaces
the bucket-wide avatar policies with active-shop reads and self-only writes.

The local migration is:

- `supabase/migrations/20260904124500_employee_client_access_boundary.sql`

Production application is blocked for separate owner approval. Do not run the
migration from this procedure. Do not use an application service-role key to
perform this check.

## Release dependency

Do not apply this migration ahead of a compatible Mobile release. Installed
clients that still query `public.employees` directly will fail after the table
revoke. The migration also makes the `avatars` bucket private, so legacy public
avatar URLs stop resolving anonymously; compatible clients must request signed
URLs and treat signing failure as unavailable media. Coordinate the Mobile
release and this migration atomically, or enforce a compatible minimum client
version before application.

## Owner-run live metadata check

Run the following verbatim in the approved Supabase SQL Editor. It reads only
migration and PostgreSQL catalog metadata. It does not select employee or other
application rows, does not invoke application functions, and always rolls back.

```sql
begin transaction read only;

select version
from supabase_migrations.schema_migrations
where version = '20260904124500';

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'employees'
  and c.relkind in ('r', 'p');

select
  p.grantee,
  p.privilege_type,
  p.is_grantable
from information_schema.table_privileges as p
where p.table_schema = 'public'
  and p.table_name = 'employees'
  and p.grantee in ('PUBLIC', 'anon', 'authenticated')
order by p.grantee, p.privilege_type;

select
  p.grantee,
  p.column_name,
  p.privilege_type,
  p.is_grantable
from information_schema.column_privileges as p
where p.table_schema = 'public'
  and p.table_name = 'employees'
  and p.grantee in ('PUBLIC', 'anon', 'authenticated')
order by p.grantee, p.column_name, p.privilege_type;

select
  r.rolname as role_name,
  has_table_privilege(r.oid, 'public.employees', 'SELECT') as can_select,
  has_table_privilege(r.oid, 'public.employees', 'INSERT') as can_insert,
  has_table_privilege(r.oid, 'public.employees', 'UPDATE') as can_update,
  has_table_privilege(r.oid, 'public.employees', 'DELETE') as can_delete,
  has_table_privilege(r.oid, 'public.employees', 'TRUNCATE') as can_truncate,
  has_table_privilege(r.oid, 'public.employees', 'REFERENCES') as can_reference,
  has_table_privilege(r.oid, 'public.employees', 'TRIGGER') as can_trigger,
  has_any_column_privilege(r.oid, 'public.employees', 'SELECT') as can_select_column,
  has_any_column_privilege(r.oid, 'public.employees', 'INSERT') as can_insert_column,
  has_any_column_privilege(r.oid, 'public.employees', 'UPDATE') as can_update_column,
  has_any_column_privilege(r.oid, 'public.employees', 'REFERENCES') as can_reference_column
from pg_catalog.pg_roles as r
where r.rolname in ('anon', 'authenticated')
order by r.rolname;

select
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
from pg_catalog.pg_policies as p
where p.schemaname = 'public'
  and p.tablename = 'employees'
order by p.policyname;

select
  b.id as bucket_id,
  b.public as is_public
from storage.buckets as b
where b.id = 'avatars';

select
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
from pg_catalog.pg_policies as p
where p.schemaname = 'storage'
  and p.tablename = 'objects'
order by p.policyname;

with expected_functions(signature) as (
  values
    ('public.current_employee()'),
    ('public.current_employee_clock()'),
    ('public.current_employee_id(uuid)'),
    ('public.get_my_employee_id(uuid)'),
    ('public.is_foreman_employee(uuid)'),
    ('public.is_messaging_active_employee(uuid)'),
    ('public.my_employee()'),
    ('public.my_employee_id(uuid)'),
    ('public.rb_current_employee_id(uuid)'),
    ('public.rb_my_employee_id(uuid)'),
    ('public.rb_can_read_shop_avatar_object(text)'),
    ('public.rb_can_manage_my_avatar_object(text)'),
    ('public.rb_mobile_employee_self(uuid)'),
    ('public.rb_mobile_employee_directory(uuid)'),
    ('public.rb_mobile_update_my_avatar(uuid,text,text)')
)
select
  f.signature,
  p.prosecdef as security_definer,
  p.proconfig as pinned_settings,
  pg_catalog.pg_get_function_result(p.oid) as result_contract,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from expected_functions as f
left join pg_catalog.pg_proc as p on p.oid = to_regprocedure(f.signature)
order by f.signature;

rollback;
```

Expected post-migration metadata:

- the migration-version query returns `20260904124500`;
- `employees` has RLS enabled;
- both recorded-grant queries return no rows;
- every effective table and column privilege is false for `anon` and
  `authenticated`;
- the employee policy query returns no rows;
- the avatar bucket query returns one row with `is_public = false`;
- the avatar policy query returns exactly the three `rb_avatars_*` policies: an
  authenticated active-shop SELECT policy and authenticated self-only INSERT
  and UPDATE policies;
- all 15 function rows exist, are `SECURITY DEFINER`, pin
  `search_path=pg_catalog, public` and `row_security=off`, deny `anon`, and allow
  `authenticated` plus `service_role`;
- the three `rb_mobile_*` result contracts contain exactly six fields: `id`,
  `shop_id`, `display_name`, `is_active`, `avatar_url_256`, and
  `avatar_url_512`.

If any expectation fails, stop. Do not apply additional SQL or attempt a repair
in the live project without a separately reviewed production procedure.
