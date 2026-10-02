-- F03: define the explicit employee capability used only for administrative
-- completion/closure of released manufacturing work. This is deny-by-default
-- and intentionally grants the capability to no existing or future employee.

begin;

alter table public.employees
  add column if not exists can_administrative_complete_close boolean;

update public.employees
set can_administrative_complete_close = false
where can_administrative_complete_close is null;

alter table public.employees
  alter column can_administrative_complete_close set default false,
  alter column can_administrative_complete_close set not null;

comment on column public.employees.can_administrative_complete_close is
  'Exact capability work-order.complete-close.override v1; never implied by role or another capability.';

-- Do not choose a winner when a legacy shop/auth binding is ambiguous. Abort the
-- entire migration without exposing any of the conflicting identifiers.
do $administrative_employee_binding_guard$
begin
  if exists (
    select 1
    from public.employees
    where auth_user_id is not null
    group by shop_id, auth_user_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'duplicate shop-scoped employee auth bindings require explicit remediation';
  end if;
end
$administrative_employee_binding_guard$;

-- Reassert the foundation invariant without adding a duplicate equivalent
-- index or rewriting a valid existing one.
create unique index if not exists employees_shop_auth_unique
  on public.employees (shop_id, auth_user_id)
  where auth_user_id is not null;

alter table public.employees enable row level security;
revoke all privileges on table public.employees from public, anon, authenticated;
revoke select (can_administrative_complete_close),
  insert (can_administrative_complete_close),
  update (can_administrative_complete_close),
  references (can_administrative_complete_close)
  on table public.employees from public, anon, authenticated;
grant all privileges on table public.employees to service_role;

-- Keep actor authorization, target eligibility, mutation, and audit insertion in
-- one database transaction. Row locks prevent either principal from being
-- revoked between the checks and the capability update. An audit insert error is
-- intentionally uncaught so PostgreSQL rolls back the preceding update.
create or replace function public.rb_set_administrative_completion_capability(
  p_shop_id uuid,
  p_employee_id uuid,
  p_actor_user_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  v_actor public.rb_shop_members%rowtype;
  v_target public.employees%rowtype;
  v_target_membership public.rb_shop_members%rowtype;
  v_binding_employee_id uuid;
  v_cardinality integer;
  v_enabled_before boolean;
begin
  if p_shop_id is null or p_employee_id is null or p_actor_user_id is null or p_enabled is null then
    raise exception using
      errcode = '22004',
      message = 'administrative completion capability arguments are required';
  end if;

  perform m.id
  from public.rb_shop_members as m
  where m.shop_id = p_shop_id
    and m.user_id = p_actor_user_id
  for update;
  get diagnostics v_cardinality = row_count;
  if v_cardinality <> 1 then
    raise exception using
      errcode = '42501',
      message = 'exact active owner or administrator actor membership required';
  end if;

  select m.*
  into strict v_actor
  from public.rb_shop_members as m
  where m.shop_id = p_shop_id
    and m.user_id = p_actor_user_id;
  if v_actor.id is null
     or v_actor.shop_id is distinct from p_shop_id
     or v_actor.user_id is distinct from p_actor_user_id
     or v_actor.is_active is distinct from true
     or (v_actor.role is distinct from 'owner' and v_actor.role is distinct from 'admin') then
    raise exception using
      errcode = '42501',
      message = 'exact active owner or administrator actor membership required';
  end if;

  perform e.id
  from public.employees as e
  where e.shop_id = p_shop_id
    and e.id = p_employee_id
  for update;
  get diagnostics v_cardinality = row_count;
  if v_cardinality <> 1 then
    raise exception using
      errcode = 'P0002',
      message = 'exact administrative completion employee target required';
  end if;

  select e.*
  into strict v_target
  from public.employees as e
  where e.shop_id = p_shop_id
    and e.id = p_employee_id;
  if v_target.id is null
     or v_target.id is distinct from p_employee_id
     or v_target.shop_id is distinct from p_shop_id then
    raise exception using
      errcode = 'P0002',
      message = 'exact administrative completion employee target required';
  end if;
  v_enabled_before := v_target.can_administrative_complete_close;

  if p_enabled then
    if v_target.is_active is distinct from true or v_target.auth_user_id is null then
      raise exception using
        errcode = '22023',
        message = 'active auth-linked administrative completion employee required';
    end if;

    perform e.id
    from public.employees as e
    where e.shop_id = p_shop_id
      and e.auth_user_id = v_target.auth_user_id
    for update;
    get diagnostics v_cardinality = row_count;
    if v_cardinality <> 1 then
      raise exception using
        errcode = '23505',
        message = 'administrative completion employee auth binding is ambiguous';
    end if;

    select e.id
    into strict v_binding_employee_id
    from public.employees as e
    where e.shop_id = p_shop_id
      and e.auth_user_id = v_target.auth_user_id;
    if v_binding_employee_id is distinct from p_employee_id then
      raise exception using
        errcode = '23505',
        message = 'administrative completion employee auth binding is ambiguous';
    end if;

    perform m.id
    from public.rb_shop_members as m
    where m.shop_id = p_shop_id
      and m.user_id = v_target.auth_user_id
    for update;
    get diagnostics v_cardinality = row_count;
    if v_cardinality <> 1 then
      raise exception using
        errcode = '42501',
        message = 'exact active owner or administrator target membership required';
    end if;

    select m.*
    into strict v_target_membership
    from public.rb_shop_members as m
    where m.shop_id = p_shop_id
      and m.user_id = v_target.auth_user_id;
    if v_target_membership.id is null
       or v_target_membership.shop_id is distinct from p_shop_id
       or v_target_membership.user_id is distinct from v_target.auth_user_id
       or v_target_membership.is_active is distinct from true
       or (
         v_target_membership.role is distinct from 'owner'
         and v_target_membership.role is distinct from 'admin'
       ) then
      raise exception using
        errcode = '42501',
        message = 'exact active owner or administrator target membership required';
    end if;
  end if;

  update public.employees
  set can_administrative_complete_close = p_enabled
  where shop_id = p_shop_id
    and id = p_employee_id
  returning * into strict v_target;

  insert into public.rb_audit_log (
    actor_user_id,
    actor_kind,
    action,
    target_type,
    target_id,
    shop_id,
    meta
  )
  values (
    p_actor_user_id,
    'user',
    'employee.administrative_completion_capability.updated',
    'employee',
    p_employee_id::text,
    p_shop_id,
    pg_catalog.jsonb_build_object(
      'capability_code', 'work-order.complete-close.override',
      'capability_version', 1,
      'enabled_before', v_enabled_before is true,
      'enabled_after', v_target.can_administrative_complete_close is true
    )
  );

  return pg_catalog.jsonb_build_object(
    'employee_id', v_target.id,
    'shop_id', v_target.shop_id,
    'capability_code', 'work-order.complete-close.override',
    'capability_version', 1,
    'enabled', v_target.can_administrative_complete_close is true
  );
end
$function$;

revoke all privileges on function public.rb_set_administrative_completion_capability(uuid, uuid, uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.rb_set_administrative_completion_capability(uuid, uuid, uuid, boolean)
  to service_role;

commit;
