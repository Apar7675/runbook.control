-- BLOCKED F06 CONTRACT ARTIFACT -- DO NOT AUTO-APPLY.
--
-- Preconditions before an operator may remove the guard below:
--   1. the minimum supported Mobile version uses only rb_messaging_* RPCs;
--   2. adoption/telemetry proves no supported client uses the compatibility
--      RPCs or the two direct-write shapes retained by the expand migration;
--   3. rollback and customer communication are approved.
--
-- This file is intentionally outside supabase/migrations and intentionally
-- aborts even if somebody pastes it into a SQL runner without reviewing it.

begin;

do $blocked_contract$
begin
  raise exception using
    errcode = '55000',
    message = 'F06 messaging contract is BLOCKED pending Mobile minimum-version adoption';
end
$blocked_contract$;

revoke insert (shop_id, conversation_id, sender_employee_id, body)
on table public.messages from authenticated;
revoke delete on table public.conversation_archives from authenticated;
revoke select (shop_id, conversation_id, employee_id)
on table public.conversation_archives from authenticated;

drop policy if exists "rb_messaging_messages_insert_actor_compat"
on public.messages;
drop policy if exists "rb_messaging_conversation_archives_delete_actor_compat"
on public.conversation_archives;

-- Once no authenticated policy evaluates the nullable resolver directly, it
-- returns to being an internal helper reached through hardened RPCs.
revoke execute on function public.rb_messaging_actor_employee_id(uuid)
from authenticated;

do $retire_expand_compatibility$
declare
  signature text;
begin
  foreach signature in array array[
    'public.get_inbox(uuid)',
    'public.get_conversation_header(uuid,uuid)',
    'public.get_archived_inbox(uuid)',
    'public.archive_conversation_for_me(uuid,uuid)',
    'public.create_conversation(uuid,text,text,uuid[])',
    'public.get_or_create_dm(uuid,uuid,uuid)',
    'public.get_or_create_dm(uuid,uuid)',
    'public.mark_conversation_read_now(uuid)',
    'public.mark_conversation_read_now(uuid,uuid)',
    'public.get_reaction_summary_for_conversation(uuid,uuid)',
    'public.toggle_my_message_reaction(uuid,uuid,uuid,text)'
  ]
  loop
    if pg_catalog.to_regprocedure(signature) is not null then
      execute 'revoke all privileges on function ' || signature ||
        ' from PUBLIC, anon, authenticated, service_role';
    end if;
  end loop;
end
$retire_expand_compatibility$;

commit;
