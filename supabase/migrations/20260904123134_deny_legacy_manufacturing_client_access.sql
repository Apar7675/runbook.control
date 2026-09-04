-- F04 containment: legacy manufacturing tables are not a client authority.
--
-- This forward-only migration changes authorization metadata only. It does not
-- read, move, update, or delete table rows. With RLS enabled and no policies on
-- these tables, any future accidental client grant also remains fail-closed.

revoke all privileges on table public.attachments from anon, authenticated;
alter table public.attachments enable row level security;

revoke all privileges on table public.balloon_sets from anon, authenticated;
alter table public.balloon_sets enable row level security;

revoke all privileges on table public.component_aliases from anon, authenticated;
alter table public.component_aliases enable row level security;

revoke all privileges on table public.component_files from anon, authenticated;
alter table public.component_files enable row level security;

revoke all privileges on table public.components from anon, authenticated;
alter table public.components enable row level security;

revoke all privileges on table public.daily_logs from anon, authenticated;
alter table public.daily_logs enable row level security;

revoke all privileges on table public.inspection_sets from anon, authenticated;
alter table public.inspection_sets enable row level security;

revoke all privileges on table public.jobs from anon, authenticated;
alter table public.jobs enable row level security;

revoke all privileges on table public.op_sessions from anon, authenticated;
alter table public.op_sessions enable row level security;

revoke all privileges on table public.operations from anon, authenticated;
alter table public.operations enable row level security;

revoke all privileges on table public.operators from anon, authenticated;
alter table public.operators enable row level security;

revoke all privileges on table public.po_line_items from anon, authenticated;
alter table public.po_line_items enable row level security;

revoke all privileges on table public.purchase_orders from anon, authenticated;
alter table public.purchase_orders enable row level security;

revoke all privileges on table public.routing_operations from anon, authenticated;
alter table public.routing_operations enable row level security;

revoke all privileges on table public.tenants from anon, authenticated;
alter table public.tenants enable row level security;

revoke all privileges on table public.travelers from anon, authenticated;
alter table public.travelers enable row level security;
