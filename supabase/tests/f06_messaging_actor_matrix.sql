-- Run only after all migrations in an empty/disposable Supabase database.
-- Every identifier and row below is synthetic, the test is transactional, and
-- the final ROLLBACK removes all fixtures. Never point this at a live project.
-- Example: psql "$RUNBOOK_DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1
--   -f supabase/tests/f06_messaging_actor_matrix.sql

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'f06-active@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'f06-recipient@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'f06-inactive-membership@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'f06-inactive-employee@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000105', 'authenticated', 'authenticated', 'f06-no-runbook@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000106', 'authenticated', 'authenticated', 'f06-no-mobile@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000107', 'authenticated', 'authenticated', 'f06-no-messaging@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000108', 'authenticated', 'authenticated', 'f06-inactive-roster@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000109', 'authenticated', 'authenticated', 'f06-restricted-shop@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000110', 'authenticated', 'authenticated', 'f06-deleting-shop@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000111', 'authenticated', 'authenticated', 'f06-other-shop@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000112', 'authenticated', 'authenticated', 'f06-expired-shop@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000113', 'authenticated', 'authenticated', 'f06-no-membership@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000000', 'f0600000-0000-4000-8000-000000000114', 'authenticated', 'authenticated', 'f06-no-roster@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now());

insert into public.rb_shops (
  id, name, billing_status, trial_ends_at, entitlement_override,
  manual_billing_override, manual_billing_status, deletion_status,
  deletion_started_at
)
values
  ('f0600000-0000-4000-8000-000000000001', 'F06 Synthetic Active Shop', 'active', null, null, false, null, 'active', null),
  ('f0600000-0000-4000-8000-000000000002', 'F06 Synthetic Other Shop', 'active', null, null, false, null, 'active', null),
  ('f0600000-0000-4000-8000-000000000003', 'F06 Synthetic Restricted Shop', 'active', null, 'restricted', false, null, 'active', null),
  ('f0600000-0000-4000-8000-000000000004', 'F06 Synthetic Deleting Shop', 'active', null, 'allow', false, null, 'deleting', pg_catalog.now()),
  ('f0600000-0000-4000-8000-000000000005', 'F06 Synthetic Expired Shop', 'expired', null, null, false, null, 'active', null),
  ('f0600000-0000-4000-8000-000000000006', 'F06 Synthetic Override Allow Shop', 'expired', null, 'allow', false, null, 'active', null),
  ('f0600000-0000-4000-8000-000000000007', 'F06 Synthetic Manual Paid Shop', 'expired', null, null, true, 'paid_active', 'active', null),
  ('f0600000-0000-4000-8000-000000000008', 'F06 Synthetic Manual Suspended Shop', 'active', null, null, true, 'suspended', 'active', null),
  ('f0600000-0000-4000-8000-000000000009', 'F06 Synthetic Past Trial Shop', 'trialing', pg_catalog.now() - interval '1 day', null, false, null, 'active', null),
  ('f0600000-0000-4000-8000-000000000010', 'F06 Synthetic Future Trial Shop', 'trialing', pg_catalog.now() + interval '1 day', null, false, null, 'active', null);

do $entitlement_matrix$
begin
  if not public.rb_messaging_shop_has_full_remote_access('f0600000-0000-4000-8000-000000000001') then
    raise exception 'F06 active billing status was denied';
  end if;
  if public.rb_messaging_shop_has_full_remote_access('f0600000-0000-4000-8000-000000000003') then
    raise exception 'F06 restricted entitlement override was allowed';
  end if;
  if public.rb_messaging_shop_has_full_remote_access('f0600000-0000-4000-8000-000000000004') then
    raise exception 'F06 deleting shop bypassed denial via allow override';
  end if;
  if public.rb_messaging_shop_has_full_remote_access('f0600000-0000-4000-8000-000000000005') then
    raise exception 'F06 expired shop was allowed';
  end if;
  if not public.rb_messaging_shop_has_full_remote_access('f0600000-0000-4000-8000-000000000006') then
    raise exception 'F06 explicit allow override was denied';
  end if;
  if not public.rb_messaging_shop_has_full_remote_access('f0600000-0000-4000-8000-000000000007') then
    raise exception 'F06 manual paid-active shop was denied';
  end if;
  if public.rb_messaging_shop_has_full_remote_access('f0600000-0000-4000-8000-000000000008') then
    raise exception 'F06 manually suspended shop was allowed';
  end if;
  if public.rb_messaging_shop_has_full_remote_access('f0600000-0000-4000-8000-000000000009') then
    raise exception 'F06 expired trial was allowed';
  end if;
  if not public.rb_messaging_shop_has_full_remote_access('f0600000-0000-4000-8000-000000000010') then
    raise exception 'F06 future trial was denied';
  end if;
end
$entitlement_matrix$;

insert into public.rb_shop_members (id, shop_id, user_id, role, is_active)
values
  ('f0600000-0000-4000-8000-000000000301', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000101', 'member', true),
  ('f0600000-0000-4000-8000-000000000302', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000102', 'member', true),
  ('f0600000-0000-4000-8000-000000000303', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000103', 'member', false),
  ('f0600000-0000-4000-8000-000000000304', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000104', 'member', true),
  ('f0600000-0000-4000-8000-000000000305', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000105', 'member', true),
  ('f0600000-0000-4000-8000-000000000306', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000106', 'member', true),
  ('f0600000-0000-4000-8000-000000000307', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000107', 'member', true),
  ('f0600000-0000-4000-8000-000000000308', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000108', 'member', true),
  ('f0600000-0000-4000-8000-000000000309', 'f0600000-0000-4000-8000-000000000003', 'f0600000-0000-4000-8000-000000000109', 'member', true),
  ('f0600000-0000-4000-8000-000000000310', 'f0600000-0000-4000-8000-000000000004', 'f0600000-0000-4000-8000-000000000110', 'member', true),
  ('f0600000-0000-4000-8000-000000000311', 'f0600000-0000-4000-8000-000000000002', 'f0600000-0000-4000-8000-000000000111', 'member', true),
  ('f0600000-0000-4000-8000-000000000312', 'f0600000-0000-4000-8000-000000000005', 'f0600000-0000-4000-8000-000000000112', 'member', true),
  ('f0600000-0000-4000-8000-000000000314', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000114', 'member', true);

insert into public.employees (
  id, shop_id, auth_user_id, employee_code, display_name, role, is_active,
  runbook_access_enabled, mobile_access_enabled, can_messaging
)
values
  ('f0600000-0000-4000-8000-000000000201', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000101', 'F06-A', 'F06 Synthetic Actor', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000202', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000102', 'F06-B', 'F06 Synthetic Recipient', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000203', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000103', 'F06-C', 'F06 Synthetic Inactive Membership', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000204', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000104', 'F06-D', 'F06 Synthetic Inactive Employee', 'employee', false, true, true, true),
  ('f0600000-0000-4000-8000-000000000205', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000105', 'F06-E', 'F06 Synthetic No RunBook', 'employee', true, false, true, true),
  ('f0600000-0000-4000-8000-000000000206', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000106', 'F06-F', 'F06 Synthetic No Mobile', 'employee', true, true, false, true),
  ('f0600000-0000-4000-8000-000000000207', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000107', 'F06-G', 'F06 Synthetic No Messaging', 'employee', true, true, true, false),
  ('f0600000-0000-4000-8000-000000000208', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000108', 'F06-H', 'F06 Synthetic Inactive Roster', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000209', 'f0600000-0000-4000-8000-000000000003', 'f0600000-0000-4000-8000-000000000109', 'F06-I', 'F06 Synthetic Restricted Shop Actor', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000210', 'f0600000-0000-4000-8000-000000000004', 'f0600000-0000-4000-8000-000000000110', 'F06-J', 'F06 Synthetic Deleting Shop Actor', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000211', 'f0600000-0000-4000-8000-000000000002', 'f0600000-0000-4000-8000-000000000111', 'F06-K', 'F06 Synthetic Other Shop Actor', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000212', 'f0600000-0000-4000-8000-000000000005', 'f0600000-0000-4000-8000-000000000112', 'F06-L', 'F06 Synthetic Expired Shop Actor', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000213', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000113', 'F06-M', 'F06 Synthetic No Membership', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000214', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000114', 'F06-N', 'F06 Synthetic No Roster', 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000215', 'f0600000-0000-4000-8000-000000000001', null, 'F06-O', repeat('F06 Synthetic Long Member One ', 10), 'employee', true, true, true, true),
  ('f0600000-0000-4000-8000-000000000216', 'f0600000-0000-4000-8000-000000000001', null, 'F06-P', repeat('F06 Synthetic Long Member Two ', 10), 'employee', true, true, true, true);

-- Deliberately create inconsistent defense-in-depth fixtures after the atomic
-- trigger has projected every employee once.
update public.messaging_roster set is_active = true
where employee_id in (
  'f0600000-0000-4000-8000-000000000204',
  'f0600000-0000-4000-8000-000000000207'
);
update public.messaging_roster set is_active = false
where employee_id = 'f0600000-0000-4000-8000-000000000208';
delete from public.messaging_roster
where employee_id = 'f0600000-0000-4000-8000-000000000214';

do $roster_projection$
declare
  projected boolean;
begin
  update public.employees set can_messaging = false
  where id = 'f0600000-0000-4000-8000-000000000202';
  select is_active into projected from public.messaging_roster
  where shop_id = 'f0600000-0000-4000-8000-000000000001'
    and employee_id = 'f0600000-0000-4000-8000-000000000202';
  if projected is distinct from false then
    raise exception 'F06 employee capability update was not atomically projected';
  end if;

  update public.employees set can_messaging = true
  where id = 'f0600000-0000-4000-8000-000000000202';
  select is_active into projected from public.messaging_roster
  where shop_id = 'f0600000-0000-4000-8000-000000000001'
    and employee_id = 'f0600000-0000-4000-8000-000000000202';
  if projected is distinct from true then
    raise exception 'F06 employee capability restoration was not atomically projected';
  end if;
end
$roster_projection$;

insert into public.conversations (
  id, shop_id, type, title, created_by, created_by_employee_id, is_active
)
values
  ('f0600000-0000-4000-8000-000000000401', 'f0600000-0000-4000-8000-000000000001', 'dm', null, 'f0600000-0000-4000-8000-000000000201', 'f0600000-0000-4000-8000-000000000201', true),
  ('f0600000-0000-4000-8000-000000000402', 'f0600000-0000-4000-8000-000000000001', 'dm', null, 'f0600000-0000-4000-8000-000000000202', 'f0600000-0000-4000-8000-000000000202', true),
  ('f0600000-0000-4000-8000-000000000403', 'f0600000-0000-4000-8000-000000000002', 'dm', null, 'f0600000-0000-4000-8000-000000000211', 'f0600000-0000-4000-8000-000000000211', true);

insert into public.conversation_members (
  shop_id, conversation_id, employee_id, member_role, is_active,
  added_by_employee_id
)
values
  ('f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000401', 'f0600000-0000-4000-8000-000000000201', 'member', true, 'f0600000-0000-4000-8000-000000000201'),
  ('f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000401', 'f0600000-0000-4000-8000-000000000202', 'member', true, 'f0600000-0000-4000-8000-000000000201'),
  ('f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000402', 'f0600000-0000-4000-8000-000000000202', 'member', true, 'f0600000-0000-4000-8000-000000000202'),
  ('f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000402', 'f0600000-0000-4000-8000-000000000203', 'member', true, 'f0600000-0000-4000-8000-000000000202'),
  ('f0600000-0000-4000-8000-000000000002', 'f0600000-0000-4000-8000-000000000403', 'f0600000-0000-4000-8000-000000000211', 'member', true, 'f0600000-0000-4000-8000-000000000211');

insert into public.messages (id, shop_id, conversation_id, sender_employee_id, body)
values
  ('f0600000-0000-4000-8000-000000000501', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000401', 'f0600000-0000-4000-8000-000000000202', 'F06 synthetic visible message'),
  ('f0600000-0000-4000-8000-000000000502', 'f0600000-0000-4000-8000-000000000001', 'f0600000-0000-4000-8000-000000000402', 'f0600000-0000-4000-8000-000000000202', 'F06 synthetic hidden message'),
  ('f0600000-0000-4000-8000-000000000503', 'f0600000-0000-4000-8000-000000000002', 'f0600000-0000-4000-8000-000000000403', 'f0600000-0000-4000-8000-000000000211', 'F06 synthetic other-shop message');

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000101","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000101', true);
set local role authenticated;

do $active_actor$
declare
  first_dm uuid;
  second_dm uuid;
  legacy_dm uuid;
  sent_conversation uuid;
  sent_message uuid;
  direct_message uuid;
  group_conversation uuid;
  visible_count integer;
  actual_sender uuid;
  group_title text;
  group_title_length integer;
begin
  if public.rb_messaging_assert_actor_employee_id(
    'f0600000-0000-4000-8000-000000000001',
    'f0600000-0000-4000-8000-000000000201'
  ) <> 'f0600000-0000-4000-8000-000000000201' then
    raise exception 'F06 Desktop assertion did not return the bearer actor';
  end if;

  begin
    perform public.rb_messaging_assert_actor_employee_id(
      'f0600000-0000-4000-8000-000000000001',
      'f0600000-0000-4000-8000-000000000202'
    );
    raise exception 'F06 Desktop wrong-actor assertion was accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.messages (shop_id, conversation_id, sender_employee_id, body)
    values (
      'f0600000-0000-4000-8000-000000000001',
      'f0600000-0000-4000-8000-000000000401',
      'f0600000-0000-4000-8000-000000000202',
      'F06 unexpected spoofed sender'
    );
    raise exception 'F06 expand INSERT accepted a spoofed sender';
  exception
    when insufficient_privilege then null;
  end;

  insert into public.messages (shop_id, conversation_id, sender_employee_id, body)
  values (
    'f0600000-0000-4000-8000-000000000001',
    'f0600000-0000-4000-8000-000000000401',
    'f0600000-0000-4000-8000-000000000201',
    'F06 synthetic hardened legacy direct send'
  ) returning id into direct_message;
  if direct_message is null then
    raise exception 'F06 expand direct-send compatibility did not insert';
  end if;

  begin
    insert into public.messages (shop_id, conversation_id, sender_employee_id, body)
    values (
      'f0600000-0000-4000-8000-000000000001',
      'f0600000-0000-4000-8000-000000000401',
      'f0600000-0000-4000-8000-000000000201',
      repeat('x', 10001)
    );
    raise exception 'F06 expand INSERT accepted an overlong body';
  exception
    when insufficient_privilege then null;
  end;

  select public.rb_messaging_find_dm(
    'f0600000-0000-4000-8000-000000000001',
    'f0600000-0000-4000-8000-000000000202'
  ) into first_dm;
  select public.rb_messaging_get_or_create_dm(
    'f0600000-0000-4000-8000-000000000001',
    'f0600000-0000-4000-8000-000000000202'
  ) into second_dm;
  select conversation_id into legacy_dm
  from public.get_or_create_dm(
    'f0600000-0000-4000-8000-000000000201',
    'f0600000-0000-4000-8000-000000000202',
    'f0600000-0000-4000-8000-000000000001'
  );
  if first_dm <> 'f0600000-0000-4000-8000-000000000401'
     or second_dm <> first_dm
     or legacy_dm <> first_dm then
    raise exception 'F06 DM lookup/create compatibility is not idempotent';
  end if;

  select result.conversation_id, result.message_id
    into sent_conversation, sent_message
  from public.rb_messaging_send_dm(
    'f0600000-0000-4000-8000-000000000001',
    'f0600000-0000-4000-8000-000000000202',
    'F06 synthetic actor-bound send'
  ) as result;
  if sent_conversation <> first_dm or sent_message is null then
    raise exception 'F06 atomic send returned an unexpected result';
  end if;

  select listed.sender_employee_id into actual_sender
  from public.rb_messaging_list_messages(
    'f0600000-0000-4000-8000-000000000001', first_dm, 200
  ) as listed
  where listed.id = sent_message;
  if actual_sender <> 'f0600000-0000-4000-8000-000000000201' then
    raise exception 'F06 send was not bound to the authenticated actor';
  end if;

  select pg_catalog.count(*) into visible_count from public.messages;
  if visible_count <> 3 then
    raise exception 'F06 direct SELECT leaked/omitted messages: %', visible_count;
  end if;

  if not exists (select 1 from public.get_inbox('f0600000-0000-4000-8000-000000000001')) then
    raise exception 'F06 hardened get_inbox compatibility returned no visible DM';
  end if;

  begin
    perform 1 from public.rb_messaging_list_messages(
      'f0600000-0000-4000-8000-000000000001',
      'f0600000-0000-4000-8000-000000000402',
      20
    );
    raise exception 'F06 actor read a conversation without exact membership';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.rb_messaging_find_dm(
      'f0600000-0000-4000-8000-000000000001',
      'f0600000-0000-4000-8000-000000000211'
    );
    raise exception 'F06 actor selected a recipient from another shop';
  exception
    when invalid_parameter_value then null;
  end;

  perform public.rb_messaging_archive_for_me(
    'f0600000-0000-4000-8000-000000000001', first_dm
  );
  delete from public.conversation_archives
  where shop_id = 'f0600000-0000-4000-8000-000000000001'
    and conversation_id = first_dm
    and employee_id = 'f0600000-0000-4000-8000-000000000201';
  if exists (
    select 1 from public.rb_messaging_archived_inbox(
      'f0600000-0000-4000-8000-000000000001'
    )
  ) then
    raise exception 'F06 hardened legacy archive DELETE did not unarchive';
  end if;

  group_conversation := public.rb_messaging_create_conversation(
    'f0600000-0000-4000-8000-000000000001',
    'group',
    '   ',
    array[
      'f0600000-0000-4000-8000-000000000201'::uuid,
      'f0600000-0000-4000-8000-000000000215'::uuid,
      'f0600000-0000-4000-8000-000000000216'::uuid
    ]
  );
  select conversation.title into group_title
  from public.conversations as conversation
  where conversation.shop_id = 'f0600000-0000-4000-8000-000000000001'
    and conversation.id = group_conversation;
  group_title_length := pg_catalog.char_length(group_title);
  if nullif(pg_catalog.btrim(group_title), '') is null
     or group_title_length > 200 then
    raise exception 'F06 generated blank group title was empty or exceeded its bound: %', group_title_length;
  end if;
end
$active_actor$;

reset role;

-- Each denied actor has one isolated authority defect (plus the deliberately
-- inconsistent roster fixtures above) and must fail through the same strict RPC.
select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000103","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000103', true);
set local role authenticated;
do $inactive_membership$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'inactive membership allowed';
  exception when insufficient_privilege then null; end;
end $inactive_membership$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000104","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000104', true);
set local role authenticated;
do $inactive_employee$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'inactive employee allowed';
  exception when insufficient_privilege then null; end;
end $inactive_employee$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000105","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000105', true);
set local role authenticated;
do $runbook_disabled$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'RunBook-disabled employee allowed';
  exception when insufficient_privilege then null; end;
end $runbook_disabled$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000106","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000106', true);
set local role authenticated;
do $mobile_disabled$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'Mobile-disabled employee allowed';
  exception when insufficient_privilege then null; end;
end $mobile_disabled$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000107","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000107', true);
set local role authenticated;
do $messaging_disabled$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'messaging-disabled employee allowed';
  exception when insufficient_privilege then null; end;
end $messaging_disabled$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000108","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000108', true);
set local role authenticated;
do $inactive_roster$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'inactive roster allowed';
  exception when insufficient_privilege then null; end;
end $inactive_roster$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000109","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000109', true);
set local role authenticated;
do $restricted_entitlement$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000003'); raise exception 'restricted shop allowed';
  exception when insufficient_privilege then null; end;
end $restricted_entitlement$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000110","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000110', true);
set local role authenticated;
do $deleting_shop$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000004'); raise exception 'deleting shop allowed';
  exception when insufficient_privilege then null; end;
end $deleting_shop$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000111","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000111', true);
set local role authenticated;
do $other_shop$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'other-shop actor allowed';
  exception when insufficient_privilege then null; end;
end $other_shop$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000112","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000112', true);
set local role authenticated;
do $expired_shop$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000005'); raise exception 'expired shop allowed';
  exception when insufficient_privilege then null; end;
end $expired_shop$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000113","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000113', true);
set local role authenticated;
do $missing_membership$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'missing membership allowed';
  exception when insufficient_privilege then null; end;
end $missing_membership$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000114","role":"authenticated"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000114', true);
set local role authenticated;
do $missing_roster$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'missing roster allowed';
  exception when insufficient_privilege then null; end;
end $missing_roster$;
reset role;

select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $anon_actor$ begin
  begin perform 1 from public.rb_messaging_inbox('f0600000-0000-4000-8000-000000000001'); raise exception 'anonymous actor allowed';
  exception when insufficient_privilege then null; end;
end $anon_actor$;
reset role;

rollback;
