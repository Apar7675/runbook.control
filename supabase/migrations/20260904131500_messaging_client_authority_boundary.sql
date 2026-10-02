-- F06: make authenticated messaging a narrow RPC authority boundary.
--
-- This migration is deliberately forward-only and does not rewrite, move, or
-- delete conversation/message history. It reconciles messaging_roster once as
-- the employee capability projection, replaces client ACLs/policies, and adds
-- hardened entrypoints whose actor is always derived from auth.uid().

alter table public.conversation_archives enable row level security;
alter table public.conversation_members enable row level security;
alter table public.conversations enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_reads enable row level security;
alter table public.messages enable row level security;
alter table public.messaging_roster enable row level security;

-- Remove every pre-existing policy on the messaging tables.  Several policies
-- in the imported schema had uncorrelated predicates such as
-- cm.conversation_id = cm.conversation_id.  Rebuilding the complete scoped set
-- avoids leaving one permissive policy as an alternate authorization path.
do $drop_messaging_policies$
declare
  policy_row record;
begin
  for policy_row in
    select p.tablename, p.policyname
    from pg_catalog.pg_policies as p
    where p.schemaname = 'public'
      and p.tablename = any (array[
        'conversation_archives',
        'conversation_members',
        'conversations',
        'message_reactions',
        'message_reads',
        'messages',
        'messaging_roster'
      ])
  loop
    execute pg_catalog.format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end
$drop_messaging_policies$;

-- Revoke all legacy table capabilities. Realtime needs SELECT on the two
-- streamed tables. During the expand/contract rollout, the currently shipped
-- Mobile client also needs one sender-bound INSERT and one self-bound DELETE;
-- both are restored narrowly below and remain protected by the same full
-- Mobile actor predicate as the new RPCs.
revoke all privileges on table public.conversation_archives from PUBLIC, anon, authenticated;
revoke all privileges on table public.conversation_members from PUBLIC, anon, authenticated;
revoke all privileges on table public.conversations from PUBLIC, anon, authenticated;
revoke all privileges on table public.message_reactions from PUBLIC, anon, authenticated;
revoke all privileges on table public.message_reads from PUBLIC, anon, authenticated;
revoke all privileges on table public.messages from PUBLIC, anon, authenticated;
revoke all privileges on table public.messaging_roster from PUBLIC, anon, authenticated;

-- Table-level REVOKE does not clear independently granted column privileges.
-- Remove those defensively before restoring the two table-level Realtime reads.
do $drop_messaging_column_grants$
declare
  column_row record;
begin
  for column_row in
    select source_column.table_name, source_column.column_name
    from information_schema.columns as source_column
    where source_column.table_schema = 'public'
      and source_column.table_name = any (array[
        'conversation_archives',
        'conversation_members',
        'conversations',
        'message_reactions',
        'message_reads',
        'messages',
        'messaging_roster'
      ])
    order by source_column.table_name, source_column.ordinal_position
  loop
    execute pg_catalog.format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.%2$I from PUBLIC, anon, authenticated',
      column_row.column_name,
      column_row.table_name
    );
  end loop;
end
$drop_messaging_column_grants$;

grant select on table public.messages to authenticated;
grant select on table public.message_reactions to authenticated;
grant insert (shop_id, conversation_id, sender_employee_id, body)
on table public.messages to authenticated;
grant delete on table public.conversation_archives to authenticated;
grant select (shop_id, conversation_id, employee_id)
on table public.conversation_archives to authenticated;

grant all privileges on table public.conversation_archives to service_role;
grant all privileges on table public.conversation_members to service_role;
grant all privileges on table public.conversations to service_role;
grant all privileges on table public.message_reactions to service_role;
grant all privileges on table public.message_reads to service_role;
grant all privileges on table public.messages to service_role;
grant all privileges on table public.messaging_roster to service_role;

-- The imported schema installed two AFTER INSERT timestamp triggers.  Retire the
-- duplicate id-only trigger and harden the retained exact shop/conversation
-- trigger without touching any conversation or message row.
drop trigger if exists trg_bump_conversation_updated_at on public.messages;
drop trigger if exists trg_rb_touch_convo_updated_at on public.messages;

create or replace function public.rb_touch_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
begin
  update public.conversations as conversation
  set updated_at = pg_catalog.clock_timestamp()
  where conversation.shop_id = new.shop_id
    and conversation.id = new.conversation_id;
  return new;
end
$function$;

create trigger trg_rb_touch_convo_updated_at
after insert on public.messages
for each row
execute function public.rb_touch_conversation_updated_at();

-- messaging_roster is an atomic projection of the authoritative employee
-- capability state. Keeping this in the database prevents a successful
-- employee mutation followed by a failed, separate roster publication.
create or replace function public.rb_sync_employee_messaging_roster()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
begin
  if tg_op = 'UPDATE' and old.shop_id is distinct from new.shop_id then
    delete from public.messaging_roster as roster
    where roster.shop_id = old.shop_id
      and roster.employee_id = old.id;
  end if;

  insert into public.messaging_roster (
    shop_id,
    employee_id,
    is_active
  )
  values (
    new.shop_id,
    new.id,
    new.is_active and new.can_messaging
  )
  on conflict (shop_id, employee_id)
  do update set is_active = excluded.is_active;

  return new;
end
$function$;

drop trigger if exists trg_rb_sync_employee_messaging_roster on public.employees;
create trigger trg_rb_sync_employee_messaging_roster
after insert or update of shop_id, is_active, can_messaging on public.employees
for each row
execute function public.rb_sync_employee_messaging_roster();

-- Project pre-existing employees once so installing the trigger does not strand
-- already-authorized users without a roster row. Future changes are atomic with
-- the employee INSERT/UPDATE that caused them.
insert into public.messaging_roster (
  shop_id,
  employee_id,
  is_active
)
select
  employee.shop_id,
  employee.id,
  employee.is_active and employee.can_messaging
from public.employees as employee
on conflict (shop_id, employee_id)
do update set is_active = excluded.is_active;

-- This is the database equivalent of Control's canonical full-access decision.
-- Grace, payment-required, suspended, canceled, past-due, and expired states
-- intentionally do not authorize remote messaging.
create or replace function public.rb_messaging_shop_has_full_remote_access(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select coalesce((
    select
      case
        when pg_catalog.lower(pg_catalog.btrim(coalesce(shop.deletion_status, 'active'))) = 'deleting'
          or shop.deletion_started_at is not null
          then false
        when pg_catalog.lower(pg_catalog.btrim(coalesce(shop.entitlement_override, ''))) = 'restricted'
          then false
        when pg_catalog.lower(pg_catalog.btrim(coalesce(shop.entitlement_override, ''))) = 'allow'
          then true
        when coalesce(shop.manual_billing_override, false)
          then pg_catalog.lower(pg_catalog.btrim(coalesce(shop.manual_billing_status, ''))) in (
            'trial_active',
            'trial_extended',
            'paid_active'
          )
        else
          pg_catalog.lower(pg_catalog.btrim(coalesce(shop.billing_status, ''))) = 'active'
          or (
            pg_catalog.lower(pg_catalog.btrim(coalesce(shop.billing_status, ''))) = 'trialing'
            and (
              shop.trial_ends_at is null
              or pg_catalog.statement_timestamp() <= shop.trial_ends_at
            )
          )
      end
    from public.rb_shops as shop
    where shop.id = p_shop_id
  ), false)
$function$;

create or replace function public.rb_messaging_actor_employee_id(p_shop_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
  actor_employee_ids uuid[];
begin
  if p_shop_id is null or auth.uid() is null then
    return null;
  end if;

  select pg_catalog.array_agg(e.id order by e.id)
    into actor_employee_ids
  from public.rb_shop_members as membership
  join public.employees as e
    on e.shop_id = membership.shop_id
   and e.auth_user_id = membership.user_id
   and e.is_active = true
   and e.runbook_access_enabled = true
   and e.mobile_access_enabled = true
   and e.can_messaging = true
  join public.messaging_roster as roster
    on roster.shop_id = e.shop_id
   and roster.employee_id = e.id
   and roster.is_active = true
  where membership.shop_id = p_shop_id
    and membership.user_id = auth.uid()
    and membership.is_active = true
    and public.rb_messaging_shop_has_full_remote_access(membership.shop_id);

  if pg_catalog.cardinality(coalesce(actor_employee_ids, array[]::uuid[])) <> 1 then
    return null;
  end if;

  actor_employee_id := actor_employee_ids[1];

  return actor_employee_id;
end
$function$;

-- RLS needs a side-effect-free nullable resolver so an unrelated tenant row
-- evaluates to false instead of aborting a query or Realtime authorization
-- check.  RPC entrypoints use this strict wrapper and always fail closed.
create or replace function public.rb_messaging_require_actor_employee_id(p_shop_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_actor_employee_id(p_shop_id);
  if actor_employee_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated active messaging actor required';
  end if;

  return actor_employee_id;
end
$function$;

-- Desktop has no delegated employee credential today. It may therefore use
-- messaging only when its claimed active employee is exactly the employee
-- bound to the verified Control bearer. The claimed id is an assertion, never
-- an authority input.
create or replace function public.rb_messaging_assert_actor_employee_id(
  p_shop_id uuid,
  p_asserted_employee_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);
  if p_asserted_employee_id is null or p_asserted_employee_id <> actor_employee_id then
    raise exception using
      errcode = '42501',
      message = 'desktop messaging sender is not bound to the authenticated employee';
  end if;

  return actor_employee_id;
end
$function$;

create or replace function public.rb_messaging_can_read_conversation(
  p_shop_id uuid,
  p_conversation_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_actor_employee_id(p_shop_id);

  return exists (
    select 1
    from public.conversations as conversation
    join public.conversation_members as membership
      on membership.shop_id = conversation.shop_id
     and membership.conversation_id = conversation.id
     and membership.employee_id = actor_employee_id
     and membership.is_active = true
    where conversation.shop_id = p_shop_id
      and conversation.id = p_conversation_id
      and conversation.is_active = true
      and conversation.deleted_at is null
  );
end
$function$;

create or replace function public.rb_messaging_can_read_message(
  p_shop_id uuid,
  p_conversation_id uuid,
  p_message_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select public.rb_messaging_can_read_conversation(p_shop_id, p_conversation_id)
    and exists (
      select 1
      from public.messages as message
      where message.shop_id = p_shop_id
        and message.conversation_id = p_conversation_id
        and message.id = p_message_id
        and message.deleted_at is null
    )
$function$;

create policy "rb_messaging_conversation_archives_select_actor"
on public.conversation_archives
as permissive
for select
to authenticated
using (
  employee_id = public.rb_messaging_actor_employee_id(shop_id)
  and public.rb_messaging_can_read_conversation(shop_id, conversation_id)
);

-- Expand-phase compatibility for the currently shipped Mobile unarchive path.
-- The later blocked contract artifact removes this policy and DELETE grant only
-- after minimum-version adoption is proven.
create policy "rb_messaging_conversation_archives_delete_actor_compat"
on public.conversation_archives
as permissive
for delete
to authenticated
using (
  employee_id = public.rb_messaging_actor_employee_id(shop_id)
  and public.rb_messaging_can_read_conversation(shop_id, conversation_id)
);

create policy "rb_messaging_conversation_members_select_member"
on public.conversation_members
as permissive
for select
to authenticated
using (
  public.rb_messaging_can_read_conversation(shop_id, conversation_id)
);

create policy "rb_messaging_conversations_select_member"
on public.conversations
as permissive
for select
to authenticated
using (
  public.rb_messaging_can_read_conversation(shop_id, id)
);

create policy "rb_messaging_message_reactions_select_member"
on public.message_reactions
as permissive
for select
to authenticated
using (
  public.rb_messaging_can_read_message(shop_id, conversation_id, message_id)
);

create policy "rb_messaging_message_reads_select_actor"
on public.message_reads
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations as conversation
    where conversation.id = message_reads.conversation_id
      and employee_id = public.rb_messaging_actor_employee_id(conversation.shop_id)
      and public.rb_messaging_can_read_conversation(
        conversation.shop_id,
        message_reads.conversation_id
      )
  )
);

create policy "rb_messaging_messages_select_member"
on public.messages
as permissive
for select
to authenticated
using (
  deleted_at is null
  and public.rb_messaging_can_read_message(shop_id, conversation_id, id)
);

-- Expand-phase compatibility for the currently shipped Mobile direct send.
-- Sender, membership, entitlement, and body limits remain database-enforced.
create policy "rb_messaging_messages_insert_actor_compat"
on public.messages
as permissive
for insert
to authenticated
with check (
  sender_employee_id = public.rb_messaging_actor_employee_id(shop_id)
  and public.rb_messaging_can_read_conversation(shop_id, conversation_id)
  and pg_catalog.btrim(body) <> ''
  and pg_catalog.char_length(pg_catalog.btrim(body)) <= 10000
);

create policy "rb_messaging_roster_select_active_actor_shop"
on public.messaging_roster
as permissive
for select
to authenticated
using (
  is_active = true
  and employee_id = public.rb_messaging_actor_employee_id(shop_id)
);

create or replace function public.rb_messaging_roster(p_shop_id uuid)
returns table(
  id uuid,
  shop_id uuid,
  display_name text,
  is_active boolean,
  avatar_url_256 text,
  avatar_url_512 text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
begin
  perform public.rb_messaging_require_actor_employee_id(p_shop_id);

  return query
  select
    employee.id,
    employee.shop_id,
    pg_catalog.left(employee.display_name, 200),
    employee.is_active,
    pg_catalog.left(employee.avatar_url_256, 2048),
    pg_catalog.left(employee.avatar_url_512, 2048)
  from public.messaging_roster as roster
  join public.employees as employee
    on employee.shop_id = roster.shop_id
   and employee.id = roster.employee_id
  where roster.shop_id = p_shop_id
    and roster.is_active = true
    and employee.is_active = true
    and employee.can_messaging = true
  order by employee.display_name, employee.id
  limit 500;
end
$function$;

create or replace function public.rb_messaging_find_dm(
  p_shop_id uuid,
  p_other_employee_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
  conversation_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);

  if p_other_employee_id is null or p_other_employee_id = actor_employee_id then
    raise exception using
      errcode = '22023',
      message = 'a distinct recipient is required';
  end if;

  -- Read lookup permits history with an employee who was later deactivated, but
  -- the recipient id must still belong to this exact shop.  Creation/send below
  -- applies the stronger active employee/roster/capability requirement.
  if not exists (
    select 1
    from public.employees as employee
    where employee.shop_id = p_shop_id
      and employee.id = p_other_employee_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'recipient must belong to the requested shop';
  end if;

  select conversation.id
    into conversation_id
  from public.conversations as conversation
  where conversation.shop_id = p_shop_id
    and conversation.type = 'dm'
    and conversation.is_active = true
    and conversation.deleted_at is null
    and exists (
      select 1
      from public.conversation_members as actor_membership
      where actor_membership.shop_id = conversation.shop_id
        and actor_membership.conversation_id = conversation.id
        and actor_membership.employee_id = actor_employee_id
        and actor_membership.is_active = true
    )
    and exists (
      select 1
      from public.conversation_members as recipient_membership
      where recipient_membership.shop_id = conversation.shop_id
        and recipient_membership.conversation_id = conversation.id
        and recipient_membership.employee_id = p_other_employee_id
        and recipient_membership.is_active = true
    )
    and (
      select pg_catalog.count(*)
      from public.conversation_members as exact_membership
      where exact_membership.shop_id = conversation.shop_id
        and exact_membership.conversation_id = conversation.id
    ) = 2
  order by conversation.created_at, conversation.id
  limit 1;

  return conversation_id;
end
$function$;

create or replace function public.rb_messaging_get_or_create_dm(
  p_shop_id uuid,
  p_other_employee_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
  conversation_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);

  if p_other_employee_id is null or p_other_employee_id = actor_employee_id then
    raise exception using
      errcode = '22023',
      message = 'a distinct recipient is required';
  end if;

  if not exists (
    select 1
    from public.employees as employee
    join public.messaging_roster as roster
      on roster.shop_id = employee.shop_id
     and roster.employee_id = employee.id
     and roster.is_active = true
    where employee.shop_id = p_shop_id
      and employee.id = p_other_employee_id
      and employee.is_active = true
      and employee.can_messaging = true
  ) then
    raise exception using
      errcode = '22023',
      message = 'active messaging recipient required';
  end if;

  -- Serialize only this unordered shop/employee pair.  The lock is held through
  -- the surrounding transaction, including rb_messaging_send_dm when called
  -- from that entrypoint.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'rb_messaging_dm:' || p_shop_id::text || ':' ||
      least(actor_employee_id::text, p_other_employee_id::text) || ':' ||
      greatest(actor_employee_id::text, p_other_employee_id::text),
      0
    )
  );

  conversation_id := public.rb_messaging_find_dm(p_shop_id, p_other_employee_id);
  if conversation_id is not null then
    return conversation_id;
  end if;

  insert into public.conversations (
    shop_id,
    type,
    title,
    created_by,
    created_by_employee_id,
    is_active,
    created_at,
    updated_at
  )
  values (
    p_shop_id,
    'dm',
    null,
    actor_employee_id,
    actor_employee_id,
    true,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  )
  returning id into conversation_id;

  insert into public.conversation_members (
    shop_id,
    conversation_id,
    employee_id,
    member_role,
    is_active,
    added_by_employee_id,
    joined_at,
    created_at
  )
  values
    (
      p_shop_id,
      conversation_id,
      actor_employee_id,
      'member',
      true,
      actor_employee_id,
      pg_catalog.clock_timestamp(),
      pg_catalog.clock_timestamp()
    ),
    (
      p_shop_id,
      conversation_id,
      p_other_employee_id,
      'member',
      true,
      actor_employee_id,
      pg_catalog.clock_timestamp(),
      pg_catalog.clock_timestamp()
    );

  return conversation_id;
end
$function$;

create or replace function public.rb_messaging_create_conversation(
  p_shop_id uuid,
  p_type text,
  p_title text,
  p_member_employee_ids uuid[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
  conversation_id uuid;
  final_members uuid[];
  other_members uuid[];
  final_title text;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);

  if pg_catalog.cardinality(coalesce(p_member_employee_ids, array[]::uuid[])) > 50 then
    raise exception using
      errcode = '22023',
      message = 'no more than 50 requested conversation members are allowed';
  end if;

  select pg_catalog.array_agg(distinct member_id)
    into final_members
  from pg_catalog.unnest(
    coalesce(p_member_employee_ids, array[]::uuid[])
  ) as requested(member_id)
  where member_id is not null;

  if not (
    actor_employee_id = any(coalesce(final_members, array[]::uuid[]))
  ) then
    final_members := pg_catalog.array_append(
      coalesce(final_members, array[]::uuid[]),
      actor_employee_id
    );
  end if;

  select pg_catalog.array_agg(member_id)
    into other_members
  from pg_catalog.unnest(final_members) as members(member_id)
  where member_id <> actor_employee_id;

  if pg_catalog.lower(coalesce(p_type, '')) = 'dm' then
    if pg_catalog.cardinality(coalesce(other_members, array[]::uuid[])) <> 1 then
      raise exception using
        errcode = '22023',
        message = 'a direct message requires exactly one recipient';
    end if;

    return public.rb_messaging_get_or_create_dm(p_shop_id, other_members[1]);
  end if;

  if pg_catalog.lower(coalesce(p_type, '')) <> 'group' then
    raise exception using
      errcode = '22023',
      message = 'conversation type must be dm or group';
  end if;

  if pg_catalog.cardinality(final_members) < 3 or pg_catalog.cardinality(final_members) > 50 then
    raise exception using
      errcode = '22023',
      message = 'a group requires 3 to 50 members including the creator';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(final_members) as requested(member_id)
    where not exists (
      select 1
      from public.employees as employee
      join public.messaging_roster as roster
        on roster.shop_id = employee.shop_id
       and roster.employee_id = employee.id
       and roster.is_active = true
      where employee.shop_id = p_shop_id
        and employee.id = requested.member_id
        and employee.is_active = true
        and employee.can_messaging = true
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'all conversation members must be active messaging roster employees';
  end if;

  final_title := nullif(pg_catalog.btrim(coalesce(p_title, '')), '');
  if final_title is null then
    select coalesce(
      nullif(
        pg_catalog.btrim(
          pg_catalog.left(
            pg_catalog.string_agg(
              nullif(pg_catalog.btrim(employee.display_name), ''),
              ', ' order by employee.display_name
            ),
            200
          )
        ),
        ''
      ),
      'Group'
    )
      into final_title
    from public.employees as employee
    where employee.shop_id = p_shop_id
      and employee.id = any(final_members);
  elsif pg_catalog.char_length(final_title) > 200 then
    raise exception using
      errcode = '22023',
      message = 'group title is too long';
  end if;

  insert into public.conversations (
    shop_id,
    type,
    title,
    created_by,
    created_by_employee_id,
    is_active,
    created_at,
    updated_at
  )
  values (
    p_shop_id,
    'group',
    final_title,
    actor_employee_id,
    actor_employee_id,
    true,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  )
  returning id into conversation_id;

  insert into public.conversation_members (
    shop_id,
    conversation_id,
    employee_id,
    member_role,
    is_active,
    added_by_employee_id,
    joined_at,
    created_at
  )
  select
    p_shop_id,
    conversation_id,
    member_id,
    'member',
    true,
    actor_employee_id,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  from pg_catalog.unnest(final_members) as members(member_id);

  return conversation_id;
end
$function$;

create or replace function public.rb_messaging_list_messages(
  p_shop_id uuid,
  p_conversation_id uuid,
  p_limit integer default 80
)
returns table(
  id uuid,
  shop_id uuid,
  conversation_id uuid,
  sender_employee_id uuid,
  sender_display_name text,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  bounded_limit integer;
begin
  if not public.rb_messaging_can_read_conversation(p_shop_id, p_conversation_id) then
    raise exception using
      errcode = '42501',
      message = 'active conversation membership required';
  end if;

  bounded_limit := greatest(1, least(coalesce(p_limit, 80), 200));

  return query
  select
    recent.id,
    recent.shop_id,
    recent.conversation_id,
    recent.sender_employee_id,
    pg_catalog.left(employee.display_name, 200),
    pg_catalog.left(recent.body, 10000),
    recent.created_at,
    recent.edited_at,
    recent.deleted_at
  from (
    select message.*
    from public.messages as message
    where message.shop_id = p_shop_id
      and message.conversation_id = p_conversation_id
      and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit bounded_limit
  ) as recent
  join public.employees as employee
    on employee.shop_id = recent.shop_id
   and employee.id = recent.sender_employee_id
  order by recent.created_at, recent.id;
end
$function$;

create or replace function public.rb_messaging_send_message(
  p_shop_id uuid,
  p_conversation_id uuid,
  p_body text
)
returns table(
  id uuid,
  shop_id uuid,
  conversation_id uuid,
  sender_employee_id uuid,
  body text,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
  normalized_body text;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);
  if not public.rb_messaging_can_read_conversation(p_shop_id, p_conversation_id) then
    raise exception using
      errcode = '42501',
      message = 'active conversation membership required';
  end if;

  normalized_body := pg_catalog.btrim(coalesce(p_body, ''));
  if normalized_body = '' or pg_catalog.char_length(normalized_body) > 10000 then
    raise exception using
      errcode = '22023',
      message = 'message body must contain 1 to 10000 characters';
  end if;

  delete from public.conversation_archives as archive
  where archive.shop_id = p_shop_id
    and archive.conversation_id = p_conversation_id
    and archive.employee_id = actor_employee_id;

  return query
  insert into public.messages as message (
    shop_id,
    conversation_id,
    sender_employee_id,
    body,
    created_at
  )
  values (
    p_shop_id,
    p_conversation_id,
    actor_employee_id,
    normalized_body,
    pg_catalog.clock_timestamp()
  )
  returning
    message.id,
    message.shop_id,
    message.conversation_id,
    message.sender_employee_id,
    message.body,
    message.created_at;
end
$function$;

create or replace function public.rb_messaging_send_dm(
  p_shop_id uuid,
  p_other_employee_id uuid,
  p_body text
)
returns table(conversation_id uuid, message_id uuid)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
  target_conversation_id uuid;
  inserted_message_id uuid;
  normalized_body text;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);
  normalized_body := pg_catalog.btrim(coalesce(p_body, ''));

  if normalized_body = '' or pg_catalog.char_length(normalized_body) > 10000 then
    raise exception using
      errcode = '22023',
      message = 'message body must contain 1 to 10000 characters';
  end if;

  -- Conversation resolution, membership insertion, and message insertion share
  -- this RPC transaction.  A failure cannot leave a half-created direct message.
  target_conversation_id := public.rb_messaging_get_or_create_dm(
    p_shop_id,
    p_other_employee_id
  );

  delete from public.conversation_archives as archive
  where archive.shop_id = p_shop_id
    and archive.conversation_id = target_conversation_id
    and archive.employee_id = actor_employee_id;

  insert into public.messages (
    shop_id,
    conversation_id,
    sender_employee_id,
    body,
    created_at
  )
  values (
    p_shop_id,
    target_conversation_id,
    actor_employee_id,
    normalized_body,
    pg_catalog.clock_timestamp()
  )
  returning id into inserted_message_id;

  return query select target_conversation_id, inserted_message_id;
end
$function$;

create or replace function public.rb_messaging_conversation_header(
  p_shop_id uuid,
  p_conversation_id uuid
)
returns table(
  conversation_id uuid,
  type text,
  display_title text,
  avatar_initials text,
  avatar_url_256 text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);
  if not public.rb_messaging_can_read_conversation(p_shop_id, p_conversation_id) then
    raise exception using
      errcode = '42501',
      message = 'active conversation membership required';
  end if;

  return query
  select
    conversation.id,
    conversation.type,
    pg_catalog.left(case
      when conversation.type = 'dm' then coalesce(partner.display_name, 'Direct Message')
      else coalesce(
        nullif(pg_catalog.btrim(conversation.title), ''),
        member_names.names,
        'Group'
      )
    end, 200),
    pg_catalog.upper(pg_catalog.left(
      case
        when conversation.type = 'dm' then coalesce(partner.display_name, 'DM')
        else coalesce(
          nullif(pg_catalog.btrim(conversation.title), ''),
          member_names.names,
          'G'
        )
      end,
      2
    )),
    case
      when conversation.type = 'dm' then pg_catalog.left(partner.avatar_url_256, 2048)
      else null
    end
  from public.conversations as conversation
  left join lateral (
    select employee.display_name, employee.avatar_url_256
    from public.conversation_members as membership
    join public.employees as employee
      on employee.shop_id = membership.shop_id
     and employee.id = membership.employee_id
    where membership.shop_id = conversation.shop_id
      and membership.conversation_id = conversation.id
      and membership.employee_id <> actor_employee_id
      and membership.is_active = true
    order by employee.display_name, employee.id
    limit 1
  ) as partner on true
  left join lateral (
    select pg_catalog.left(
      pg_catalog.string_agg(
        pg_catalog.left(employee.display_name, 100),
        ', ' order by employee.display_name
      ),
      200
    ) as names
    from public.conversation_members as membership
    join public.employees as employee
      on employee.shop_id = membership.shop_id
     and employee.id = membership.employee_id
    where membership.shop_id = conversation.shop_id
      and membership.conversation_id = conversation.id
      and membership.is_active = true
  ) as member_names on true
  where conversation.shop_id = p_shop_id
    and conversation.id = p_conversation_id
    and conversation.is_active = true
    and conversation.deleted_at is null;
end
$function$;

create or replace function public.rb_messaging_inbox(p_shop_id uuid)
returns table(
  conversation_id uuid,
  shop_id uuid,
  type text,
  title text,
  avatar_initials text,
  avatar_url_256 text,
  updated_at timestamptz,
  last_message_body text,
  last_message_at timestamptz,
  unread_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);

  return query
  select
    conversation.id,
    conversation.shop_id,
    conversation.type,
    header.display_title,
    header.avatar_initials,
    header.avatar_url_256,
    coalesce(conversation.updated_at, conversation.created_at),
    pg_catalog.left(latest.body, 10000),
    latest.created_at,
    (
      select pg_catalog.count(*)
      from public.messages as unread_message
      where unread_message.shop_id = conversation.shop_id
        and unread_message.conversation_id = conversation.id
        and unread_message.deleted_at is null
        and unread_message.sender_employee_id <> actor_employee_id
        and unread_message.created_at > coalesce(
          read_state.last_read_at,
          '1970-01-01'::timestamptz
        )
    )::bigint
  from public.conversations as conversation
  join public.conversation_members as actor_membership
    on actor_membership.shop_id = conversation.shop_id
   and actor_membership.conversation_id = conversation.id
   and actor_membership.employee_id = actor_employee_id
   and actor_membership.is_active = true
  join lateral public.rb_messaging_conversation_header(
    conversation.shop_id,
    conversation.id
  ) as header on true
  left join lateral (
    select message.body, message.created_at
    from public.messages as message
    where message.shop_id = conversation.shop_id
      and message.conversation_id = conversation.id
      and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit 1
  ) as latest on true
  left join public.message_reads as read_state
    on read_state.conversation_id = conversation.id
   and read_state.employee_id = actor_employee_id
  where conversation.shop_id = p_shop_id
    and conversation.is_active = true
    and conversation.deleted_at is null
    and not exists (
      select 1
      from public.conversation_archives as archive
      where archive.shop_id = conversation.shop_id
        and archive.conversation_id = conversation.id
        and archive.employee_id = actor_employee_id
    )
  order by coalesce(conversation.updated_at, conversation.created_at) desc,
           conversation.id
  limit 500;
end
$function$;

create or replace function public.rb_messaging_archived_inbox(p_shop_id uuid)
returns table(
  conversation_id uuid,
  archived_at timestamptz,
  title text,
  last_message_body text,
  last_message_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);

  return query
  select
    archive.conversation_id,
    archive.archived_at,
    header.display_title,
    pg_catalog.left(latest.body, 10000),
    latest.created_at
  from public.conversation_archives as archive
  join public.conversations as conversation
    on conversation.shop_id = archive.shop_id
   and conversation.id = archive.conversation_id
   and conversation.is_active = true
   and conversation.deleted_at is null
  join public.conversation_members as actor_membership
    on actor_membership.shop_id = conversation.shop_id
   and actor_membership.conversation_id = conversation.id
   and actor_membership.employee_id = actor_employee_id
   and actor_membership.is_active = true
  join lateral public.rb_messaging_conversation_header(
    conversation.shop_id,
    conversation.id
  ) as header on true
  left join lateral (
    select message.body, message.created_at
    from public.messages as message
    where message.shop_id = conversation.shop_id
      and message.conversation_id = conversation.id
      and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit 1
  ) as latest on true
  where archive.shop_id = p_shop_id
    and archive.employee_id = actor_employee_id
  order by archive.archived_at desc, archive.conversation_id
  limit 500;
end
$function$;

create or replace function public.rb_messaging_dm_summary(p_shop_id uuid)
returns table(
  conversation_id uuid,
  recipient_employee_id uuid,
  recipient_display_name text,
  last_message_id uuid,
  last_message_body text,
  last_message_created_at timestamptz,
  last_sender_employee_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);

  return query
  select
    conversation.id,
    recipient.employee_id,
    pg_catalog.left(recipient.display_name, 200),
    latest.id,
    pg_catalog.left(latest.body, 10000),
    latest.created_at,
    latest.sender_employee_id
  from public.conversations as conversation
  join public.conversation_members as actor_membership
    on actor_membership.shop_id = conversation.shop_id
   and actor_membership.conversation_id = conversation.id
   and actor_membership.employee_id = actor_employee_id
   and actor_membership.is_active = true
  join lateral (
    select membership.employee_id, employee.display_name
    from public.conversation_members as membership
    join public.employees as employee
      on employee.shop_id = membership.shop_id
     and employee.id = membership.employee_id
    where membership.shop_id = conversation.shop_id
      and membership.conversation_id = conversation.id
      and membership.employee_id <> actor_employee_id
      and membership.is_active = true
    order by employee.id
    limit 1
  ) as recipient on true
  join lateral (
    select message.id, message.body, message.created_at, message.sender_employee_id
    from public.messages as message
    where message.shop_id = conversation.shop_id
      and message.conversation_id = conversation.id
      and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit 1
  ) as latest on true
  where conversation.shop_id = p_shop_id
    and conversation.type = 'dm'
    and conversation.is_active = true
    and conversation.deleted_at is null
    and (
      select pg_catalog.count(*)
      from public.conversation_members as exact_membership
      where exact_membership.shop_id = conversation.shop_id
        and exact_membership.conversation_id = conversation.id
    ) = 2
  order by latest.created_at desc, conversation.id
  limit 500;
end
$function$;

create or replace function public.rb_messaging_mark_read(
  p_shop_id uuid,
  p_conversation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);
  if not public.rb_messaging_can_read_conversation(p_shop_id, p_conversation_id) then
    raise exception using
      errcode = '42501',
      message = 'active conversation membership required';
  end if;

  insert into public.message_reads (conversation_id, employee_id, last_read_at)
  values (p_conversation_id, actor_employee_id, pg_catalog.clock_timestamp())
  on conflict (conversation_id, employee_id)
  do update set last_read_at = excluded.last_read_at;
end
$function$;

create or replace function public.rb_messaging_archive_for_me(
  p_shop_id uuid,
  p_conversation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);
  if not public.rb_messaging_can_read_conversation(p_shop_id, p_conversation_id) then
    raise exception using
      errcode = '42501',
      message = 'active conversation membership required';
  end if;

  insert into public.conversation_archives (
    shop_id,
    conversation_id,
    employee_id,
    archived_at
  )
  values (
    p_shop_id,
    p_conversation_id,
    actor_employee_id,
    pg_catalog.clock_timestamp()
  )
  on conflict (shop_id, conversation_id, employee_id)
  do update set archived_at = excluded.archived_at;
end
$function$;

create or replace function public.rb_messaging_unarchive_for_me(
  p_shop_id uuid,
  p_conversation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);
  if not public.rb_messaging_can_read_conversation(p_shop_id, p_conversation_id) then
    raise exception using
      errcode = '42501',
      message = 'active conversation membership required';
  end if;

  delete from public.conversation_archives as archive
  where archive.shop_id = p_shop_id
    and archive.conversation_id = p_conversation_id
    and archive.employee_id = actor_employee_id;
end
$function$;

create or replace function public.rb_messaging_reaction_summary(
  p_shop_id uuid,
  p_conversation_id uuid
)
returns table(
  message_id uuid,
  emoji text,
  count bigint,
  my_reacted boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);
  if not public.rb_messaging_can_read_conversation(p_shop_id, p_conversation_id) then
    raise exception using
      errcode = '42501',
      message = 'active conversation membership required';
  end if;

  return query
  select
    reaction.message_id,
    pg_catalog.left(reaction.emoji, 32),
    pg_catalog.count(*)::bigint,
    pg_catalog.bool_or(reaction.employee_id = actor_employee_id)
  from public.message_reactions as reaction
  join public.messages as message
    on message.shop_id = reaction.shop_id
   and message.conversation_id = reaction.conversation_id
   and message.id = reaction.message_id
   and message.deleted_at is null
  where reaction.shop_id = p_shop_id
    and reaction.conversation_id = p_conversation_id
  group by reaction.message_id, pg_catalog.left(reaction.emoji, 32)
  order by reaction.message_id, pg_catalog.left(reaction.emoji, 32)
  limit 5000;
end
$function$;

create or replace function public.rb_messaging_toggle_reaction(
  p_shop_id uuid,
  p_conversation_id uuid,
  p_message_id uuid,
  p_emoji text
)
returns table(did_add boolean)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
  normalized_emoji text;
  affected_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(p_shop_id);
  if not public.rb_messaging_can_read_message(
    p_shop_id,
    p_conversation_id,
    p_message_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'active conversation membership required';
  end if;

  normalized_emoji := pg_catalog.btrim(coalesce(p_emoji, ''));
  if normalized_emoji = '' or pg_catalog.char_length(normalized_emoji) > 32 then
    raise exception using
      errcode = '22023',
      message = 'reaction must contain 1 to 32 characters';
  end if;

  delete from public.message_reactions as reaction
  where reaction.shop_id = p_shop_id
    and reaction.conversation_id = p_conversation_id
    and reaction.message_id = p_message_id
    and reaction.employee_id = actor_employee_id
    and reaction.emoji = normalized_emoji
  returning reaction.id into affected_id;

  if affected_id is not null then
    return query select false;
    return;
  end if;

  insert into public.message_reactions (
    shop_id,
    conversation_id,
    message_id,
    employee_id,
    emoji,
    created_at
  )
  values (
    p_shop_id,
    p_conversation_id,
    p_message_id,
    actor_employee_id,
    normalized_emoji,
    pg_catalog.clock_timestamp()
  )
  on conflict (shop_id, message_id, employee_id, emoji) do nothing
  returning id into affected_id;

  return query select affected_id is not null;
end
$function$;

-- Hardened expand-phase wrappers preserve the exact RPC shapes used by the
-- currently shipped Mobile client. They delegate immediately to the new actor-
-- derived functions and do not retain any legacy authorization logic.
create or replace function public.get_inbox(_shop_id uuid)
returns table(
  conversation_id uuid,
  shop_id uuid,
  type text,
  title text,
  avatar_initials text,
  avatar_url_256 text,
  updated_at timestamptz,
  last_message_body text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select * from public.rb_messaging_inbox(_shop_id)
$function$;

create or replace function public.get_conversation_header(
  _shop_id uuid,
  _conversation_id uuid
)
returns table(
  conversation_id uuid,
  type text,
  display_title text,
  avatar_initials text,
  avatar_url_256 text
)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select *
  from public.rb_messaging_conversation_header(_shop_id, _conversation_id)
$function$;

create or replace function public.get_archived_inbox(_shop_id uuid)
returns table(
  conversation_id uuid,
  archived_at timestamptz,
  title text,
  last_message_body text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select * from public.rb_messaging_archived_inbox(_shop_id)
$function$;

create or replace function public.archive_conversation_for_me(
  _shop_id uuid,
  _conversation_id uuid
)
returns void
language sql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select public.rb_messaging_archive_for_me(_shop_id, _conversation_id)
$function$;

create or replace function public.create_conversation(
  _shop_id uuid,
  _type text,
  _title text,
  _member_employee_ids uuid[]
)
returns uuid
language sql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select public.rb_messaging_create_conversation(
    _shop_id,
    _type,
    _title,
    _member_employee_ids
  )
$function$;

create or replace function public.get_or_create_dm(
  _employee_a uuid,
  _employee_b uuid,
  _shop_id uuid
)
returns table(conversation_id uuid)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  actor_employee_id uuid;
  other_employee_id uuid;
begin
  actor_employee_id := public.rb_messaging_require_actor_employee_id(_shop_id);
  if _employee_a = actor_employee_id and _employee_b <> actor_employee_id then
    other_employee_id := _employee_b;
  elsif _employee_b = actor_employee_id and _employee_a <> actor_employee_id then
    other_employee_id := _employee_a;
  else
    raise exception using
      errcode = '42501',
      message = 'legacy direct-message participants are not bound to the authenticated employee';
  end if;

  return query
  select public.rb_messaging_get_or_create_dm(_shop_id, other_employee_id);
end
$function$;

create or replace function public.get_or_create_dm(
  _shop_id uuid,
  _other_employee_id uuid
)
returns uuid
language sql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select public.rb_messaging_get_or_create_dm(_shop_id, _other_employee_id)
$function$;

create or replace function public.mark_conversation_read_now(_conversation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  target_shop_id uuid;
begin
  select conversation.shop_id
    into target_shop_id
  from public.conversations as conversation
  where conversation.id = _conversation_id
    and public.rb_messaging_can_read_conversation(
      conversation.shop_id,
      conversation.id
    );

  if target_shop_id is null then
    raise exception using
      errcode = '22023',
      message = 'conversation not found';
  end if;

  perform public.rb_messaging_mark_read(target_shop_id, _conversation_id);
end
$function$;

-- The current shipped client supplies both named arguments even though an old
-- dump contained only the one-argument overload. Preserve its actual wire shape.
create or replace function public.mark_conversation_read_now(
  _shop_id uuid,
  _conversation_id uuid
)
returns void
language sql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select public.rb_messaging_mark_read(_shop_id, _conversation_id)
$function$;

create or replace function public.get_reaction_summary_for_conversation(
  _shop_id uuid,
  _conversation_id uuid
)
returns table(
  message_id uuid,
  emoji text,
  count integer,
  my_reacted boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select summary.message_id, summary.emoji, summary.count::integer, summary.my_reacted
  from public.rb_messaging_reaction_summary(_shop_id, _conversation_id) as summary
$function$;

create or replace function public.toggle_my_message_reaction(
  _shop_id uuid,
  _conversation_id uuid,
  _message_id uuid,
  _emoji text
)
returns table(did_add boolean)
language sql
volatile
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select result.did_add
  from public.rb_messaging_toggle_reaction(
    _shop_id,
    _conversation_id,
    _message_id,
    _emoji
  ) as result
$function$;

-- Retire unsafe surfaces conditionally. Production schemas can legitimately
-- lack one of these historical signatures; absence must not abort the migration.
do $retire_unsafe_messaging_functions$
declare
  signature text;
begin
  foreach signature in array array[
    'public.archive_conversation(uuid,uuid)',
    'public.create_conversation_with_members(uuid,text,text,uuid[])',
    'public.get_conversation_titles(uuid)',
    'public.get_unread_counts(uuid)',
    'public.rename_group_conversation(uuid,uuid,text)',
    'public.my_roster_active(uuid)',
    'public.rb_is_active_in_messaging(uuid)',
    'public.rb_is_conversation_member(uuid,uuid)',
    'public.rb_me_roster_active(uuid)',
    'public.bump_conversation_updated_at()',
    'public.conversations_title_check()',
    'public.rb_touch_conversation_updated_at()'
  ]
  loop
    if pg_catalog.to_regprocedure(signature) is not null then
      execute 'revoke all privileges on function ' || signature ||
        ' from PUBLIC, anon, authenticated, service_role';
    end if;
  end loop;
end
$retire_unsafe_messaging_functions$;

-- CREATE OR REPLACE retains ACLs. Reset every new signature before granting
-- the exact supported surface. Actor and projection helpers remain private.
revoke all privileges on function public.rb_sync_employee_messaging_roster() from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_shop_has_full_remote_access(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_actor_employee_id(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_require_actor_employee_id(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_assert_actor_employee_id(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_can_read_conversation(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_can_read_message(uuid, uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_roster(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_find_dm(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_get_or_create_dm(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_create_conversation(uuid, text, text, uuid[]) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_list_messages(uuid, uuid, integer) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_send_message(uuid, uuid, text) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_send_dm(uuid, uuid, text) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_conversation_header(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_inbox(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_archived_inbox(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_dm_summary(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_mark_read(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_archive_for_me(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_unarchive_for_me(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_reaction_summary(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.rb_messaging_toggle_reaction(uuid, uuid, uuid, text) from PUBLIC, anon, authenticated, service_role;

grant execute on function public.rb_messaging_shop_has_full_remote_access(uuid) to service_role;
-- The nullable resolver is intentionally callable by authenticated because the
-- expand-phase INSERT/DELETE RLS policies evaluate it as the querying role.
-- It exposes only that caller's own employee id (or NULL) after the complete
-- membership/capability/roster/entitlement predicate.
grant execute on function public.rb_messaging_actor_employee_id(uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_require_actor_employee_id(uuid) to service_role;
grant execute on function public.rb_messaging_assert_actor_employee_id(uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_can_read_conversation(uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_can_read_message(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_roster(uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_find_dm(uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_get_or_create_dm(uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_create_conversation(uuid, text, text, uuid[]) to authenticated, service_role;
grant execute on function public.rb_messaging_list_messages(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.rb_messaging_send_message(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.rb_messaging_send_dm(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.rb_messaging_conversation_header(uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_inbox(uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_archived_inbox(uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_dm_summary(uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_mark_read(uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_archive_for_me(uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_unarchive_for_me(uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_reaction_summary(uuid, uuid) to authenticated, service_role;
grant execute on function public.rb_messaging_toggle_reaction(uuid, uuid, uuid, text) to authenticated, service_role;

-- Expand-phase compatibility ACLs. service_role is intentionally excluded so
-- server code cannot accidentally retain a retired entrypoint dependency.
revoke all privileges on function public.get_inbox(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.get_conversation_header(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.get_archived_inbox(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.archive_conversation_for_me(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.create_conversation(uuid, text, text, uuid[]) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.get_or_create_dm(uuid, uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.get_or_create_dm(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.mark_conversation_read_now(uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.mark_conversation_read_now(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.get_reaction_summary_for_conversation(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke all privileges on function public.toggle_my_message_reaction(uuid, uuid, uuid, text) from PUBLIC, anon, authenticated, service_role;

grant execute on function public.get_inbox(uuid) to authenticated;
grant execute on function public.get_conversation_header(uuid, uuid) to authenticated;
grant execute on function public.get_archived_inbox(uuid) to authenticated;
grant execute on function public.archive_conversation_for_me(uuid, uuid) to authenticated;
grant execute on function public.create_conversation(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.get_or_create_dm(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_or_create_dm(uuid, uuid) to authenticated;
grant execute on function public.mark_conversation_read_now(uuid) to authenticated;
grant execute on function public.mark_conversation_read_now(uuid, uuid) to authenticated;
grant execute on function public.get_reaction_summary_for_conversation(uuid, uuid) to authenticated;
grant execute on function public.toggle_my_message_reaction(uuid, uuid, uuid, text) to authenticated;
