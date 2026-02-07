drop extension if exists "pg_net";


  create table "public"."attachments" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid,
    "traveler_id" uuid,
    "operation_id" uuid,
    "operator_id" uuid,
    "kind" text not null,
    "file_path" text not null,
    "caption" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."balloon_sets" (
    "id" text not null,
    "component_id" text not null,
    "drawing_file_id" text,
    "balloon_pdf_file_id" text,
    "balloon_json_file_id" text,
    "created_utc" text not null
      );



  create table "public"."chat_blocks" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "blocker_user_id" uuid not null,
    "blocked_user_id" uuid not null,
    "reason" text,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."chat_blocks" enable row level security;


  create table "public"."chat_messages" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "thread_id" uuid not null,
    "sender_id" uuid not null,
    "body" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."chat_messages" enable row level security;


  create table "public"."chat_thread_members" (
    "thread_id" uuid not null,
    "user_id" uuid not null,
    "added_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."chat_thread_members" enable row level security;


  create table "public"."chat_threads" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "title" text,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."chat_threads" enable row level security;


  create table "public"."component_aliases" (
    "id" text not null,
    "component_id" text not null,
    "alias" text not null,
    "normalized" text not null,
    "source" text not null,
    "created_utc" text not null
      );



  create table "public"."component_files" (
    "id" text not null,
    "component_id" text not null,
    "file_kind" text not null,
    "role" text,
    "revision" text,
    "page_count" integer,
    "rel_path" text not null,
    "sha256" text,
    "created_utc" text not null
      );



  create table "public"."components" (
    "id" text not null,
    "shop_id" text not null,
    "part_number" text,
    "display_name" text not null,
    "description" text,
    "customer" text,
    "material" text,
    "revision" text,
    "process" text,
    "uom" text default 'EA'::text,
    "is_active" integer not null default 1,
    "component_folder_rel" text not null,
    "manifest_version" integer not null default 1,
    "has_po" integer not null default 0,
    "has_drawing" integer not null default 0,
    "has_balloon" integer not null default 0,
    "has_inspection_set" integer not null default 0,
    "created_utc" text not null,
    "updated_utc" text not null,
    "normalized_key" text
      );



  create table "public"."conversation_archives" (
    "shop_id" uuid not null,
    "conversation_id" uuid not null,
    "employee_id" uuid not null,
    "archived_at" timestamp with time zone not null default now()
      );


alter table "public"."conversation_archives" enable row level security;


  create table "public"."conversation_members" (
    "conversation_id" uuid not null,
    "employee_id" uuid not null,
    "member_role" text not null default 'member'::text,
    "is_active" boolean not null default true,
    "joined_at" timestamp with time zone not null default now(),
    "shop_id" uuid,
    "role" text,
    "added_by_employee_id" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."conversation_members" enable row level security;


  create table "public"."conversations" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "type" text not null,
    "title" text,
    "created_by" uuid not null,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "created_by_employee_id" uuid,
    "updated_at" timestamp with time zone default now(),
    "deleted_at" timestamp with time zone,
    "deleted_by" uuid
      );


alter table "public"."conversations" enable row level security;


  create table "public"."daily_logs" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid,
    "traveler_id" uuid,
    "operation_id" uuid,
    "operator_id" uuid,
    "log_date" date default CURRENT_DATE,
    "good_qty" integer default 0,
    "scrap_qty" integer default 0,
    "notes" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."employee_roles" (
    "shop_id" uuid not null,
    "employee_id" uuid not null,
    "role" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."employee_roles" enable row level security;


  create table "public"."employees" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "auth_user_id" uuid,
    "employee_code" text not null,
    "display_name" text not null,
    "role" text not null,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "avatar_url_256" text,
    "avatar_url_512" text,
    "avatar_updated_at" timestamp with time zone
      );


alter table "public"."employees" enable row level security;


  create table "public"."holiday_calendar" (
    "shop_id" uuid not null,
    "holiday_date" date not null,
    "name" text not null,
    "is_paid" boolean not null default true,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."holiday_calendar" enable row level security;


  create table "public"."inspection_sets" (
    "id" text not null,
    "component_id" text not null,
    "aql_level" real not null default 1.0,
    "fai_template_file_id" text,
    "inprocess_template_file_id" text,
    "final_template_file_id" text,
    "created_utc" text not null
      );



  create table "public"."jobs" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid,
    "customer" text not null,
    "part_number" text not null,
    "part_name" text,
    "notes" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."message_reactions" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "conversation_id" uuid not null,
    "message_id" uuid not null,
    "employee_id" uuid not null,
    "emoji" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."message_reactions" enable row level security;


  create table "public"."message_reads" (
    "conversation_id" uuid not null,
    "employee_id" uuid not null,
    "last_read_at" timestamp with time zone not null default now()
      );


alter table "public"."message_reads" enable row level security;


  create table "public"."messages" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "conversation_id" uuid not null,
    "sender_employee_id" uuid not null,
    "body" text not null,
    "created_at" timestamp with time zone not null default now(),
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone
      );


alter table "public"."messages" enable row level security;


  create table "public"."messaging_roster" (
    "shop_id" uuid not null,
    "employee_id" uuid not null,
    "is_active" boolean not null default true,
    "added_by_employee_id" uuid,
    "added_at" timestamp with time zone not null default now()
      );


alter table "public"."messaging_roster" enable row level security;


  create table "public"."op_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid,
    "traveler_id" uuid,
    "operation_id" uuid,
    "operator_id" uuid,
    "started_at" timestamp with time zone default now(),
    "ended_at" timestamp with time zone,
    "is_complete" boolean default false
      );



  create table "public"."operations" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid,
    "traveler_id" uuid,
    "op_number" integer not null,
    "title" text not null,
    "workcenter" text,
    "notes" text,
    "status" text default 'open'::text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."operators" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid,
    "name" text not null,
    "pin_hash" text not null,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."po_line_items" (
    "id" text not null,
    "purchase_order_id" text not null,
    "line_no" integer,
    "raw_item_name" text not null,
    "normalized_item" text not null,
    "part_number" text,
    "quantity" real,
    "uom" text default 'EA'::text,
    "unit_price" real,
    "due_date" text,
    "component_id" text,
    "link_confidence" real,
    "link_method" text,
    "created_utc" text not null
      );



  create table "public"."purchase_orders" (
    "id" text not null,
    "shop_id" text not null,
    "vendor_name" text,
    "vendor_code" text,
    "po_number" text,
    "po_date" text,
    "received_utc" text not null,
    "source_file_rel" text,
    "extracted_json" text,
    "created_utc" text not null
      );



  create table "public"."push_tokens" (
    "shop_id" uuid not null,
    "employee_id" uuid not null,
    "expo_push_token" text not null,
    "platform" text not null default 'ios'::text,
    "device_name" text not null default 'device'::text,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."push_tokens" enable row level security;


  create table "public"."rb_audit" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid,
    "actor_user_id" uuid,
    "actor_kind" text not null default 'user'::text,
    "action" text not null,
    "entity_type" text,
    "entity_id" uuid,
    "details" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."rb_audit" enable row level security;


  create table "public"."rb_control_admins" (
    "user_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."rb_control_admins" enable row level security;


  create table "public"."rb_device_activation_tokens" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "device_id" uuid not null,
    "token_hash" text not null,
    "expires_at" timestamp with time zone not null,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."rb_device_activation_tokens" enable row level security;


  create table "public"."rb_devices" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "name" text not null,
    "device_key" text,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "device_key_hash" text
      );


alter table "public"."rb_devices" enable row level security;


  create table "public"."rb_shop_members" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null default 'member'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."rb_shop_members" enable row level security;


  create table "public"."rb_shops" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."rb_shops" enable row level security;


  create table "public"."rb_support_bundles" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "file_path" text not null,
    "notes" text,
    "uploaded_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."rb_support_bundles" enable row level security;


  create table "public"."rb_update_packages" (
    "id" uuid not null default gen_random_uuid(),
    "channel" text not null default 'stable'::text,
    "version" text not null,
    "file_path" text not null,
    "sha256" text,
    "notes" text,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."rb_update_packages" enable row level security;


  create table "public"."rb_update_policy" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "channel" text not null default 'stable'::text,
    "min_version" text,
    "pinned_version" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."rb_update_policy" enable row level security;


  create table "public"."rb_user_prefs" (
    "user_id" uuid not null,
    "novice_dismissed" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."rb_user_prefs" enable row level security;


  create table "public"."routing_operations" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid not null,
    "job_id" uuid not null,
    "op_number" integer not null,
    "title" text,
    "workcenter" text,
    "notes" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."shop_members" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null,
    "status" text not null default 'pending'::text,
    "display_name" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."shop_members" enable row level security;


  create table "public"."tenants" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "code" text not null,
    "poster_token" text not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."time_events" (
    "id" uuid not null default gen_random_uuid(),
    "employee_id" uuid not null,
    "shop_id" uuid not null,
    "event_type" text not null,
    "client_ts" timestamp with time zone not null,
    "server_ts" timestamp with time zone not null default now(),
    "source" text not null default 'mobile'::text,
    "device_id" text not null default ''::text,
    "offline_id" text not null,
    "is_offline" boolean not null default true,
    "note" text,
    "needs_review" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."time_events" enable row level security;


  create table "public"."time_off_balances" (
    "shop_id" uuid not null,
    "employee_id" uuid not null,
    "vacation_hours" numeric not null default 0,
    "sick_hours" numeric not null default 0,
    "personal_hours" numeric not null default 0,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."time_off_balances" enable row level security;


  create table "public"."time_off_policy" (
    "shop_id" uuid not null,
    "vacation_hours_per_year" numeric not null default 80,
    "sick_hours_per_year" numeric not null default 40,
    "personal_hours_per_year" numeric not null default 16,
    "allow_negative" boolean not null default false,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."time_off_policy" enable row level security;


  create table "public"."time_off_requests" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "employee_id" uuid not null,
    "type" text not null,
    "start_date" date not null,
    "end_date" date not null,
    "hours_requested" numeric,
    "status" text not null default 'PENDING'::text,
    "employee_note" text,
    "manager_note" text,
    "decided_by_employee_id" uuid,
    "decided_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."time_off_requests" enable row level security;


  create table "public"."timeclock_settings" (
    "shop_id" uuid not null,
    "week_start_dow" integer not null default 0,
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."travelers" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid,
    "job_id" uuid,
    "public_id" uuid default gen_random_uuid(),
    "revision" integer default 1,
    "status" text default 'open'::text,
    "created_at" timestamp with time zone default now(),
    "is_access_enabled" boolean not null default true,
    "closed_at" timestamp with time zone
      );


CREATE UNIQUE INDEX attachments_pkey ON public.attachments USING btree (id);

CREATE UNIQUE INDEX balloon_sets_pkey ON public.balloon_sets USING btree (id);

CREATE UNIQUE INDEX chat_blocks_pkey ON public.chat_blocks USING btree (id);

CREATE UNIQUE INDEX chat_blocks_shop_id_blocker_user_id_blocked_user_id_key ON public.chat_blocks USING btree (shop_id, blocker_user_id, blocked_user_id);

CREATE INDEX chat_blocks_shop_id_idx ON public.chat_blocks USING btree (shop_id);

CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id);

CREATE INDEX chat_messages_thread_id_created_at_idx ON public.chat_messages USING btree (thread_id, created_at);

CREATE UNIQUE INDEX chat_thread_members_pkey ON public.chat_thread_members USING btree (thread_id, user_id);

CREATE INDEX chat_thread_members_user_id_idx ON public.chat_thread_members USING btree (user_id);

CREATE UNIQUE INDEX chat_threads_pkey ON public.chat_threads USING btree (id);

CREATE INDEX chat_threads_shop_id_idx ON public.chat_threads USING btree (shop_id);

CREATE UNIQUE INDEX component_aliases_pkey ON public.component_aliases USING btree (id);

CREATE UNIQUE INDEX component_files_pkey ON public.component_files USING btree (id);

CREATE UNIQUE INDEX components_pkey ON public.components USING btree (id);

CREATE UNIQUE INDEX conversation_archives_pkey ON public.conversation_archives USING btree (shop_id, conversation_id, employee_id);

CREATE UNIQUE INDEX conversation_members_pkey ON public.conversation_members USING btree (conversation_id, employee_id);

CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id);

CREATE INDEX conversations_shop_deleted_at_idx ON public.conversations USING btree (shop_id, deleted_at);

CREATE UNIQUE INDEX daily_logs_pkey ON public.daily_logs USING btree (id);

CREATE UNIQUE INDEX employee_roles_pkey ON public.employee_roles USING btree (shop_id, employee_id, role);

CREATE UNIQUE INDEX employees_auth_user_id_key ON public.employees USING btree (auth_user_id);

CREATE UNIQUE INDEX employees_pkey ON public.employees USING btree (id);

CREATE INDEX employees_shop_active_idx ON public.employees USING btree (shop_id, is_active);

CREATE UNIQUE INDEX employees_shop_auth_unique ON public.employees USING btree (shop_id, auth_user_id) WHERE (auth_user_id IS NOT NULL);

CREATE UNIQUE INDEX employees_shop_code_uniq ON public.employees USING btree (shop_id, employee_code);

CREATE UNIQUE INDEX employees_shop_code_unique ON public.employees USING btree (shop_id, employee_code) WHERE (employee_code IS NOT NULL);

CREATE UNIQUE INDEX holiday_calendar_pkey ON public.holiday_calendar USING btree (shop_id, holiday_date);

CREATE INDEX idx_balloon_sets_component ON public.balloon_sets USING btree (component_id);

CREATE INDEX idx_component_aliases_component ON public.component_aliases USING btree (component_id);

CREATE INDEX idx_component_files_component ON public.component_files USING btree (component_id);

CREATE INDEX idx_component_files_kind ON public.component_files USING btree (file_kind);

CREATE INDEX idx_components_flags ON public.components USING btree (has_drawing, has_balloon, has_inspection_set);

CREATE INDEX idx_components_normalized_key ON public.components USING btree (normalized_key);

CREATE INDEX idx_components_part_number ON public.components USING btree (part_number);

CREATE INDEX idx_components_shop ON public.components USING btree (shop_id);

CREATE INDEX idx_conversation_members_emp ON public.conversation_members USING btree (employee_id);

CREATE INDEX idx_conversation_members_shop_convo ON public.conversation_members USING btree (shop_id, conversation_id);

CREATE INDEX idx_conversation_members_shop_employee ON public.conversation_members USING btree (shop_id, employee_id);

CREATE INDEX idx_conversations_shop_created ON public.conversations USING btree (shop_id, created_at DESC);

CREATE INDEX idx_conversations_shop_type_active ON public.conversations USING btree (shop_id, type, is_active);

CREATE INDEX idx_conversations_shop_updated ON public.conversations USING btree (shop_id, updated_at DESC);

CREATE INDEX idx_convo_archives_lookup ON public.conversation_archives USING btree (shop_id, employee_id, archived_at);

CREATE INDEX idx_employees_auth_user_shop ON public.employees USING btree (auth_user_id, shop_id);

CREATE INDEX idx_inspection_sets_component ON public.inspection_sets USING btree (component_id);

CREATE INDEX idx_members_convo_emp ON public.conversation_members USING btree (conversation_id, employee_id);

CREATE INDEX idx_message_reactions_employee ON public.message_reactions USING btree (shop_id, employee_id);

CREATE INDEX idx_message_reactions_lookup ON public.message_reactions USING btree (shop_id, conversation_id, message_id);

CREATE INDEX idx_messages_conversation_created ON public.messages USING btree (conversation_id, created_at DESC);

CREATE INDEX idx_messages_convo_created ON public.messages USING btree (conversation_id, created_at);

CREATE INDEX idx_messages_shop_convo_created ON public.messages USING btree (shop_id, conversation_id, created_at DESC);

CREATE INDEX idx_messages_shop_convo_not_deleted ON public.messages USING btree (shop_id, conversation_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_messaging_roster_shop_active ON public.messaging_roster USING btree (shop_id, is_active);

CREATE INDEX idx_messaging_roster_shop_employee ON public.messaging_roster USING btree (shop_id, employee_id);

CREATE INDEX idx_po_line_items_component ON public.po_line_items USING btree (component_id);

CREATE INDEX idx_po_line_items_norm ON public.po_line_items USING btree (normalized_item);

CREATE INDEX idx_po_line_items_po ON public.po_line_items USING btree (purchase_order_id);

CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders USING btree (po_number);

CREATE INDEX idx_purchase_orders_shop ON public.purchase_orders USING btree (shop_id);

CREATE INDEX idx_roster_shop_active ON public.messaging_roster USING btree (shop_id, is_active);

CREATE INDEX idx_time_off_requests_employee ON public.time_off_requests USING btree (employee_id, start_date);

CREATE INDEX idx_time_off_requests_shop_status ON public.time_off_requests USING btree (shop_id, status, start_date);

CREATE UNIQUE INDEX inspection_sets_pkey ON public.inspection_sets USING btree (id);

CREATE INDEX ix_routing_ops_job ON public.routing_operations USING btree (job_id, op_number);

CREATE INDEX ix_routing_ops_tenant ON public.routing_operations USING btree (tenant_id);

CREATE UNIQUE INDEX jobs_pkey ON public.jobs USING btree (id);

CREATE UNIQUE INDEX message_reactions_pkey ON public.message_reactions USING btree (id);

CREATE UNIQUE INDEX message_reactions_shop_id_message_id_employee_id_emoji_key ON public.message_reactions USING btree (shop_id, message_id, employee_id, emoji);

CREATE UNIQUE INDEX message_reads_pkey ON public.message_reads USING btree (conversation_id, employee_id);

CREATE INDEX messages_conv_created_idx ON public.messages USING btree (conversation_id, created_at DESC);

CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);

CREATE UNIQUE INDEX messaging_roster_pkey ON public.messaging_roster USING btree (shop_id, employee_id);

CREATE UNIQUE INDEX op_sessions_pkey ON public.op_sessions USING btree (id);

CREATE UNIQUE INDEX operations_pkey ON public.operations USING btree (id);

CREATE UNIQUE INDEX operations_traveler_id_op_number_key ON public.operations USING btree (traveler_id, op_number);

CREATE UNIQUE INDEX operators_pkey ON public.operators USING btree (id);

CREATE UNIQUE INDEX operators_tenant_id_name_key ON public.operators USING btree (tenant_id, name);

CREATE UNIQUE INDEX po_line_items_pkey ON public.po_line_items USING btree (id);

CREATE UNIQUE INDEX purchase_orders_pkey ON public.purchase_orders USING btree (id);

CREATE UNIQUE INDEX push_tokens_pkey ON public.push_tokens USING btree (shop_id, employee_id, expo_push_token);

CREATE INDEX rb_audit_action_idx ON public.rb_audit USING btree (action, created_at DESC);

CREATE UNIQUE INDEX rb_audit_pkey ON public.rb_audit USING btree (id);

CREATE INDEX rb_audit_shop_idx ON public.rb_audit USING btree (shop_id, created_at DESC);

CREATE UNIQUE INDEX rb_control_admins_pkey ON public.rb_control_admins USING btree (user_id);

CREATE UNIQUE INDEX rb_device_activation_tokens_device_id_key ON public.rb_device_activation_tokens USING btree (device_id);

CREATE UNIQUE INDEX rb_device_activation_tokens_pkey ON public.rb_device_activation_tokens USING btree (id);

CREATE INDEX rb_device_activation_tokens_shop_idx ON public.rb_device_activation_tokens USING btree (shop_id);

CREATE UNIQUE INDEX rb_devices_pkey ON public.rb_devices USING btree (id);

CREATE INDEX rb_devices_shop_id_idx ON public.rb_devices USING btree (shop_id);

CREATE UNIQUE INDEX rb_shop_members_pkey ON public.rb_shop_members USING btree (id);

CREATE INDEX rb_shop_members_shop_id_idx ON public.rb_shop_members USING btree (shop_id);

CREATE UNIQUE INDEX rb_shop_members_shop_id_user_id_key ON public.rb_shop_members USING btree (shop_id, user_id);

CREATE INDEX rb_shop_members_user_id_idx ON public.rb_shop_members USING btree (user_id);

CREATE UNIQUE INDEX rb_shops_pkey ON public.rb_shops USING btree (id);

CREATE UNIQUE INDEX rb_support_bundles_pkey ON public.rb_support_bundles USING btree (id);

CREATE INDEX rb_support_bundles_shop_idx ON public.rb_support_bundles USING btree (shop_id);

CREATE INDEX rb_update_packages_channel_idx ON public.rb_update_packages USING btree (channel);

CREATE UNIQUE INDEX rb_update_packages_channel_version_key ON public.rb_update_packages USING btree (channel, version);

CREATE UNIQUE INDEX rb_update_packages_pkey ON public.rb_update_packages USING btree (id);

CREATE UNIQUE INDEX rb_update_policy_pkey ON public.rb_update_policy USING btree (id);

CREATE UNIQUE INDEX rb_update_policy_shop_id_key ON public.rb_update_policy USING btree (shop_id);

CREATE UNIQUE INDEX rb_user_prefs_pkey ON public.rb_user_prefs USING btree (user_id);

CREATE UNIQUE INDEX routing_operations_pkey ON public.routing_operations USING btree (id);

CREATE UNIQUE INDEX shop_members_pkey ON public.shop_members USING btree (id);

CREATE INDEX shop_members_shop_id_idx ON public.shop_members USING btree (shop_id);

CREATE UNIQUE INDEX shop_members_shop_id_user_id_key ON public.shop_members USING btree (shop_id, user_id);

CREATE INDEX shop_members_user_id_idx ON public.shop_members USING btree (user_id);

CREATE UNIQUE INDEX tenants_code_key ON public.tenants USING btree (code);

CREATE UNIQUE INDEX tenants_pkey ON public.tenants USING btree (id);

CREATE UNIQUE INDEX tenants_poster_token_key ON public.tenants USING btree (poster_token);

CREATE INDEX time_events_employee_day_idx ON public.time_events USING btree (employee_id, client_ts DESC);

CREATE UNIQUE INDEX time_events_offline_id_key ON public.time_events USING btree (offline_id);

CREATE UNIQUE INDEX time_events_offline_id_uidx ON public.time_events USING btree (offline_id);

CREATE UNIQUE INDEX time_events_offline_id_uq ON public.time_events USING btree (offline_id);

CREATE UNIQUE INDEX time_events_pkey ON public.time_events USING btree (id);

CREATE INDEX time_events_shop_day_idx ON public.time_events USING btree (shop_id, client_ts DESC);

CREATE INDEX time_events_type_idx ON public.time_events USING btree (event_type);

CREATE UNIQUE INDEX time_off_balances_pkey ON public.time_off_balances USING btree (shop_id, employee_id);

CREATE UNIQUE INDEX time_off_policy_pkey ON public.time_off_policy USING btree (shop_id);

CREATE UNIQUE INDEX time_off_requests_pkey ON public.time_off_requests USING btree (id);

CREATE UNIQUE INDEX timeclock_settings_pkey ON public.timeclock_settings USING btree (shop_id);

CREATE UNIQUE INDEX travelers_pkey ON public.travelers USING btree (id);

CREATE UNIQUE INDEX travelers_public_id_key ON public.travelers USING btree (public_id);

CREATE UNIQUE INDEX ux_component_aliases_norm ON public.component_aliases USING btree (normalized);

CREATE UNIQUE INDEX ux_routing_ops_job_op ON public.routing_operations USING btree (job_id, op_number);

alter table "public"."attachments" add constraint "attachments_pkey" PRIMARY KEY using index "attachments_pkey";

alter table "public"."balloon_sets" add constraint "balloon_sets_pkey" PRIMARY KEY using index "balloon_sets_pkey";

alter table "public"."chat_blocks" add constraint "chat_blocks_pkey" PRIMARY KEY using index "chat_blocks_pkey";

alter table "public"."chat_messages" add constraint "chat_messages_pkey" PRIMARY KEY using index "chat_messages_pkey";

alter table "public"."chat_thread_members" add constraint "chat_thread_members_pkey" PRIMARY KEY using index "chat_thread_members_pkey";

alter table "public"."chat_threads" add constraint "chat_threads_pkey" PRIMARY KEY using index "chat_threads_pkey";

alter table "public"."component_aliases" add constraint "component_aliases_pkey" PRIMARY KEY using index "component_aliases_pkey";

alter table "public"."component_files" add constraint "component_files_pkey" PRIMARY KEY using index "component_files_pkey";

alter table "public"."components" add constraint "components_pkey" PRIMARY KEY using index "components_pkey";

alter table "public"."conversation_archives" add constraint "conversation_archives_pkey" PRIMARY KEY using index "conversation_archives_pkey";

alter table "public"."conversation_members" add constraint "conversation_members_pkey" PRIMARY KEY using index "conversation_members_pkey";

alter table "public"."conversations" add constraint "conversations_pkey" PRIMARY KEY using index "conversations_pkey";

alter table "public"."daily_logs" add constraint "daily_logs_pkey" PRIMARY KEY using index "daily_logs_pkey";

alter table "public"."employee_roles" add constraint "employee_roles_pkey" PRIMARY KEY using index "employee_roles_pkey";

alter table "public"."employees" add constraint "employees_pkey" PRIMARY KEY using index "employees_pkey";

alter table "public"."holiday_calendar" add constraint "holiday_calendar_pkey" PRIMARY KEY using index "holiday_calendar_pkey";

alter table "public"."inspection_sets" add constraint "inspection_sets_pkey" PRIMARY KEY using index "inspection_sets_pkey";

alter table "public"."jobs" add constraint "jobs_pkey" PRIMARY KEY using index "jobs_pkey";

alter table "public"."message_reactions" add constraint "message_reactions_pkey" PRIMARY KEY using index "message_reactions_pkey";

alter table "public"."message_reads" add constraint "message_reads_pkey" PRIMARY KEY using index "message_reads_pkey";

alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY using index "messages_pkey";

alter table "public"."messaging_roster" add constraint "messaging_roster_pkey" PRIMARY KEY using index "messaging_roster_pkey";

alter table "public"."op_sessions" add constraint "op_sessions_pkey" PRIMARY KEY using index "op_sessions_pkey";

alter table "public"."operations" add constraint "operations_pkey" PRIMARY KEY using index "operations_pkey";

alter table "public"."operators" add constraint "operators_pkey" PRIMARY KEY using index "operators_pkey";

alter table "public"."po_line_items" add constraint "po_line_items_pkey" PRIMARY KEY using index "po_line_items_pkey";

alter table "public"."purchase_orders" add constraint "purchase_orders_pkey" PRIMARY KEY using index "purchase_orders_pkey";

alter table "public"."push_tokens" add constraint "push_tokens_pkey" PRIMARY KEY using index "push_tokens_pkey";

alter table "public"."rb_audit" add constraint "rb_audit_pkey" PRIMARY KEY using index "rb_audit_pkey";

alter table "public"."rb_control_admins" add constraint "rb_control_admins_pkey" PRIMARY KEY using index "rb_control_admins_pkey";

alter table "public"."rb_device_activation_tokens" add constraint "rb_device_activation_tokens_pkey" PRIMARY KEY using index "rb_device_activation_tokens_pkey";

alter table "public"."rb_devices" add constraint "rb_devices_pkey" PRIMARY KEY using index "rb_devices_pkey";

alter table "public"."rb_shop_members" add constraint "rb_shop_members_pkey" PRIMARY KEY using index "rb_shop_members_pkey";

alter table "public"."rb_shops" add constraint "rb_shops_pkey" PRIMARY KEY using index "rb_shops_pkey";

alter table "public"."rb_support_bundles" add constraint "rb_support_bundles_pkey" PRIMARY KEY using index "rb_support_bundles_pkey";

alter table "public"."rb_update_packages" add constraint "rb_update_packages_pkey" PRIMARY KEY using index "rb_update_packages_pkey";

alter table "public"."rb_update_policy" add constraint "rb_update_policy_pkey" PRIMARY KEY using index "rb_update_policy_pkey";

alter table "public"."rb_user_prefs" add constraint "rb_user_prefs_pkey" PRIMARY KEY using index "rb_user_prefs_pkey";

alter table "public"."routing_operations" add constraint "routing_operations_pkey" PRIMARY KEY using index "routing_operations_pkey";

alter table "public"."shop_members" add constraint "shop_members_pkey" PRIMARY KEY using index "shop_members_pkey";

alter table "public"."tenants" add constraint "tenants_pkey" PRIMARY KEY using index "tenants_pkey";

alter table "public"."time_events" add constraint "time_events_pkey" PRIMARY KEY using index "time_events_pkey";

alter table "public"."time_off_balances" add constraint "time_off_balances_pkey" PRIMARY KEY using index "time_off_balances_pkey";

alter table "public"."time_off_policy" add constraint "time_off_policy_pkey" PRIMARY KEY using index "time_off_policy_pkey";

alter table "public"."time_off_requests" add constraint "time_off_requests_pkey" PRIMARY KEY using index "time_off_requests_pkey";

alter table "public"."timeclock_settings" add constraint "timeclock_settings_pkey" PRIMARY KEY using index "timeclock_settings_pkey";

alter table "public"."travelers" add constraint "travelers_pkey" PRIMARY KEY using index "travelers_pkey";

alter table "public"."attachments" add constraint "attachments_operation_id_fkey" FOREIGN KEY (operation_id) REFERENCES public.operations(id) not valid;

alter table "public"."attachments" validate constraint "attachments_operation_id_fkey";

alter table "public"."attachments" add constraint "attachments_operator_id_fkey" FOREIGN KEY (operator_id) REFERENCES public.operators(id) not valid;

alter table "public"."attachments" validate constraint "attachments_operator_id_fkey";

alter table "public"."attachments" add constraint "attachments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."attachments" validate constraint "attachments_tenant_id_fkey";

alter table "public"."attachments" add constraint "attachments_traveler_id_fkey" FOREIGN KEY (traveler_id) REFERENCES public.travelers(id) not valid;

alter table "public"."attachments" validate constraint "attachments_traveler_id_fkey";

alter table "public"."balloon_sets" add constraint "balloon_sets_component_id_fkey" FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE not valid;

alter table "public"."balloon_sets" validate constraint "balloon_sets_component_id_fkey";

alter table "public"."chat_blocks" add constraint "chat_blocks_blocked_user_id_fkey" FOREIGN KEY (blocked_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_blocks" validate constraint "chat_blocks_blocked_user_id_fkey";

alter table "public"."chat_blocks" add constraint "chat_blocks_blocker_user_id_fkey" FOREIGN KEY (blocker_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_blocks" validate constraint "chat_blocks_blocker_user_id_fkey";

alter table "public"."chat_blocks" add constraint "chat_blocks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_blocks" validate constraint "chat_blocks_created_by_fkey";

alter table "public"."chat_blocks" add constraint "chat_blocks_shop_id_blocker_user_id_blocked_user_id_key" UNIQUE using index "chat_blocks_shop_id_blocker_user_id_blocked_user_id_key";

alter table "public"."chat_messages" add constraint "chat_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_sender_id_fkey";

alter table "public"."chat_messages" add constraint "chat_messages_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_thread_id_fkey";

alter table "public"."chat_thread_members" add constraint "chat_thread_members_added_by_fkey" FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_thread_members" validate constraint "chat_thread_members_added_by_fkey";

alter table "public"."chat_thread_members" add constraint "chat_thread_members_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE not valid;

alter table "public"."chat_thread_members" validate constraint "chat_thread_members_thread_id_fkey";

alter table "public"."chat_thread_members" add constraint "chat_thread_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_thread_members" validate constraint "chat_thread_members_user_id_fkey";

alter table "public"."chat_threads" add constraint "chat_threads_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_threads" validate constraint "chat_threads_created_by_fkey";

alter table "public"."component_aliases" add constraint "component_aliases_component_id_fkey" FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE not valid;

alter table "public"."component_aliases" validate constraint "component_aliases_component_id_fkey";

alter table "public"."component_files" add constraint "component_files_component_id_fkey" FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE not valid;

alter table "public"."component_files" validate constraint "component_files_component_id_fkey";

alter table "public"."conversation_members" add constraint "conversation_members_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."conversation_members" validate constraint "conversation_members_conversation_id_fkey";

alter table "public"."conversation_members" add constraint "conversation_members_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."conversation_members" validate constraint "conversation_members_employee_id_fkey";

alter table "public"."conversation_members" add constraint "conversation_members_member_role_check" CHECK ((member_role = ANY (ARRAY['owner'::text, 'member'::text]))) not valid;

alter table "public"."conversation_members" validate constraint "conversation_members_member_role_check";

alter table "public"."conversation_members" add constraint "fk_members_conversation" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."conversation_members" validate constraint "fk_members_conversation";

alter table "public"."conversations" add constraint "conversations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.employees(id) not valid;

alter table "public"."conversations" validate constraint "conversations_created_by_fkey";

alter table "public"."conversations" add constraint "conversations_type_check" CHECK ((type = ANY (ARRAY['dm'::text, 'group'::text]))) not valid;

alter table "public"."conversations" validate constraint "conversations_type_check";

alter table "public"."daily_logs" add constraint "daily_logs_operation_id_fkey" FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE not valid;

alter table "public"."daily_logs" validate constraint "daily_logs_operation_id_fkey";

alter table "public"."daily_logs" add constraint "daily_logs_operator_id_fkey" FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE CASCADE not valid;

alter table "public"."daily_logs" validate constraint "daily_logs_operator_id_fkey";

alter table "public"."daily_logs" add constraint "daily_logs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."daily_logs" validate constraint "daily_logs_tenant_id_fkey";

alter table "public"."daily_logs" add constraint "daily_logs_traveler_id_fkey" FOREIGN KEY (traveler_id) REFERENCES public.travelers(id) ON DELETE CASCADE not valid;

alter table "public"."daily_logs" validate constraint "daily_logs_traveler_id_fkey";

alter table "public"."employee_roles" add constraint "employee_roles_role_check" CHECK ((role = ANY (ARRAY['foreman'::text, 'admin'::text]))) not valid;

alter table "public"."employee_roles" validate constraint "employee_roles_role_check";

alter table "public"."employees" add constraint "employees_auth_user_id_key" UNIQUE using index "employees_auth_user_id_key";

alter table "public"."employees" add constraint "employees_role_check" CHECK ((role = ANY (ARRAY['foreman'::text, 'employee'::text]))) not valid;

alter table "public"."employees" validate constraint "employees_role_check";

alter table "public"."inspection_sets" add constraint "inspection_sets_component_id_fkey" FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE not valid;

alter table "public"."inspection_sets" validate constraint "inspection_sets_component_id_fkey";

alter table "public"."jobs" add constraint "jobs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."jobs" validate constraint "jobs_tenant_id_fkey";

alter table "public"."message_reactions" add constraint "message_reactions_shop_id_message_id_employee_id_emoji_key" UNIQUE using index "message_reactions_shop_id_message_id_employee_id_emoji_key";

alter table "public"."message_reads" add constraint "message_reads_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."message_reads" validate constraint "message_reads_conversation_id_fkey";

alter table "public"."message_reads" add constraint "message_reads_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."message_reads" validate constraint "message_reads_employee_id_fkey";

alter table "public"."messages" add constraint "fk_messages_conversation" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "fk_messages_conversation";

alter table "public"."messages" add constraint "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_conversation_id_fkey";

alter table "public"."messages" add constraint "messages_sender_employee_id_fkey" FOREIGN KEY (sender_employee_id) REFERENCES public.employees(id) not valid;

alter table "public"."messages" validate constraint "messages_sender_employee_id_fkey";

alter table "public"."messaging_roster" add constraint "fk_roster_employee" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."messaging_roster" validate constraint "fk_roster_employee";

alter table "public"."messaging_roster" add constraint "messaging_roster_added_by_employee_id_fkey" FOREIGN KEY (added_by_employee_id) REFERENCES public.employees(id) not valid;

alter table "public"."messaging_roster" validate constraint "messaging_roster_added_by_employee_id_fkey";

alter table "public"."messaging_roster" add constraint "messaging_roster_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."messaging_roster" validate constraint "messaging_roster_employee_id_fkey";

alter table "public"."op_sessions" add constraint "op_sessions_operation_id_fkey" FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE not valid;

alter table "public"."op_sessions" validate constraint "op_sessions_operation_id_fkey";

alter table "public"."op_sessions" add constraint "op_sessions_operator_id_fkey" FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE CASCADE not valid;

alter table "public"."op_sessions" validate constraint "op_sessions_operator_id_fkey";

alter table "public"."op_sessions" add constraint "op_sessions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."op_sessions" validate constraint "op_sessions_tenant_id_fkey";

alter table "public"."op_sessions" add constraint "op_sessions_traveler_id_fkey" FOREIGN KEY (traveler_id) REFERENCES public.travelers(id) ON DELETE CASCADE not valid;

alter table "public"."op_sessions" validate constraint "op_sessions_traveler_id_fkey";

alter table "public"."operations" add constraint "operations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."operations" validate constraint "operations_tenant_id_fkey";

alter table "public"."operations" add constraint "operations_traveler_id_fkey" FOREIGN KEY (traveler_id) REFERENCES public.travelers(id) ON DELETE CASCADE not valid;

alter table "public"."operations" validate constraint "operations_traveler_id_fkey";

alter table "public"."operations" add constraint "operations_traveler_id_op_number_key" UNIQUE using index "operations_traveler_id_op_number_key";

alter table "public"."operators" add constraint "operators_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."operators" validate constraint "operators_tenant_id_fkey";

alter table "public"."operators" add constraint "operators_tenant_id_name_key" UNIQUE using index "operators_tenant_id_name_key";

alter table "public"."po_line_items" add constraint "po_line_items_component_id_fkey" FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE SET NULL not valid;

alter table "public"."po_line_items" validate constraint "po_line_items_component_id_fkey";

alter table "public"."po_line_items" add constraint "po_line_items_purchase_order_id_fkey" FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE not valid;

alter table "public"."po_line_items" validate constraint "po_line_items_purchase_order_id_fkey";

alter table "public"."rb_audit" add constraint "rb_audit_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.rb_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rb_audit" validate constraint "rb_audit_shop_id_fkey";

alter table "public"."rb_device_activation_tokens" add constraint "rb_device_activation_tokens_device_id_fkey" FOREIGN KEY (device_id) REFERENCES public.rb_devices(id) ON DELETE CASCADE not valid;

alter table "public"."rb_device_activation_tokens" validate constraint "rb_device_activation_tokens_device_id_fkey";

alter table "public"."rb_device_activation_tokens" add constraint "rb_device_activation_tokens_device_id_key" UNIQUE using index "rb_device_activation_tokens_device_id_key";

alter table "public"."rb_device_activation_tokens" add constraint "rb_device_activation_tokens_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.rb_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rb_device_activation_tokens" validate constraint "rb_device_activation_tokens_shop_id_fkey";

alter table "public"."rb_devices" add constraint "rb_devices_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.rb_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rb_devices" validate constraint "rb_devices_shop_id_fkey";

alter table "public"."rb_shop_members" add constraint "rb_shop_members_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text]))) not valid;

alter table "public"."rb_shop_members" validate constraint "rb_shop_members_role_check";

alter table "public"."rb_shop_members" add constraint "rb_shop_members_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.rb_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rb_shop_members" validate constraint "rb_shop_members_shop_id_fkey";

alter table "public"."rb_shop_members" add constraint "rb_shop_members_shop_id_user_id_key" UNIQUE using index "rb_shop_members_shop_id_user_id_key";

alter table "public"."rb_support_bundles" add constraint "rb_support_bundles_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.rb_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rb_support_bundles" validate constraint "rb_support_bundles_shop_id_fkey";

alter table "public"."rb_update_packages" add constraint "rb_update_packages_channel_version_key" UNIQUE using index "rb_update_packages_channel_version_key";

alter table "public"."rb_update_policy" add constraint "rb_update_policy_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.rb_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rb_update_policy" validate constraint "rb_update_policy_shop_id_fkey";

alter table "public"."rb_update_policy" add constraint "rb_update_policy_shop_id_key" UNIQUE using index "rb_update_policy_shop_id_key";

alter table "public"."routing_operations" add constraint "routing_operations_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE not valid;

alter table "public"."routing_operations" validate constraint "routing_operations_job_id_fkey";

alter table "public"."routing_operations" add constraint "routing_operations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) not valid;

alter table "public"."routing_operations" validate constraint "routing_operations_tenant_id_fkey";

alter table "public"."shop_members" add constraint "shop_members_role_check" CHECK ((role = ANY (ARRAY['foreman'::text, 'worker'::text]))) not valid;

alter table "public"."shop_members" validate constraint "shop_members_role_check";

alter table "public"."shop_members" add constraint "shop_members_shop_id_user_id_key" UNIQUE using index "shop_members_shop_id_user_id_key";

alter table "public"."shop_members" add constraint "shop_members_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text]))) not valid;

alter table "public"."shop_members" validate constraint "shop_members_status_check";

alter table "public"."shop_members" add constraint "shop_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."shop_members" validate constraint "shop_members_user_id_fkey";

alter table "public"."tenants" add constraint "tenants_code_key" UNIQUE using index "tenants_code_key";

alter table "public"."tenants" add constraint "tenants_poster_token_key" UNIQUE using index "tenants_poster_token_key";

alter table "public"."time_events" add constraint "fk_time_events_employee" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT not valid;

alter table "public"."time_events" validate constraint "fk_time_events_employee";

alter table "public"."time_events" add constraint "time_events_event_type_check" CHECK ((event_type = ANY (ARRAY['CLOCK_IN'::text, 'CLOCK_OUT'::text, 'BREAK_START'::text, 'BREAK_END'::text, 'LUNCH_START'::text, 'LUNCH_END'::text]))) not valid;

alter table "public"."time_events" validate constraint "time_events_event_type_check";

alter table "public"."time_off_requests" add constraint "time_off_requests_hours_check" CHECK (((type = 'UNPAID'::text) OR (status = ANY (ARRAY['DENIED'::text, 'CANCELLED'::text])) OR ((hours_requested IS NOT NULL) AND (hours_requested > (0)::numeric)))) not valid;

alter table "public"."time_off_requests" validate constraint "time_off_requests_hours_check";

alter table "public"."time_off_requests" add constraint "time_off_requests_status_check" CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'DENIED'::text, 'CANCELLED'::text]))) not valid;

alter table "public"."time_off_requests" validate constraint "time_off_requests_status_check";

alter table "public"."time_off_requests" add constraint "time_off_requests_type_check" CHECK ((type = ANY (ARRAY['VACATION'::text, 'SICK'::text, 'PERSONAL'::text, 'UNPAID'::text]))) not valid;

alter table "public"."time_off_requests" validate constraint "time_off_requests_type_check";

alter table "public"."travelers" add constraint "travelers_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE not valid;

alter table "public"."travelers" validate constraint "travelers_job_id_fkey";

alter table "public"."travelers" add constraint "travelers_public_id_key" UNIQUE using index "travelers_public_id_key";

alter table "public"."travelers" add constraint "travelers_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."travelers" validate constraint "travelers_tenant_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.approve_time_off_request(p_request_id uuid, p_note text)
 RETURNS public.time_off_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_req public.time_off_requests%rowtype;
  v_type text;
  v_hours numeric;
  v_vac numeric;
  v_sick numeric;
  v_personal numeric;
begin
  -- Lock the request row so approve/deny can’t race
  select *
    into v_req
  from public.time_off_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'time_off_request not found: %', p_request_id
      using errcode = 'P0001';
  end if;

  -- Foreman permission check (shop-scoped)
  if not public.is_foreman(v_req.shop_id) then
    raise exception 'not authorized (foreman required)'
      using errcode = '42501';
  end if;

  -- Must be pending
  if upper(coalesce(v_req.status, '')) <> 'PENDING' then
    raise exception 'request must be PENDING to approve (current=%)', v_req.status
      using errcode = 'P0001';
  end if;

  v_type := upper(trim(coalesce(v_req.type, '')));

  -- IMPORTANT: paid types require hours_requested
  if v_type in ('VACATION', 'SICK', 'PERSONAL') then
    if v_req.hours_requested is null then
      raise exception 'hours_requested is required for % requests', v_type
        using errcode = 'P0001';
    end if;

    v_hours := v_req.hours_requested;

    if v_hours <= 0 then
      raise exception 'hours_requested must be > 0 for % requests', v_type
        using errcode = 'P0001';
    end if;

    -- Lock the balance row too
    select vacation_hours, sick_hours, personal_hours
      into v_vac, v_sick, v_personal
    from public.time_off_balances
    where shop_id = v_req.shop_id
      and employee_id = v_req.employee_id
    for update;

    if not found then
      raise exception 'time_off_balances row not found for employee % (shop %)', v_req.employee_id, v_req.shop_id
        using errcode = 'P0001';
    end if;

    v_vac := coalesce(v_vac, 0);
    v_sick := coalesce(v_sick, 0);
    v_personal := coalesce(v_personal, 0);

    if v_type = 'VACATION' then
      if v_vac < v_hours then
        raise exception 'insufficient vacation balance: have %, need %', v_vac, v_hours
          using errcode = 'P0001';
      end if;

      update public.time_off_balances
        set vacation_hours = vacation_hours - v_hours,
            updated_at = now()
      where shop_id = v_req.shop_id
        and employee_id = v_req.employee_id;

    elsif v_type = 'SICK' then
      if v_sick < v_hours then
        raise exception 'insufficient sick balance: have %, need %', v_sick, v_hours
          using errcode = 'P0001';
      end if;

      update public.time_off_balances
        set sick_hours = sick_hours - v_hours,
            updated_at = now()
      where shop_id = v_req.shop_id
        and employee_id = v_req.employee_id;

    elsif v_type = 'PERSONAL' then
      if v_personal < v_hours then
        raise exception 'insufficient personal balance: have %, need %', v_personal, v_hours
          using errcode = 'P0001';
      end if;

      update public.time_off_balances
        set personal_hours = personal_hours - v_hours,
            updated_at = now()
      where shop_id = v_req.shop_id
        and employee_id = v_req.employee_id;

    end if;

  elsif v_type = 'UNPAID' then
    -- UNPAID: approve is allowed; no balance deduction; hours may be null/0
    null;
  else
    raise exception 'unknown time off type: %', v_req.type
      using errcode = 'P0001';
  end if;

  -- Approve + stamp decision
  update public.time_off_requests
     set status = 'APPROVED',
         manager_note = p_note,
         decided_by_employee_id = auth.uid(),
         decided_at = now()
   where id = p_request_id
   returning * into v_req;

  return v_req;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_conversation(_shop_id uuid, _conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me_employee_id uuid;
  is_member boolean;
begin
  if _shop_id is null or _conversation_id is null then
    raise exception 'Missing _shop_id or _conversation_id';
  end if;

  select e.id
    into me_employee_id
  from public.employees e
  where e.shop_id = _shop_id
    and e.auth_user_id = auth.uid()
  limit 1;

  if me_employee_id is null then
    raise exception 'Employee not found for auth user in this shop';
  end if;

  select exists (
    select 1
    from public.conversation_members cm
    where cm.shop_id = _shop_id
      and cm.conversation_id = _conversation_id
      and cm.employee_id = me_employee_id
  ) into is_member;

  if not is_member then
    raise exception 'Not a member of this conversation';
  end if;

  update public.conversations
     set deleted_at = now(),
         deleted_by = me_employee_id,
         updated_at = now()
   where shop_id = _shop_id
     and id = _conversation_id;

end;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_conversation_for_me(_shop_id uuid, _conversation_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
insert into public.conversation_archives (shop_id, conversation_id, employee_id)
values (_shop_id, _conversation_id, public.rb_current_employee_id(_shop_id))
on conflict (shop_id, conversation_id, employee_id)
do update set archived_at = now();
$function$
;

CREATE OR REPLACE FUNCTION public.bump_conversation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  update public.conversations
    set updated_at = now()
    where id = new.conversation_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.conversations_title_check()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.type = 'group' and (new.title is null or length(trim(new.title)) = 0) then
    raise exception 'Group conversations must have a title';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_conversation(_shop_id uuid, _type text, _title text, _member_employee_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  convo_id uuid;
  me_emp_id uuid;
  generated_title text;
begin
  if _type not in ('dm', 'group') then
    raise exception 'Invalid conversation type';
  end if;

  me_emp_id := public.rb_current_employee_id(_shop_id);
  if me_emp_id is null then
    raise exception 'No employee for current user in this shop';
  end if;

  if _type = 'group' then
    generated_title :=
      coalesce(
        nullif(_title, ''),
        (
          select string_agg(e.display_name, ', ' order by e.display_name)
          from public.employees e
          where e.shop_id = _shop_id
            and e.id = any(_member_employee_ids)
        )
      );
  else
    generated_title := null;
  end if;

  insert into public.conversations (
    shop_id,
    type,
    title,
    created_by,
    created_by_employee_id,
    created_at,
    updated_at
  )
  values (
    _shop_id,
    _type,
    generated_title,
    me_emp_id,      -- ✅ employee FK
    me_emp_id,      -- keep consistent
    now(),
    now()
  )
  returning id into convo_id;

  insert into public.conversation_members (shop_id, conversation_id, employee_id)
  select _shop_id, convo_id, unnest(_member_employee_ids);

  return convo_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_conversation_with_members(_shop_id uuid, _type text, _title text, _member_employee_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me_id uuid;
  me_role text;
  convo_id uuid;
  final_members uuid[];
  member_count int;
begin
  me_id := public.rb_current_employee_id(_shop_id);
  if me_id is null then
    raise exception 'No employee mapped to current user for shop %', _shop_id;
  end if;

  -- must be active in messaging
  if public.rb_is_active_in_messaging(_shop_id) is not true then
    raise exception 'Messaging not active for current user in shop %', _shop_id;
  end if;

  select e.role into me_role
  from public.employees e
  where e.id = me_id
    and e.shop_id = _shop_id
  limit 1;

  if _type not in ('dm','group') then
    raise exception 'Invalid conversation type: %', _type;
  end if;

  -- build final member list: ensure caller is included, remove nulls/dupes
  final_members := array(select distinct x from unnest(coalesce(_member_employee_ids, array[]::uuid[])) as x where x is not null);
  if me_id <> all(final_members) then
    final_members := array_append(final_members, me_id);
  end if;

  member_count := coalesce(array_length(final_members, 1), 0);

  if _type = 'dm' then
    -- DM must be exactly 2 members (me + other)
    if member_count <> 2 then
      raise exception 'DM must have exactly 2 members (got %)', member_count;
    end if;
  else
    -- GROUP must be foreman-only creator
    if lower(coalesce(me_role,'')) <> 'foreman' then
      raise exception 'Only foreman can create group conversations';
    end if;

    if member_count < 3 then
      -- group means 3+ including the foreman; UI allows 2+ selected, but we include foreman automatically
      raise exception 'Group must have at least 3 members including creator (got %)', member_count;
    end if;

    if length(trim(coalesce(_title,''))) < 2 then
      raise exception 'Group title required';
    end if;
  end if;

  insert into public.conversations (shop_id, type, title, created_by, is_active, created_at, updated_at)
  values (
    _shop_id,
    _type,
    case when _type = 'group' then trim(_title) else null end,
    me_id,
    true,
    now(),
    now()
  )
  returning id into convo_id;

  -- Insert members
  insert into public.conversation_members (shop_id, conversation_id, employee_id, created_at)
  select _shop_id, convo_id, x, now()
  from unnest(final_members) as x;

  return convo_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_employee()
 RETURNS public.employees
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select e.*
  from public.employees e
  where e.auth_user_id = auth.uid()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.current_employee_clock()
 RETURNS TABLE(employee_id uuid, shop_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  select e.id as employee_id, e.shop_id
  from public.employees e
  where e.auth_user_id = auth.uid()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.current_employee_id(_shop_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select e.id
  from public.employees e
  where e.shop_id = _shop_id
    and e.auth_user_id = auth.uid()
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.deny_time_off_request(p_request_id uuid, p_note text)
 RETURNS public.time_off_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_req public.time_off_requests%rowtype;
begin
  -- Lock request row
  select *
    into v_req
  from public.time_off_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'time_off_request not found: %', p_request_id
      using errcode = 'P0001';
  end if;

  if not public.is_foreman(v_req.shop_id) then
    raise exception 'not authorized (foreman required)'
      using errcode = '42501';
  end if;

  if upper(coalesce(v_req.status, '')) <> 'PENDING' then
    raise exception 'request must be PENDING to deny (current=%)', v_req.status
      using errcode = 'P0001';
  end if;

  update public.time_off_requests
     set status = 'DENIED',
         manager_note = p_note,
         decided_by_employee_id = auth.uid(),
         decided_at = now()
   where id = p_request_id
   returning * into v_req;

  return v_req;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_archived_inbox(_shop_id uuid)
 RETURNS TABLE(conversation_id uuid, archived_at timestamp with time zone, title text, last_message_body text, last_message_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me_emp_id uuid;
begin
  me_emp_id := public.rb_current_employee_id(_shop_id);

  return query
  select
    ca.conversation_id,
    ca.archived_at,
    coalesce(t.display_title, 'Message') as title,
    lm.body as last_message_body,
    lm.created_at as last_message_at
  from public.conversation_archives ca
  join public.conversations c
    on c.shop_id = ca.shop_id
   and c.id = ca.conversation_id
  left join public.get_conversation_titles(_shop_id) t
    on t.conversation_id = ca.conversation_id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.shop_id = _shop_id
      and m.conversation_id = ca.conversation_id
      and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) lm on true
  where ca.shop_id = _shop_id
    and ca.employee_id = me_emp_id
  order by ca.archived_at desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_conversation_header(_shop_id uuid, _conversation_id uuid)
 RETURNS TABLE(conversation_id uuid, type text, display_title text, avatar_initials text, avatar_url_256 text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
with me as (
  select rb_current_employee_id(_shop_id) as employee_id
),
c as (
  select *
  from conversations
  where id = _conversation_id
    and shop_id = _shop_id
    and deleted_at is null
),
dm_partner as (
  select
    e.display_name,
    e.avatar_url_256
  from conversation_members cm
  join me on true
  join employees e
    on e.id = cm.employee_id
   and e.shop_id = cm.shop_id
  where cm.conversation_id = _conversation_id
    and cm.shop_id = _shop_id
    and cm.employee_id <> me.employee_id
  limit 1
),
group_title as (
  select
    string_agg(e.display_name, ', ' order by e.display_name) as names
  from conversation_members cm
  join employees e
    on e.id = cm.employee_id
   and e.shop_id = cm.shop_id
  where cm.conversation_id = _conversation_id
    and cm.shop_id = _shop_id
)
select
  c.id as conversation_id,
  c.type,
  case
    when c.type = 'dm' then dp.display_name
    else coalesce(c.title, gt.names, 'Group')
  end as display_title,
  case
    when c.type = 'dm' then upper(left(dp.display_name, 2))
    else upper(left(coalesce(c.title, gt.names, 'G'), 2))
  end as avatar_initials,
  case
    when c.type = 'dm' then dp.avatar_url_256
    else null
  end as avatar_url_256
from c
left join dm_partner dp on true
left join group_title gt on true;
$function$
;

CREATE OR REPLACE FUNCTION public.get_conversation_titles(_shop_id uuid)
 RETURNS TABLE(conversation_id uuid, display_title text, avatar_initials text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (
    select e.id as employee_id
    from public.employees e
    where e.shop_id = _shop_id
      and e.auth_user_id = auth.uid()
    limit 1
  ),
  my_convos as (
    select distinct cm.conversation_id
    from public.conversation_members cm
    where cm.shop_id = _shop_id
      and cm.employee_id = (select employee_id from me)
  ),
  convo as (
    select c.id, c.type, c.title
    from public.conversations c
    join my_convos mc on mc.conversation_id = c.id
    where c.shop_id = _shop_id
  ),
  members as (
    select cm.conversation_id, cm.employee_id
    from public.conversation_members cm
    join my_convos mc on mc.conversation_id = cm.conversation_id
    where cm.shop_id = _shop_id
  ),
  others as (
    select
      m.conversation_id,
      array_agg(e.display_name order by e.display_name)
        filter (where m.employee_id <> (select employee_id from me)) as other_names
    from members m
    join public.employees e
      on e.id = m.employee_id
     and e.shop_id = _shop_id
    group by m.conversation_id
  ),
  titles as (
    select
      c.id as conversation_id,
      case
        when c.type = 'group' then coalesce(nullif(trim(c.title), ''), 'Group')
        else coalesce(
          (select onames.other_names[1] from others onames where onames.conversation_id = c.id),
          'Direct Message'
        )
      end as display_title
    from convo c
  ),
  cleaned as (
    select
      t.conversation_id,
      t.display_title,
      trim(regexp_replace(coalesce(t.display_title, ''), '[^A-Za-z0-9 ]', '', 'g')) as clean_title
    from titles t
  )
  select
    c.conversation_id,
    c.display_title,
    upper(
      case
        when c.clean_title = '' then '??'
        when array_length(regexp_split_to_array(c.clean_title, '\s+'), 1) = 1 then left(c.clean_title, 2)
        else (
          left((regexp_split_to_array(c.clean_title, '\s+'))[1], 1) ||
          left((regexp_split_to_array(c.clean_title, '\s+'))[array_length(regexp_split_to_array(c.clean_title, '\s+'), 1)], 1)
        )
      end
    ) as avatar_initials
  from cleaned c;
$function$
;

CREATE OR REPLACE FUNCTION public.get_inbox(_shop_id uuid)
 RETURNS TABLE(conversation_id uuid, shop_id uuid, type text, title text, avatar_initials text, avatar_url_256 text, updated_at timestamp with time zone, last_message_body text, last_message_at timestamp with time zone, unread_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with me as (
  select rb_current_employee_id(_shop_id) as employee_id
),
member_convos as (
  select c.*
  from public.conversations c
  join public.conversation_members cm
    on cm.shop_id = c.shop_id
   and cm.conversation_id = c.id
  join me on me.employee_id = cm.employee_id
  where c.shop_id = _shop_id
    and c.deleted_at is null
    and not exists (
      select 1
      from public.conversation_archives a
      where a.shop_id = c.shop_id
        and a.conversation_id = c.id
        and a.employee_id = me.employee_id
    )
),
last_msg as (
  select
    m.conversation_id,
    m.body as last_body,
    m.created_at as last_at
  from public.messages m
  join (
    select conversation_id, max(created_at) as max_at
    from public.messages
    where shop_id = _shop_id
      and deleted_at is null
    group by conversation_id
  ) x on x.conversation_id = m.conversation_id and x.max_at = m.created_at
  where m.shop_id = _shop_id
    and m.deleted_at is null
),
reads as (
  select mr.conversation_id, mr.last_read_at
  from public.message_reads mr
  join me on me.employee_id = mr.employee_id
  join public.conversations c
    on c.id = mr.conversation_id
   and c.shop_id = _shop_id
  where c.deleted_at is null
),
unread as (
  select
    m.conversation_id,
    count(*)::bigint as cnt
  from public.messages m
  join me on true
  left join reads r on r.conversation_id = m.conversation_id
  where m.shop_id = _shop_id
    and m.deleted_at is null
    and m.sender_employee_id <> me.employee_id
    and m.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz)
  group by m.conversation_id
),
titles as (
  select t.conversation_id, t.display_title, t.avatar_initials
  from public.get_conversation_titles(_shop_id) t
),
dm_partner_avatar as (
  select
    cm.conversation_id,
    max(e.avatar_url_256) as partner_avatar_256
  from public.conversation_members cm
  join me on true
  join public.employees e
    on e.shop_id = cm.shop_id
   and e.id = cm.employee_id
  join public.conversations c
    on c.shop_id = cm.shop_id
   and c.id = cm.conversation_id
  where cm.shop_id = _shop_id
    and c.type = 'dm'
    and cm.employee_id <> me.employee_id
    and c.deleted_at is null
  group by cm.conversation_id
)
select
  c.id as conversation_id,
  c.shop_id,
  c.type,
  coalesce(t.display_title, c.title, 'Message') as title,
  coalesce(t.avatar_initials, '??') as avatar_initials,
  case when c.type = 'dm' then d.partner_avatar_256 else null end as avatar_url_256,
  coalesce(c.updated_at, c.created_at) as updated_at,
  lm.last_body as last_message_body,
  lm.last_at as last_message_at,
  coalesce(u.cnt, 0) as unread_count
from member_convos c
left join last_msg lm on lm.conversation_id = c.id
left join unread u on u.conversation_id = c.id
left join titles t on t.conversation_id = c.id
left join dm_partner_avatar d on d.conversation_id = c.id
order by coalesce(c.updated_at, c.created_at) desc, c.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_employee_id(_shop_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _eid uuid;
begin
  select e.id into _eid
  from public.employees e
  where e.shop_id = _shop_id
    and e.auth_user_id = auth.uid()
  limit 1;

  if _eid is null then
    raise exception 'No employee record for signed-in user in this shop.';
  end if;

  return _eid;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_dm(_employee_a uuid, _employee_b uuid, _shop_id uuid)
 RETURNS TABLE(conversation_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a uuid;
  b uuid;
  existing_id uuid;
  creator_employee_id uuid;
begin
  if _employee_a is null or _employee_b is null or _shop_id is null then
    raise exception 'Missing required parameter(s)';
  end if;

  if _employee_a = _employee_b then
    raise exception 'Cannot create DM with same employee';
  end if;

  -- creator is the signed-in user's employee row for this shop
  select e.id
    into creator_employee_id
  from public.employees e
  where e.shop_id = _shop_id
    and e.auth_user_id = auth.uid()
  limit 1;

  if creator_employee_id is null then
    raise exception 'Creator employee not found for auth user in this shop';
  end if;

  -- normalize order so A/B vs B/A returns the same DM
  if _employee_a < _employee_b then
    a := _employee_a;
    b := _employee_b;
  else
    a := _employee_b;
    b := _employee_a;
  end if;

  -- Find an existing DM in this shop that has these two members
  select c.id
    into existing_id
  from public.conversations c
  join public.conversation_members m1
    on m1.conversation_id = c.id and m1.shop_id = _shop_id and m1.employee_id = a
  join public.conversation_members m2
    on m2.conversation_id = c.id and m2.shop_id = _shop_id and m2.employee_id = b
  where c.shop_id = _shop_id
    and c.type = 'dm'
  limit 1;

  if existing_id is not null then
    return query select existing_id;
    return;
  end if;

  -- ✅ created_by must be an EMPLOYEE id (FK)
  insert into public.conversations (shop_id, type, title, created_at, updated_at, created_by)
  values (_shop_id, 'dm', null, now(), now(), creator_employee_id)
  returning id into existing_id;

  insert into public.conversation_members (shop_id, conversation_id, employee_id, created_at)
  values
    (_shop_id, existing_id, a, now()),
    (_shop_id, existing_id, b, now());

  return query select existing_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_dm(_shop_id uuid, _other_employee_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me_id uuid;
  convo_id uuid;
  other_id uuid := _other_employee_id;
begin
  me_id := public.rb_current_employee_id(_shop_id);
  if me_id is null then
    raise exception 'No employee mapped to current user for shop %', _shop_id;
  end if;

  if other_id is null then
    raise exception 'Other employee id is required';
  end if;

  if other_id = me_id then
    raise exception 'Cannot DM yourself';
  end if;

  -- must be active in messaging
  if public.rb_is_active_in_messaging(_shop_id) is not true then
    raise exception 'Messaging not active for current user in shop %', _shop_id;
  end if;

  -- Find an existing DM in this shop with exactly two members: me + other
  select c.id into convo_id
  from public.conversations c
  where c.shop_id = _shop_id
    and c.type = 'dm'
    and c.is_active = true
    and exists (
      select 1
      from public.conversation_members cm
      where cm.shop_id = _shop_id
        and cm.conversation_id = c.id
        and cm.employee_id in (me_id, other_id)
      group by cm.conversation_id
      having count(distinct cm.employee_id) = 2
    )
    and (
      select count(*) from public.conversation_members cm2
      where cm2.shop_id = _shop_id
        and cm2.conversation_id = c.id
    ) = 2
  limit 1;

  if convo_id is not null then
    return convo_id;
  end if;

  -- Create new DM conversation
  insert into public.conversations (shop_id, type, title, created_by, is_active, created_at, updated_at)
  values (_shop_id, 'dm', null, me_id, true, now(), now())
  returning id into convo_id;

  insert into public.conversation_members (shop_id, conversation_id, employee_id, created_at)
  values
    (_shop_id, convo_id, me_id, now()),
    (_shop_id, convo_id, other_id, now());

  return convo_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_reaction_summary_for_conversation(_shop_id uuid, _conversation_id uuid)
 RETURNS TABLE(message_id uuid, emoji text, count integer, my_reacted boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (
    select public.get_my_employee_id(_shop_id) as employee_id
  )
  select
    mr.message_id,
    mr.emoji,
    count(*)::int as count,
    bool_or(mr.employee_id = (select employee_id from me)) as my_reacted
  from public.message_reactions mr
  where mr.shop_id = _shop_id
    and mr.conversation_id = _conversation_id
  group by mr.message_id, mr.emoji
  order by mr.message_id, mr.emoji;
$function$
;

CREATE OR REPLACE FUNCTION public.get_unread_counts(_shop_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (
    select public.rb_current_employee_id(_shop_id) as employee_id
  ),
  my_convos as (
    select cm.conversation_id
    from public.conversation_members cm
    join me on true
    where cm.shop_id = _shop_id
      and cm.employee_id = me.employee_id
  ),
  reads as (
    select r.conversation_id, r.last_read_at
    from public.message_reads r
    join me on true
    where r.employee_id = me.employee_id
  )
  select
    m.conversation_id,
    count(*)::int as unread_count
  from public.messages m
  join my_convos c on c.conversation_id = m.conversation_id
  left join reads r on r.conversation_id = m.conversation_id
  where m.shop_id = _shop_id
    and m.deleted_at is null
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
  group by m.conversation_id
$function$
;

CREATE OR REPLACE FUNCTION public.is_approved_member(p_shop_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.shop_members sm
    where sm.shop_id = p_shop_id
      and sm.user_id = p_user_id
      and sm.status = 'approved'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_blocked_pair(p_shop_id uuid, a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.chat_blocks cb
    where cb.shop_id = p_shop_id
      and (
        (cb.blocker_user_id = a and cb.blocked_user_id = b) or
        (cb.blocker_user_id = b and cb.blocked_user_id = a)
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_foreman(p_shop_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists(
    select 1
    from public.employee_roles r
    where r.shop_id = p_shop_id
      and r.employee_id = (select id from public.my_employee())
      and r.role in ('foreman','admin')
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_foreman(p_shop_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.shop_members sm
    where sm.shop_id = p_shop_id
      and sm.user_id = p_user_id
      and sm.status = 'approved'
      and sm.role = 'foreman'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_foreman_employee(_shop_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.employees e
    where e.shop_id = _shop_id
      and e.auth_user_id = auth.uid()
      and e.role = 'foreman'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_messaging_active_employee(_shop_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.messaging_roster mr
    join public.employees e on e.id = mr.employee_id
    where mr.shop_id = _shop_id
      and e.auth_user_id = auth.uid()
      and mr.is_active = true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.mark_conversation_read_now(_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sid uuid;
  me uuid;
begin
  select c.shop_id into sid
  from public.conversations c
  where c.id = _conversation_id
  limit 1;

  if sid is null then
    raise exception 'Conversation not found';
  end if;

  me := public.rb_current_employee_id(sid);
  if me is null then
    raise exception 'No employee mapped for this user in this shop';
  end if;

  -- Must be a member
  if not exists (
    select 1
    from public.conversation_members cm
    where cm.shop_id = sid
      and cm.conversation_id = _conversation_id
      and cm.employee_id = me
  ) then
    raise exception 'Not a member of this conversation';
  end if;

  insert into public.message_reads (conversation_id, employee_id, last_read_at)
  values (_conversation_id, me, now())
  on conflict (conversation_id, employee_id)
  do update set last_read_at = excluded.last_read_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_employee()
 RETURNS TABLE(id uuid, shop_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  select e.id, e.shop_id
  from public.employees e
  where e.auth_user_id = auth.uid()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.my_employee_id(_shop_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select e.id
  from public.employees e
  where e.auth_user_id = auth.uid()
    and e.shop_id = _shop_id
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.my_roster_active(_shop_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists(
    select 1
    from public.messaging_roster r
    where r.shop_id = _shop_id
      and r.employee_id = public.my_employee_id(_shop_id)
      and r.is_active = true
  )
$function$
;

CREATE OR REPLACE FUNCTION public.rb_create_shop(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_shop_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Shop name required';
  end if;

  insert into public.rb_shops(name)
  values (trim(p_name))
  returning id into v_shop_id;

  insert into public.rb_shop_members(shop_id, user_id, role)
  values (v_shop_id, auth.uid(), 'admin');

  insert into public.rb_update_policy(shop_id, channel, min_version, pinned_version)
  values (v_shop_id, 'stable', null, null)
  on conflict (shop_id) do nothing;

  return v_shop_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_current_employee_id(_shop_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select e.id
  from public.employees e
  where e.shop_id = _shop_id
    and e.auth_user_id = auth.uid()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.rb_delete_shop(p_shop_id uuid, p_confirm_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
begin
  if p_shop_id is null then
    raise exception 'missing shop id';
  end if;

  select name into v_name
  from public.rb_shops
  where id = p_shop_id;

  if v_name is null then
    raise exception 'shop not found';
  end if;

  -- must be shop admin
  if not public.rb_is_shop_admin(p_shop_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  -- confirmation must match exactly
  if coalesce(p_confirm_name,'') <> v_name then
    raise exception 'confirmation name did not match';
  end if;

  -- audit BEFORE delete so FK/cascade doesn't remove context
  insert into public.rb_audit (
    shop_id,
    actor_user_id,
    actor_kind,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    p_shop_id,
    auth.uid(),
    'user',
    'shop.deleted',
    'shop',
    p_shop_id,
    jsonb_build_object('name', v_name)
  );

  delete from public.rb_shops
  where id = p_shop_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_device_deactivate_token(p_device_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.rb_devices%rowtype;
begin
  select * into v
  from public.rb_devices
  where id = p_device_id;

  if v.id is null then
    raise exception 'device not found';
  end if;

  if not public.rb_is_shop_admin(v.shop_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  delete from public.rb_device_activation_tokens
  where device_id = v.id;

  insert into public.rb_audit (
    shop_id, actor_user_id, actor_kind, action, entity_type, entity_id, details
  ) values (
    v.shop_id, auth.uid(), 'user',
    'device.token_deactivated',
    'device', v.id,
    jsonb_build_object('name', v.name)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_device_delete(p_device_id uuid, p_confirm_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.rb_devices%rowtype;
begin
  select * into v
  from public.rb_devices
  where id = p_device_id;

  if v.id is null then
    raise exception 'device not found';
  end if;

  if not public.rb_is_shop_admin(v.shop_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  if coalesce(p_confirm_name,'') <> v.name then
    raise exception 'confirmation name did not match';
  end if;

  -- audit first
  insert into public.rb_audit (
    shop_id, actor_user_id, actor_kind, action, entity_type, entity_id, details
  ) values (
    v.shop_id, auth.uid(), 'user',
    'device.deleted',
    'device', v.id,
    jsonb_build_object('name', v.name)
  );

  -- tokens will cascade if FK exists; if not, delete explicitly
  delete from public.rb_device_activation_tokens where device_id = v.id;
  delete from public.rb_devices where id = v.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_device_set_activation_token(p_device_id uuid, p_token_hash text, p_expires_at timestamp with time zone, p_force boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.rb_devices%rowtype;
begin
  select * into v
  from public.rb_devices
  where id = p_device_id;

  if v.id is null then
    raise exception 'device not found';
  end if;

  if not public.rb_is_shop_admin(v.shop_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  insert into public.rb_device_activation_tokens (
    shop_id, device_id, token_hash, expires_at, used_at
  )
  values (
    v.shop_id, v.id, p_token_hash, p_expires_at, null
  )
  on conflict (device_id) do update set
    token_hash = excluded.token_hash,
    expires_at = excluded.expires_at,
    used_at = null;

  insert into public.rb_audit (
    shop_id, actor_user_id, actor_kind, action, entity_type, entity_id, details
  ) values (
    v.shop_id, auth.uid(), 'user',
    case when coalesce(p_force,false) then 'device.reactivation_forced' else 'device.activation_regenerated' end,
    'device', v.id,
    jsonb_build_object('name', v.name, 'expiresAt', p_expires_at)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_device_toggle_status(p_device_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.rb_devices%rowtype;
  v_next text;
begin
  select * into v
  from public.rb_devices
  where id = p_device_id;

  if v.id is null then
    raise exception 'device not found';
  end if;

  if not public.rb_is_shop_admin(v.shop_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  v_next := case when v.status = 'active' then 'disabled' else 'active' end;

  update public.rb_devices
  set status = v_next
  where id = p_device_id;

  insert into public.rb_audit (
    shop_id, actor_user_id, actor_kind, action, entity_type, entity_id, details
  ) values (
    v.shop_id, auth.uid(), 'user',
    case when v_next = 'disabled' then 'device.disabled' else 'device.enabled' end,
    'device', v.id,
    jsonb_build_object('name', v.name, 'status', v_next)
  );

  return v_next;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_is_active_in_messaging(_shop_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.messaging_roster mr
    where mr.shop_id = _shop_id
      and mr.employee_id = public.rb_current_employee_id(_shop_id)
      and mr.is_active = true
  )
$function$
;

CREATE OR REPLACE FUNCTION public.rb_is_conversation_member(_shop_id uuid, _conversation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.shop_id = _shop_id
      and cm.conversation_id = _conversation_id
      and cm.employee_id = public.rb_current_employee_id(_shop_id)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.rb_is_shop_admin(p_shop uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.rb_shop_members m
    where m.shop_id = p_shop
      and m.user_id = p_user
      and m.role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.rb_is_shop_member(p_shop uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.rb_shop_members m
    where m.shop_id = p_shop
      and m.user_id = p_user
  );
$function$
;

CREATE OR REPLACE FUNCTION public.rb_me_roster_active(_shop_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_emp uuid; v_ok boolean;
begin
  perform set_config('row_security','off', true);
  v_emp := public.rb_my_employee_id(_shop_id);
  if v_emp is null then return false; end if;

  select exists(
    select 1
    from public.messaging_roster r
    where r.shop_id = _shop_id
      and r.employee_id = v_emp
      and r.is_active = true
  ) into v_ok;

  return coalesce(v_ok,false);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_my_employee_id(_shop_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  perform set_config('row_security','off', true);
  select e.id into v_id
  from public.employees e
  where e.auth_user_id = auth.uid()
    and e.shop_id = _shop_id
  limit 1;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_remove_shop_member(p_shop_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_admin_count int;
begin
  -- only shop admins can remove members
  if not public.rb_is_shop_admin(p_shop_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select role into v_role
  from public.rb_shop_members
  where shop_id = p_shop_id and user_id = p_user_id;

  if v_role is null then
    raise exception 'member not found';
  end if;

  -- cannot remove last admin
  if v_role = 'admin' then
    select count(*) into v_admin_count
    from public.rb_shop_members
    where shop_id = p_shop_id and role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'cannot remove last admin';
    end if;
  end if;

  delete from public.rb_shop_members
  where shop_id = p_shop_id and user_id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_set_shop_member_role(p_shop_id uuid, p_user_id uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_role text;
  v_admin_count int;
begin
  if p_role not in ('admin','member') then
    raise exception 'invalid role';
  end if;

  -- only shop admins can change roles
  if not public.rb_is_shop_admin(p_shop_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select role into v_current_role
  from public.rb_shop_members
  where shop_id = p_shop_id and user_id = p_user_id;

  if v_current_role is null then
    raise exception 'member not found';
  end if;

  -- cannot demote the last admin
  if v_current_role = 'admin' and p_role <> 'admin' then
    select count(*) into v_admin_count
    from public.rb_shop_members
    where shop_id = p_shop_id and role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'cannot demote last admin';
    end if;
  end if;

  update public.rb_shop_members
  set role = p_role
  where shop_id = p_shop_id and user_id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rb_touch_conversation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.conversations
    set updated_at = now()
  where id = new.conversation_id
    and shop_id = new.shop_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rename_group_conversation(_shop_id uuid, _conversation_id uuid, _title text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me_emp_id uuid;
  is_member boolean;
  convo_type text;
begin
  me_emp_id := public.rb_current_employee_id(_shop_id);

  select exists(
    select 1
    from public.conversation_members cm
    where cm.shop_id = _shop_id
      and cm.conversation_id = _conversation_id
      and cm.employee_id = me_emp_id
      and cm.deleted_at is null
  ) into is_member;

  if not is_member then
    raise exception 'Not a member of this conversation';
  end if;

  select type into convo_type
  from public.conversations
  where shop_id = _shop_id
    and id = _conversation_id;

  if convo_type <> 'group' then
    raise exception 'Only group conversations can be renamed';
  end if;

  update public.conversations
  set title = nullif(trim(_title), ''),
      updated_at = now()
  where shop_id = _shop_id
    and id = _conversation_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at_routing_ops()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.time_events_block_if_timeoff()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_day date;
begin
  -- allow CLOCK_OUT always (so you can exit cleanly)
  if new.event_type = 'CLOCK_OUT' then
    return new;
  end if;

  -- Determine the "day" of the event (use client_ts)
  v_day := (new.client_ts::timestamptz at time zone 'UTC')::date;

  if exists (
    select 1
    from public.time_off_requests r
    where r.shop_id = new.shop_id
      and r.employee_id = new.employee_id
      and r.status = 'APPROVED'
      and v_day between r.start_date and r.end_date
  ) then
    raise exception 'timeclock_blocked_by_time_off'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.timeclock_is_blocked_now(p_shop_id uuid, p_employee_id uuid)
 RETURNS TABLE(is_blocked boolean, reason text, request_id uuid, request_type text, start_date date, end_date date, manager_note text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with hit as (
    select r.*
    from public.time_off_requests r
    where r.shop_id = p_shop_id
      and r.employee_id = p_employee_id
      and r.status = 'APPROVED'
      and current_date between r.start_date and r.end_date
    order by r.created_at desc
    limit 1
  )
  select
    (select count(*) from hit) = 1 as is_blocked,
    case when (select count(*) from hit) = 1
      then 'Time clock disabled: approved time off is active today.'
      else null
    end as reason,
    h.id as request_id,
    h.type as request_type,
    h.start_date,
    h.end_date,
    h.manager_note
  from (select 1) one
  left join hit h on true;
$function$
;

CREATE OR REPLACE FUNCTION public.timeclock_weekly_summary(p_shop_id uuid, p_employee_id uuid, p_week_start date)
 RETURNS TABLE(day date, work_seconds bigint, break_seconds bigint, lunch_seconds bigint, total_seconds bigint, last_event_ts timestamp with time zone, status text)
 LANGUAGE sql
 STABLE
AS $function$
with bounds as (
  select
    p_week_start::timestamptz as start_ts,
    (p_week_start + 7)::timestamptz as end_ts
),
events as (
  select
    te.event_type,
    te.client_ts,
    te.server_ts,
    coalesce(te.server_ts, te.client_ts) as ts
  from public.time_events te
  join bounds b on true
  where te.shop_id = p_shop_id
    and te.employee_id = p_employee_id
    and coalesce(te.server_ts, te.client_ts) >= b.start_ts
    and coalesce(te.server_ts, te.client_ts) <  b.end_ts
),
ordered as (
  select
    e.*,
    lead(ts) over (order by ts) as next_ts
  from events e
),
seg as (
  select
    date_trunc('day', ts)::date as day,
    event_type,
    ts,
    case
      when next_ts is not null then next_ts
      else now()
    end as seg_end
  from ordered
),
clamped as (
  select
    s.day,
    s.event_type,
    greatest(s.ts, s.day::timestamptz) as a,
    least(s.seg_end, (s.day + 1)::timestamptz) as b
  from seg s
  where s.seg_end > s.ts
),
seconds_by_day as (
  select
    day,
    sum(case when event_type = 'IN_WORKING' then extract(epoch from (b - a)) else 0 end)::bigint as work_seconds,
    sum(case when event_type = 'IN_BREAK'   then extract(epoch from (b - a)) else 0 end)::bigint as break_seconds,
    sum(case when event_type = 'IN_LUNCH'   then extract(epoch from (b - a)) else 0 end)::bigint as lunch_seconds
  from clamped
  group by day
),
week_days as (
  select generate_series(p_week_start, p_week_start + 6, interval '1 day')::date as day
),
last_evt as (
  select
    max(ts) as last_event_ts,
    case (select event_type from ordered order by ts desc limit 1)
      when 'IN_WORKING' then 'IN_WORKING'
      when 'IN_BREAK'   then 'IN_BREAK'
      when 'IN_LUNCH'   then 'IN_LUNCH'
      when 'OUT'        then 'OUT'
      when 'OUT_BREAK'  then 'IN_WORKING'
      when 'OUT_LUNCH'  then 'IN_WORKING'
      else 'OUT'
    end as status
  from ordered
)
select
  d.day,
  coalesce(s.work_seconds, 0) as work_seconds,
  coalesce(s.break_seconds, 0) as break_seconds,
  coalesce(s.lunch_seconds, 0) as lunch_seconds,
  greatest(coalesce(s.work_seconds, 0) - coalesce(s.break_seconds, 0) - coalesce(s.lunch_seconds, 0), 0) as total_seconds,
  l.last_event_ts,
  l.status
from week_days d
left join seconds_by_day s on s.day = d.day
cross join last_evt l
order by d.day;
$function$
;

CREATE OR REPLACE FUNCTION public.toggle_my_message_reaction(_shop_id uuid, _conversation_id uuid, _message_id uuid, _emoji text)
 RETURNS TABLE(did_add boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _eid uuid;
  _exists boolean;
begin
  _eid := public.get_my_employee_id(_shop_id);

  -- membership check
  if not exists (
    select 1
    from public.conversation_members cm
    where cm.shop_id = _shop_id
      and cm.conversation_id = _conversation_id
      and cm.employee_id = _eid
  ) then
    raise exception 'Not a member of this conversation.';
  end if;

  select exists(
    select 1
    from public.message_reactions mr
    where mr.shop_id = _shop_id
      and mr.conversation_id = _conversation_id
      and mr.message_id = _message_id
      and mr.employee_id = _eid
      and mr.emoji = _emoji
  ) into _exists;

  if _exists then
    delete from public.message_reactions mr
    where mr.shop_id = _shop_id
      and mr.conversation_id = _conversation_id
      and mr.message_id = _message_id
      and mr.employee_id = _eid
      and mr.emoji = _emoji;

    did_add := false;
    return next;
    return;
  else
    insert into public.message_reactions (shop_id, conversation_id, message_id, employee_id, emoji)
    values (_shop_id, _conversation_id, _message_id, _eid, _emoji)
    on conflict do nothing;

    did_add := true;
    return next;
    return;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_my_push_token(_shop_id uuid, _expo_push_token text, _platform text, _device_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me_emp_id uuid;
begin
  me_emp_id := public.rb_current_employee_id(_shop_id);

  insert into public.push_tokens(shop_id, employee_id, expo_push_token, platform, device_name, updated_at)
  values (_shop_id, me_emp_id, _expo_push_token, coalesce(_platform,'ios'), coalesce(_device_name,'device'), now())
  on conflict (shop_id, employee_id, expo_push_token)
  do update set platform = excluded.platform, device_name = excluded.device_name, updated_at = now();
end;
$function$
;

create or replace view "public"."v_timeclock_status" as  WITH last_event AS (
         SELECT te.id,
            te.employee_id,
            te.shop_id,
            te.event_type,
            te.client_ts,
            te.server_ts,
            te.source,
            te.device_id,
            te.offline_id,
            te.is_offline,
            te.note,
            te.needs_review,
            te.created_at,
            te.updated_at,
            row_number() OVER (PARTITION BY te.shop_id, te.employee_id ORDER BY te.server_ts DESC, te.client_ts DESC, te.created_at DESC) AS rn
           FROM public.time_events te
        ), latest AS (
         SELECT last_event.id,
            last_event.employee_id,
            last_event.shop_id,
            last_event.event_type,
            last_event.client_ts,
            last_event.server_ts,
            last_event.source,
            last_event.device_id,
            last_event.offline_id,
            last_event.is_offline,
            last_event.note,
            last_event.needs_review,
            last_event.created_at,
            last_event.updated_at,
            last_event.rn
           FROM last_event
          WHERE (last_event.rn = 1)
        )
 SELECT shop_id,
    employee_id,
        CASE
            WHEN (event_type = 'CLOCK_OUT'::text) THEN 'OUT'::text
            WHEN (event_type = 'BREAK_START'::text) THEN 'IN_BREAK'::text
            WHEN (event_type = 'LUNCH_START'::text) THEN 'IN_LUNCH'::text
            WHEN (event_type = 'CLOCK_IN'::text) THEN 'IN_WORKING'::text
            WHEN (event_type = 'BREAK_END'::text) THEN 'IN_WORKING'::text
            WHEN (event_type = 'LUNCH_END'::text) THEN 'IN_WORKING'::text
            ELSE 'OUT'::text
        END AS status,
    server_ts AS last_event_ts,
    client_ts AS last_client_ts,
    ( SELECT max(te2.client_ts) AS max
           FROM public.time_events te2
          WHERE ((te2.shop_id = l.shop_id) AND (te2.employee_id = l.employee_id) AND (te2.event_type = 'CLOCK_IN'::text) AND (te2.client_ts <= l.client_ts))) AS since_ts
   FROM latest l;


grant delete on table "public"."attachments" to "anon";

grant insert on table "public"."attachments" to "anon";

grant references on table "public"."attachments" to "anon";

grant select on table "public"."attachments" to "anon";

grant trigger on table "public"."attachments" to "anon";

grant truncate on table "public"."attachments" to "anon";

grant update on table "public"."attachments" to "anon";

grant delete on table "public"."attachments" to "authenticated";

grant insert on table "public"."attachments" to "authenticated";

grant references on table "public"."attachments" to "authenticated";

grant select on table "public"."attachments" to "authenticated";

grant trigger on table "public"."attachments" to "authenticated";

grant truncate on table "public"."attachments" to "authenticated";

grant update on table "public"."attachments" to "authenticated";

grant delete on table "public"."attachments" to "service_role";

grant insert on table "public"."attachments" to "service_role";

grant references on table "public"."attachments" to "service_role";

grant select on table "public"."attachments" to "service_role";

grant trigger on table "public"."attachments" to "service_role";

grant truncate on table "public"."attachments" to "service_role";

grant update on table "public"."attachments" to "service_role";

grant delete on table "public"."balloon_sets" to "anon";

grant insert on table "public"."balloon_sets" to "anon";

grant references on table "public"."balloon_sets" to "anon";

grant select on table "public"."balloon_sets" to "anon";

grant trigger on table "public"."balloon_sets" to "anon";

grant truncate on table "public"."balloon_sets" to "anon";

grant update on table "public"."balloon_sets" to "anon";

grant delete on table "public"."balloon_sets" to "authenticated";

grant insert on table "public"."balloon_sets" to "authenticated";

grant references on table "public"."balloon_sets" to "authenticated";

grant select on table "public"."balloon_sets" to "authenticated";

grant trigger on table "public"."balloon_sets" to "authenticated";

grant truncate on table "public"."balloon_sets" to "authenticated";

grant update on table "public"."balloon_sets" to "authenticated";

grant delete on table "public"."balloon_sets" to "service_role";

grant insert on table "public"."balloon_sets" to "service_role";

grant references on table "public"."balloon_sets" to "service_role";

grant select on table "public"."balloon_sets" to "service_role";

grant trigger on table "public"."balloon_sets" to "service_role";

grant truncate on table "public"."balloon_sets" to "service_role";

grant update on table "public"."balloon_sets" to "service_role";

grant delete on table "public"."chat_blocks" to "anon";

grant insert on table "public"."chat_blocks" to "anon";

grant references on table "public"."chat_blocks" to "anon";

grant select on table "public"."chat_blocks" to "anon";

grant trigger on table "public"."chat_blocks" to "anon";

grant truncate on table "public"."chat_blocks" to "anon";

grant update on table "public"."chat_blocks" to "anon";

grant delete on table "public"."chat_blocks" to "authenticated";

grant insert on table "public"."chat_blocks" to "authenticated";

grant references on table "public"."chat_blocks" to "authenticated";

grant select on table "public"."chat_blocks" to "authenticated";

grant trigger on table "public"."chat_blocks" to "authenticated";

grant truncate on table "public"."chat_blocks" to "authenticated";

grant update on table "public"."chat_blocks" to "authenticated";

grant delete on table "public"."chat_blocks" to "service_role";

grant insert on table "public"."chat_blocks" to "service_role";

grant references on table "public"."chat_blocks" to "service_role";

grant select on table "public"."chat_blocks" to "service_role";

grant trigger on table "public"."chat_blocks" to "service_role";

grant truncate on table "public"."chat_blocks" to "service_role";

grant update on table "public"."chat_blocks" to "service_role";

grant delete on table "public"."chat_messages" to "anon";

grant insert on table "public"."chat_messages" to "anon";

grant references on table "public"."chat_messages" to "anon";

grant select on table "public"."chat_messages" to "anon";

grant trigger on table "public"."chat_messages" to "anon";

grant truncate on table "public"."chat_messages" to "anon";

grant update on table "public"."chat_messages" to "anon";

grant delete on table "public"."chat_messages" to "authenticated";

grant insert on table "public"."chat_messages" to "authenticated";

grant references on table "public"."chat_messages" to "authenticated";

grant select on table "public"."chat_messages" to "authenticated";

grant trigger on table "public"."chat_messages" to "authenticated";

grant truncate on table "public"."chat_messages" to "authenticated";

grant update on table "public"."chat_messages" to "authenticated";

grant delete on table "public"."chat_messages" to "service_role";

grant insert on table "public"."chat_messages" to "service_role";

grant references on table "public"."chat_messages" to "service_role";

grant select on table "public"."chat_messages" to "service_role";

grant trigger on table "public"."chat_messages" to "service_role";

grant truncate on table "public"."chat_messages" to "service_role";

grant update on table "public"."chat_messages" to "service_role";

grant delete on table "public"."chat_thread_members" to "anon";

grant insert on table "public"."chat_thread_members" to "anon";

grant references on table "public"."chat_thread_members" to "anon";

grant select on table "public"."chat_thread_members" to "anon";

grant trigger on table "public"."chat_thread_members" to "anon";

grant truncate on table "public"."chat_thread_members" to "anon";

grant update on table "public"."chat_thread_members" to "anon";

grant delete on table "public"."chat_thread_members" to "authenticated";

grant insert on table "public"."chat_thread_members" to "authenticated";

grant references on table "public"."chat_thread_members" to "authenticated";

grant select on table "public"."chat_thread_members" to "authenticated";

grant trigger on table "public"."chat_thread_members" to "authenticated";

grant truncate on table "public"."chat_thread_members" to "authenticated";

grant update on table "public"."chat_thread_members" to "authenticated";

grant delete on table "public"."chat_thread_members" to "service_role";

grant insert on table "public"."chat_thread_members" to "service_role";

grant references on table "public"."chat_thread_members" to "service_role";

grant select on table "public"."chat_thread_members" to "service_role";

grant trigger on table "public"."chat_thread_members" to "service_role";

grant truncate on table "public"."chat_thread_members" to "service_role";

grant update on table "public"."chat_thread_members" to "service_role";

grant delete on table "public"."chat_threads" to "anon";

grant insert on table "public"."chat_threads" to "anon";

grant references on table "public"."chat_threads" to "anon";

grant select on table "public"."chat_threads" to "anon";

grant trigger on table "public"."chat_threads" to "anon";

grant truncate on table "public"."chat_threads" to "anon";

grant update on table "public"."chat_threads" to "anon";

grant delete on table "public"."chat_threads" to "authenticated";

grant insert on table "public"."chat_threads" to "authenticated";

grant references on table "public"."chat_threads" to "authenticated";

grant select on table "public"."chat_threads" to "authenticated";

grant trigger on table "public"."chat_threads" to "authenticated";

grant truncate on table "public"."chat_threads" to "authenticated";

grant update on table "public"."chat_threads" to "authenticated";

grant delete on table "public"."chat_threads" to "service_role";

grant insert on table "public"."chat_threads" to "service_role";

grant references on table "public"."chat_threads" to "service_role";

grant select on table "public"."chat_threads" to "service_role";

grant trigger on table "public"."chat_threads" to "service_role";

grant truncate on table "public"."chat_threads" to "service_role";

grant update on table "public"."chat_threads" to "service_role";

grant delete on table "public"."component_aliases" to "anon";

grant insert on table "public"."component_aliases" to "anon";

grant references on table "public"."component_aliases" to "anon";

grant select on table "public"."component_aliases" to "anon";

grant trigger on table "public"."component_aliases" to "anon";

grant truncate on table "public"."component_aliases" to "anon";

grant update on table "public"."component_aliases" to "anon";

grant delete on table "public"."component_aliases" to "authenticated";

grant insert on table "public"."component_aliases" to "authenticated";

grant references on table "public"."component_aliases" to "authenticated";

grant select on table "public"."component_aliases" to "authenticated";

grant trigger on table "public"."component_aliases" to "authenticated";

grant truncate on table "public"."component_aliases" to "authenticated";

grant update on table "public"."component_aliases" to "authenticated";

grant delete on table "public"."component_aliases" to "service_role";

grant insert on table "public"."component_aliases" to "service_role";

grant references on table "public"."component_aliases" to "service_role";

grant select on table "public"."component_aliases" to "service_role";

grant trigger on table "public"."component_aliases" to "service_role";

grant truncate on table "public"."component_aliases" to "service_role";

grant update on table "public"."component_aliases" to "service_role";

grant delete on table "public"."component_files" to "anon";

grant insert on table "public"."component_files" to "anon";

grant references on table "public"."component_files" to "anon";

grant select on table "public"."component_files" to "anon";

grant trigger on table "public"."component_files" to "anon";

grant truncate on table "public"."component_files" to "anon";

grant update on table "public"."component_files" to "anon";

grant delete on table "public"."component_files" to "authenticated";

grant insert on table "public"."component_files" to "authenticated";

grant references on table "public"."component_files" to "authenticated";

grant select on table "public"."component_files" to "authenticated";

grant trigger on table "public"."component_files" to "authenticated";

grant truncate on table "public"."component_files" to "authenticated";

grant update on table "public"."component_files" to "authenticated";

grant delete on table "public"."component_files" to "service_role";

grant insert on table "public"."component_files" to "service_role";

grant references on table "public"."component_files" to "service_role";

grant select on table "public"."component_files" to "service_role";

grant trigger on table "public"."component_files" to "service_role";

grant truncate on table "public"."component_files" to "service_role";

grant update on table "public"."component_files" to "service_role";

grant delete on table "public"."components" to "anon";

grant insert on table "public"."components" to "anon";

grant references on table "public"."components" to "anon";

grant select on table "public"."components" to "anon";

grant trigger on table "public"."components" to "anon";

grant truncate on table "public"."components" to "anon";

grant update on table "public"."components" to "anon";

grant delete on table "public"."components" to "authenticated";

grant insert on table "public"."components" to "authenticated";

grant references on table "public"."components" to "authenticated";

grant select on table "public"."components" to "authenticated";

grant trigger on table "public"."components" to "authenticated";

grant truncate on table "public"."components" to "authenticated";

grant update on table "public"."components" to "authenticated";

grant delete on table "public"."components" to "service_role";

grant insert on table "public"."components" to "service_role";

grant references on table "public"."components" to "service_role";

grant select on table "public"."components" to "service_role";

grant trigger on table "public"."components" to "service_role";

grant truncate on table "public"."components" to "service_role";

grant update on table "public"."components" to "service_role";

grant delete on table "public"."conversation_archives" to "anon";

grant insert on table "public"."conversation_archives" to "anon";

grant references on table "public"."conversation_archives" to "anon";

grant select on table "public"."conversation_archives" to "anon";

grant trigger on table "public"."conversation_archives" to "anon";

grant truncate on table "public"."conversation_archives" to "anon";

grant update on table "public"."conversation_archives" to "anon";

grant delete on table "public"."conversation_archives" to "authenticated";

grant insert on table "public"."conversation_archives" to "authenticated";

grant references on table "public"."conversation_archives" to "authenticated";

grant select on table "public"."conversation_archives" to "authenticated";

grant trigger on table "public"."conversation_archives" to "authenticated";

grant truncate on table "public"."conversation_archives" to "authenticated";

grant update on table "public"."conversation_archives" to "authenticated";

grant delete on table "public"."conversation_archives" to "service_role";

grant insert on table "public"."conversation_archives" to "service_role";

grant references on table "public"."conversation_archives" to "service_role";

grant select on table "public"."conversation_archives" to "service_role";

grant trigger on table "public"."conversation_archives" to "service_role";

grant truncate on table "public"."conversation_archives" to "service_role";

grant update on table "public"."conversation_archives" to "service_role";

grant delete on table "public"."conversation_members" to "anon";

grant insert on table "public"."conversation_members" to "anon";

grant references on table "public"."conversation_members" to "anon";

grant select on table "public"."conversation_members" to "anon";

grant trigger on table "public"."conversation_members" to "anon";

grant truncate on table "public"."conversation_members" to "anon";

grant update on table "public"."conversation_members" to "anon";

grant delete on table "public"."conversation_members" to "authenticated";

grant insert on table "public"."conversation_members" to "authenticated";

grant references on table "public"."conversation_members" to "authenticated";

grant select on table "public"."conversation_members" to "authenticated";

grant trigger on table "public"."conversation_members" to "authenticated";

grant truncate on table "public"."conversation_members" to "authenticated";

grant update on table "public"."conversation_members" to "authenticated";

grant delete on table "public"."conversation_members" to "service_role";

grant insert on table "public"."conversation_members" to "service_role";

grant references on table "public"."conversation_members" to "service_role";

grant select on table "public"."conversation_members" to "service_role";

grant trigger on table "public"."conversation_members" to "service_role";

grant truncate on table "public"."conversation_members" to "service_role";

grant update on table "public"."conversation_members" to "service_role";

grant delete on table "public"."conversations" to "anon";

grant insert on table "public"."conversations" to "anon";

grant references on table "public"."conversations" to "anon";

grant select on table "public"."conversations" to "anon";

grant trigger on table "public"."conversations" to "anon";

grant truncate on table "public"."conversations" to "anon";

grant update on table "public"."conversations" to "anon";

grant delete on table "public"."conversations" to "authenticated";

grant insert on table "public"."conversations" to "authenticated";

grant references on table "public"."conversations" to "authenticated";

grant select on table "public"."conversations" to "authenticated";

grant trigger on table "public"."conversations" to "authenticated";

grant truncate on table "public"."conversations" to "authenticated";

grant update on table "public"."conversations" to "authenticated";

grant delete on table "public"."conversations" to "service_role";

grant insert on table "public"."conversations" to "service_role";

grant references on table "public"."conversations" to "service_role";

grant select on table "public"."conversations" to "service_role";

grant trigger on table "public"."conversations" to "service_role";

grant truncate on table "public"."conversations" to "service_role";

grant update on table "public"."conversations" to "service_role";

grant delete on table "public"."daily_logs" to "anon";

grant insert on table "public"."daily_logs" to "anon";

grant references on table "public"."daily_logs" to "anon";

grant select on table "public"."daily_logs" to "anon";

grant trigger on table "public"."daily_logs" to "anon";

grant truncate on table "public"."daily_logs" to "anon";

grant update on table "public"."daily_logs" to "anon";

grant delete on table "public"."daily_logs" to "authenticated";

grant insert on table "public"."daily_logs" to "authenticated";

grant references on table "public"."daily_logs" to "authenticated";

grant select on table "public"."daily_logs" to "authenticated";

grant trigger on table "public"."daily_logs" to "authenticated";

grant truncate on table "public"."daily_logs" to "authenticated";

grant update on table "public"."daily_logs" to "authenticated";

grant delete on table "public"."daily_logs" to "service_role";

grant insert on table "public"."daily_logs" to "service_role";

grant references on table "public"."daily_logs" to "service_role";

grant select on table "public"."daily_logs" to "service_role";

grant trigger on table "public"."daily_logs" to "service_role";

grant truncate on table "public"."daily_logs" to "service_role";

grant update on table "public"."daily_logs" to "service_role";

grant delete on table "public"."employee_roles" to "anon";

grant insert on table "public"."employee_roles" to "anon";

grant references on table "public"."employee_roles" to "anon";

grant select on table "public"."employee_roles" to "anon";

grant trigger on table "public"."employee_roles" to "anon";

grant truncate on table "public"."employee_roles" to "anon";

grant update on table "public"."employee_roles" to "anon";

grant delete on table "public"."employee_roles" to "authenticated";

grant insert on table "public"."employee_roles" to "authenticated";

grant references on table "public"."employee_roles" to "authenticated";

grant select on table "public"."employee_roles" to "authenticated";

grant trigger on table "public"."employee_roles" to "authenticated";

grant truncate on table "public"."employee_roles" to "authenticated";

grant update on table "public"."employee_roles" to "authenticated";

grant delete on table "public"."employee_roles" to "service_role";

grant insert on table "public"."employee_roles" to "service_role";

grant references on table "public"."employee_roles" to "service_role";

grant select on table "public"."employee_roles" to "service_role";

grant trigger on table "public"."employee_roles" to "service_role";

grant truncate on table "public"."employee_roles" to "service_role";

grant update on table "public"."employee_roles" to "service_role";

grant delete on table "public"."employees" to "anon";

grant insert on table "public"."employees" to "anon";

grant references on table "public"."employees" to "anon";

grant select on table "public"."employees" to "anon";

grant trigger on table "public"."employees" to "anon";

grant truncate on table "public"."employees" to "anon";

grant update on table "public"."employees" to "anon";

grant delete on table "public"."employees" to "authenticated";

grant insert on table "public"."employees" to "authenticated";

grant references on table "public"."employees" to "authenticated";

grant select on table "public"."employees" to "authenticated";

grant trigger on table "public"."employees" to "authenticated";

grant truncate on table "public"."employees" to "authenticated";

grant update on table "public"."employees" to "authenticated";

grant delete on table "public"."employees" to "service_role";

grant insert on table "public"."employees" to "service_role";

grant references on table "public"."employees" to "service_role";

grant select on table "public"."employees" to "service_role";

grant trigger on table "public"."employees" to "service_role";

grant truncate on table "public"."employees" to "service_role";

grant update on table "public"."employees" to "service_role";

grant delete on table "public"."holiday_calendar" to "anon";

grant insert on table "public"."holiday_calendar" to "anon";

grant references on table "public"."holiday_calendar" to "anon";

grant select on table "public"."holiday_calendar" to "anon";

grant trigger on table "public"."holiday_calendar" to "anon";

grant truncate on table "public"."holiday_calendar" to "anon";

grant update on table "public"."holiday_calendar" to "anon";

grant delete on table "public"."holiday_calendar" to "authenticated";

grant insert on table "public"."holiday_calendar" to "authenticated";

grant references on table "public"."holiday_calendar" to "authenticated";

grant select on table "public"."holiday_calendar" to "authenticated";

grant trigger on table "public"."holiday_calendar" to "authenticated";

grant truncate on table "public"."holiday_calendar" to "authenticated";

grant update on table "public"."holiday_calendar" to "authenticated";

grant delete on table "public"."holiday_calendar" to "service_role";

grant insert on table "public"."holiday_calendar" to "service_role";

grant references on table "public"."holiday_calendar" to "service_role";

grant select on table "public"."holiday_calendar" to "service_role";

grant trigger on table "public"."holiday_calendar" to "service_role";

grant truncate on table "public"."holiday_calendar" to "service_role";

grant update on table "public"."holiday_calendar" to "service_role";

grant delete on table "public"."inspection_sets" to "anon";

grant insert on table "public"."inspection_sets" to "anon";

grant references on table "public"."inspection_sets" to "anon";

grant select on table "public"."inspection_sets" to "anon";

grant trigger on table "public"."inspection_sets" to "anon";

grant truncate on table "public"."inspection_sets" to "anon";

grant update on table "public"."inspection_sets" to "anon";

grant delete on table "public"."inspection_sets" to "authenticated";

grant insert on table "public"."inspection_sets" to "authenticated";

grant references on table "public"."inspection_sets" to "authenticated";

grant select on table "public"."inspection_sets" to "authenticated";

grant trigger on table "public"."inspection_sets" to "authenticated";

grant truncate on table "public"."inspection_sets" to "authenticated";

grant update on table "public"."inspection_sets" to "authenticated";

grant delete on table "public"."inspection_sets" to "service_role";

grant insert on table "public"."inspection_sets" to "service_role";

grant references on table "public"."inspection_sets" to "service_role";

grant select on table "public"."inspection_sets" to "service_role";

grant trigger on table "public"."inspection_sets" to "service_role";

grant truncate on table "public"."inspection_sets" to "service_role";

grant update on table "public"."inspection_sets" to "service_role";

grant delete on table "public"."jobs" to "anon";

grant insert on table "public"."jobs" to "anon";

grant references on table "public"."jobs" to "anon";

grant select on table "public"."jobs" to "anon";

grant trigger on table "public"."jobs" to "anon";

grant truncate on table "public"."jobs" to "anon";

grant update on table "public"."jobs" to "anon";

grant delete on table "public"."jobs" to "authenticated";

grant insert on table "public"."jobs" to "authenticated";

grant references on table "public"."jobs" to "authenticated";

grant select on table "public"."jobs" to "authenticated";

grant trigger on table "public"."jobs" to "authenticated";

grant truncate on table "public"."jobs" to "authenticated";

grant update on table "public"."jobs" to "authenticated";

grant delete on table "public"."jobs" to "service_role";

grant insert on table "public"."jobs" to "service_role";

grant references on table "public"."jobs" to "service_role";

grant select on table "public"."jobs" to "service_role";

grant trigger on table "public"."jobs" to "service_role";

grant truncate on table "public"."jobs" to "service_role";

grant update on table "public"."jobs" to "service_role";

grant delete on table "public"."message_reactions" to "anon";

grant insert on table "public"."message_reactions" to "anon";

grant references on table "public"."message_reactions" to "anon";

grant select on table "public"."message_reactions" to "anon";

grant trigger on table "public"."message_reactions" to "anon";

grant truncate on table "public"."message_reactions" to "anon";

grant update on table "public"."message_reactions" to "anon";

grant delete on table "public"."message_reactions" to "authenticated";

grant insert on table "public"."message_reactions" to "authenticated";

grant references on table "public"."message_reactions" to "authenticated";

grant select on table "public"."message_reactions" to "authenticated";

grant trigger on table "public"."message_reactions" to "authenticated";

grant truncate on table "public"."message_reactions" to "authenticated";

grant update on table "public"."message_reactions" to "authenticated";

grant delete on table "public"."message_reactions" to "service_role";

grant insert on table "public"."message_reactions" to "service_role";

grant references on table "public"."message_reactions" to "service_role";

grant select on table "public"."message_reactions" to "service_role";

grant trigger on table "public"."message_reactions" to "service_role";

grant truncate on table "public"."message_reactions" to "service_role";

grant update on table "public"."message_reactions" to "service_role";

grant delete on table "public"."message_reads" to "anon";

grant insert on table "public"."message_reads" to "anon";

grant references on table "public"."message_reads" to "anon";

grant select on table "public"."message_reads" to "anon";

grant trigger on table "public"."message_reads" to "anon";

grant truncate on table "public"."message_reads" to "anon";

grant update on table "public"."message_reads" to "anon";

grant delete on table "public"."message_reads" to "authenticated";

grant insert on table "public"."message_reads" to "authenticated";

grant references on table "public"."message_reads" to "authenticated";

grant select on table "public"."message_reads" to "authenticated";

grant trigger on table "public"."message_reads" to "authenticated";

grant truncate on table "public"."message_reads" to "authenticated";

grant update on table "public"."message_reads" to "authenticated";

grant delete on table "public"."message_reads" to "service_role";

grant insert on table "public"."message_reads" to "service_role";

grant references on table "public"."message_reads" to "service_role";

grant select on table "public"."message_reads" to "service_role";

grant trigger on table "public"."message_reads" to "service_role";

grant truncate on table "public"."message_reads" to "service_role";

grant update on table "public"."message_reads" to "service_role";

grant delete on table "public"."messages" to "anon";

grant insert on table "public"."messages" to "anon";

grant references on table "public"."messages" to "anon";

grant select on table "public"."messages" to "anon";

grant trigger on table "public"."messages" to "anon";

grant truncate on table "public"."messages" to "anon";

grant update on table "public"."messages" to "anon";

grant delete on table "public"."messages" to "authenticated";

grant insert on table "public"."messages" to "authenticated";

grant references on table "public"."messages" to "authenticated";

grant select on table "public"."messages" to "authenticated";

grant trigger on table "public"."messages" to "authenticated";

grant truncate on table "public"."messages" to "authenticated";

grant update on table "public"."messages" to "authenticated";

grant delete on table "public"."messages" to "service_role";

grant insert on table "public"."messages" to "service_role";

grant references on table "public"."messages" to "service_role";

grant select on table "public"."messages" to "service_role";

grant trigger on table "public"."messages" to "service_role";

grant truncate on table "public"."messages" to "service_role";

grant update on table "public"."messages" to "service_role";

grant delete on table "public"."messaging_roster" to "anon";

grant insert on table "public"."messaging_roster" to "anon";

grant references on table "public"."messaging_roster" to "anon";

grant select on table "public"."messaging_roster" to "anon";

grant trigger on table "public"."messaging_roster" to "anon";

grant truncate on table "public"."messaging_roster" to "anon";

grant update on table "public"."messaging_roster" to "anon";

grant delete on table "public"."messaging_roster" to "authenticated";

grant insert on table "public"."messaging_roster" to "authenticated";

grant references on table "public"."messaging_roster" to "authenticated";

grant select on table "public"."messaging_roster" to "authenticated";

grant trigger on table "public"."messaging_roster" to "authenticated";

grant truncate on table "public"."messaging_roster" to "authenticated";

grant update on table "public"."messaging_roster" to "authenticated";

grant delete on table "public"."messaging_roster" to "service_role";

grant insert on table "public"."messaging_roster" to "service_role";

grant references on table "public"."messaging_roster" to "service_role";

grant select on table "public"."messaging_roster" to "service_role";

grant trigger on table "public"."messaging_roster" to "service_role";

grant truncate on table "public"."messaging_roster" to "service_role";

grant update on table "public"."messaging_roster" to "service_role";

grant delete on table "public"."op_sessions" to "anon";

grant insert on table "public"."op_sessions" to "anon";

grant references on table "public"."op_sessions" to "anon";

grant select on table "public"."op_sessions" to "anon";

grant trigger on table "public"."op_sessions" to "anon";

grant truncate on table "public"."op_sessions" to "anon";

grant update on table "public"."op_sessions" to "anon";

grant delete on table "public"."op_sessions" to "authenticated";

grant insert on table "public"."op_sessions" to "authenticated";

grant references on table "public"."op_sessions" to "authenticated";

grant select on table "public"."op_sessions" to "authenticated";

grant trigger on table "public"."op_sessions" to "authenticated";

grant truncate on table "public"."op_sessions" to "authenticated";

grant update on table "public"."op_sessions" to "authenticated";

grant delete on table "public"."op_sessions" to "service_role";

grant insert on table "public"."op_sessions" to "service_role";

grant references on table "public"."op_sessions" to "service_role";

grant select on table "public"."op_sessions" to "service_role";

grant trigger on table "public"."op_sessions" to "service_role";

grant truncate on table "public"."op_sessions" to "service_role";

grant update on table "public"."op_sessions" to "service_role";

grant delete on table "public"."operations" to "anon";

grant insert on table "public"."operations" to "anon";

grant references on table "public"."operations" to "anon";

grant select on table "public"."operations" to "anon";

grant trigger on table "public"."operations" to "anon";

grant truncate on table "public"."operations" to "anon";

grant update on table "public"."operations" to "anon";

grant delete on table "public"."operations" to "authenticated";

grant insert on table "public"."operations" to "authenticated";

grant references on table "public"."operations" to "authenticated";

grant select on table "public"."operations" to "authenticated";

grant trigger on table "public"."operations" to "authenticated";

grant truncate on table "public"."operations" to "authenticated";

grant update on table "public"."operations" to "authenticated";

grant delete on table "public"."operations" to "service_role";

grant insert on table "public"."operations" to "service_role";

grant references on table "public"."operations" to "service_role";

grant select on table "public"."operations" to "service_role";

grant trigger on table "public"."operations" to "service_role";

grant truncate on table "public"."operations" to "service_role";

grant update on table "public"."operations" to "service_role";

grant delete on table "public"."operators" to "anon";

grant insert on table "public"."operators" to "anon";

grant references on table "public"."operators" to "anon";

grant select on table "public"."operators" to "anon";

grant trigger on table "public"."operators" to "anon";

grant truncate on table "public"."operators" to "anon";

grant update on table "public"."operators" to "anon";

grant delete on table "public"."operators" to "authenticated";

grant insert on table "public"."operators" to "authenticated";

grant references on table "public"."operators" to "authenticated";

grant select on table "public"."operators" to "authenticated";

grant trigger on table "public"."operators" to "authenticated";

grant truncate on table "public"."operators" to "authenticated";

grant update on table "public"."operators" to "authenticated";

grant delete on table "public"."operators" to "service_role";

grant insert on table "public"."operators" to "service_role";

grant references on table "public"."operators" to "service_role";

grant select on table "public"."operators" to "service_role";

grant trigger on table "public"."operators" to "service_role";

grant truncate on table "public"."operators" to "service_role";

grant update on table "public"."operators" to "service_role";

grant delete on table "public"."po_line_items" to "anon";

grant insert on table "public"."po_line_items" to "anon";

grant references on table "public"."po_line_items" to "anon";

grant select on table "public"."po_line_items" to "anon";

grant trigger on table "public"."po_line_items" to "anon";

grant truncate on table "public"."po_line_items" to "anon";

grant update on table "public"."po_line_items" to "anon";

grant delete on table "public"."po_line_items" to "authenticated";

grant insert on table "public"."po_line_items" to "authenticated";

grant references on table "public"."po_line_items" to "authenticated";

grant select on table "public"."po_line_items" to "authenticated";

grant trigger on table "public"."po_line_items" to "authenticated";

grant truncate on table "public"."po_line_items" to "authenticated";

grant update on table "public"."po_line_items" to "authenticated";

grant delete on table "public"."po_line_items" to "service_role";

grant insert on table "public"."po_line_items" to "service_role";

grant references on table "public"."po_line_items" to "service_role";

grant select on table "public"."po_line_items" to "service_role";

grant trigger on table "public"."po_line_items" to "service_role";

grant truncate on table "public"."po_line_items" to "service_role";

grant update on table "public"."po_line_items" to "service_role";

grant delete on table "public"."purchase_orders" to "anon";

grant insert on table "public"."purchase_orders" to "anon";

grant references on table "public"."purchase_orders" to "anon";

grant select on table "public"."purchase_orders" to "anon";

grant trigger on table "public"."purchase_orders" to "anon";

grant truncate on table "public"."purchase_orders" to "anon";

grant update on table "public"."purchase_orders" to "anon";

grant delete on table "public"."purchase_orders" to "authenticated";

grant insert on table "public"."purchase_orders" to "authenticated";

grant references on table "public"."purchase_orders" to "authenticated";

grant select on table "public"."purchase_orders" to "authenticated";

grant trigger on table "public"."purchase_orders" to "authenticated";

grant truncate on table "public"."purchase_orders" to "authenticated";

grant update on table "public"."purchase_orders" to "authenticated";

grant delete on table "public"."purchase_orders" to "service_role";

grant insert on table "public"."purchase_orders" to "service_role";

grant references on table "public"."purchase_orders" to "service_role";

grant select on table "public"."purchase_orders" to "service_role";

grant trigger on table "public"."purchase_orders" to "service_role";

grant truncate on table "public"."purchase_orders" to "service_role";

grant update on table "public"."purchase_orders" to "service_role";

grant delete on table "public"."push_tokens" to "anon";

grant insert on table "public"."push_tokens" to "anon";

grant references on table "public"."push_tokens" to "anon";

grant select on table "public"."push_tokens" to "anon";

grant trigger on table "public"."push_tokens" to "anon";

grant truncate on table "public"."push_tokens" to "anon";

grant update on table "public"."push_tokens" to "anon";

grant delete on table "public"."push_tokens" to "authenticated";

grant insert on table "public"."push_tokens" to "authenticated";

grant references on table "public"."push_tokens" to "authenticated";

grant select on table "public"."push_tokens" to "authenticated";

grant trigger on table "public"."push_tokens" to "authenticated";

grant truncate on table "public"."push_tokens" to "authenticated";

grant update on table "public"."push_tokens" to "authenticated";

grant delete on table "public"."push_tokens" to "service_role";

grant insert on table "public"."push_tokens" to "service_role";

grant references on table "public"."push_tokens" to "service_role";

grant select on table "public"."push_tokens" to "service_role";

grant trigger on table "public"."push_tokens" to "service_role";

grant truncate on table "public"."push_tokens" to "service_role";

grant update on table "public"."push_tokens" to "service_role";

grant delete on table "public"."rb_audit" to "anon";

grant insert on table "public"."rb_audit" to "anon";

grant references on table "public"."rb_audit" to "anon";

grant select on table "public"."rb_audit" to "anon";

grant trigger on table "public"."rb_audit" to "anon";

grant truncate on table "public"."rb_audit" to "anon";

grant update on table "public"."rb_audit" to "anon";

grant delete on table "public"."rb_audit" to "authenticated";

grant insert on table "public"."rb_audit" to "authenticated";

grant references on table "public"."rb_audit" to "authenticated";

grant select on table "public"."rb_audit" to "authenticated";

grant trigger on table "public"."rb_audit" to "authenticated";

grant truncate on table "public"."rb_audit" to "authenticated";

grant update on table "public"."rb_audit" to "authenticated";

grant delete on table "public"."rb_audit" to "service_role";

grant insert on table "public"."rb_audit" to "service_role";

grant references on table "public"."rb_audit" to "service_role";

grant select on table "public"."rb_audit" to "service_role";

grant trigger on table "public"."rb_audit" to "service_role";

grant truncate on table "public"."rb_audit" to "service_role";

grant update on table "public"."rb_audit" to "service_role";

grant delete on table "public"."rb_control_admins" to "anon";

grant insert on table "public"."rb_control_admins" to "anon";

grant references on table "public"."rb_control_admins" to "anon";

grant select on table "public"."rb_control_admins" to "anon";

grant trigger on table "public"."rb_control_admins" to "anon";

grant truncate on table "public"."rb_control_admins" to "anon";

grant update on table "public"."rb_control_admins" to "anon";

grant delete on table "public"."rb_control_admins" to "authenticated";

grant insert on table "public"."rb_control_admins" to "authenticated";

grant references on table "public"."rb_control_admins" to "authenticated";

grant select on table "public"."rb_control_admins" to "authenticated";

grant trigger on table "public"."rb_control_admins" to "authenticated";

grant truncate on table "public"."rb_control_admins" to "authenticated";

grant update on table "public"."rb_control_admins" to "authenticated";

grant delete on table "public"."rb_control_admins" to "service_role";

grant insert on table "public"."rb_control_admins" to "service_role";

grant references on table "public"."rb_control_admins" to "service_role";

grant select on table "public"."rb_control_admins" to "service_role";

grant trigger on table "public"."rb_control_admins" to "service_role";

grant truncate on table "public"."rb_control_admins" to "service_role";

grant update on table "public"."rb_control_admins" to "service_role";

grant delete on table "public"."rb_device_activation_tokens" to "anon";

grant insert on table "public"."rb_device_activation_tokens" to "anon";

grant references on table "public"."rb_device_activation_tokens" to "anon";

grant select on table "public"."rb_device_activation_tokens" to "anon";

grant trigger on table "public"."rb_device_activation_tokens" to "anon";

grant truncate on table "public"."rb_device_activation_tokens" to "anon";

grant update on table "public"."rb_device_activation_tokens" to "anon";

grant delete on table "public"."rb_device_activation_tokens" to "authenticated";

grant insert on table "public"."rb_device_activation_tokens" to "authenticated";

grant references on table "public"."rb_device_activation_tokens" to "authenticated";

grant select on table "public"."rb_device_activation_tokens" to "authenticated";

grant trigger on table "public"."rb_device_activation_tokens" to "authenticated";

grant truncate on table "public"."rb_device_activation_tokens" to "authenticated";

grant update on table "public"."rb_device_activation_tokens" to "authenticated";

grant delete on table "public"."rb_device_activation_tokens" to "service_role";

grant insert on table "public"."rb_device_activation_tokens" to "service_role";

grant references on table "public"."rb_device_activation_tokens" to "service_role";

grant select on table "public"."rb_device_activation_tokens" to "service_role";

grant trigger on table "public"."rb_device_activation_tokens" to "service_role";

grant truncate on table "public"."rb_device_activation_tokens" to "service_role";

grant update on table "public"."rb_device_activation_tokens" to "service_role";

grant delete on table "public"."rb_devices" to "anon";

grant insert on table "public"."rb_devices" to "anon";

grant references on table "public"."rb_devices" to "anon";

grant select on table "public"."rb_devices" to "anon";

grant trigger on table "public"."rb_devices" to "anon";

grant truncate on table "public"."rb_devices" to "anon";

grant update on table "public"."rb_devices" to "anon";

grant delete on table "public"."rb_devices" to "authenticated";

grant insert on table "public"."rb_devices" to "authenticated";

grant references on table "public"."rb_devices" to "authenticated";

grant select on table "public"."rb_devices" to "authenticated";

grant trigger on table "public"."rb_devices" to "authenticated";

grant truncate on table "public"."rb_devices" to "authenticated";

grant update on table "public"."rb_devices" to "authenticated";

grant delete on table "public"."rb_devices" to "service_role";

grant insert on table "public"."rb_devices" to "service_role";

grant references on table "public"."rb_devices" to "service_role";

grant select on table "public"."rb_devices" to "service_role";

grant trigger on table "public"."rb_devices" to "service_role";

grant truncate on table "public"."rb_devices" to "service_role";

grant update on table "public"."rb_devices" to "service_role";

grant delete on table "public"."rb_shop_members" to "anon";

grant insert on table "public"."rb_shop_members" to "anon";

grant references on table "public"."rb_shop_members" to "anon";

grant select on table "public"."rb_shop_members" to "anon";

grant trigger on table "public"."rb_shop_members" to "anon";

grant truncate on table "public"."rb_shop_members" to "anon";

grant update on table "public"."rb_shop_members" to "anon";

grant delete on table "public"."rb_shop_members" to "authenticated";

grant insert on table "public"."rb_shop_members" to "authenticated";

grant references on table "public"."rb_shop_members" to "authenticated";

grant select on table "public"."rb_shop_members" to "authenticated";

grant trigger on table "public"."rb_shop_members" to "authenticated";

grant truncate on table "public"."rb_shop_members" to "authenticated";

grant update on table "public"."rb_shop_members" to "authenticated";

grant delete on table "public"."rb_shop_members" to "service_role";

grant insert on table "public"."rb_shop_members" to "service_role";

grant references on table "public"."rb_shop_members" to "service_role";

grant select on table "public"."rb_shop_members" to "service_role";

grant trigger on table "public"."rb_shop_members" to "service_role";

grant truncate on table "public"."rb_shop_members" to "service_role";

grant update on table "public"."rb_shop_members" to "service_role";

grant delete on table "public"."rb_shops" to "anon";

grant insert on table "public"."rb_shops" to "anon";

grant references on table "public"."rb_shops" to "anon";

grant select on table "public"."rb_shops" to "anon";

grant trigger on table "public"."rb_shops" to "anon";

grant truncate on table "public"."rb_shops" to "anon";

grant update on table "public"."rb_shops" to "anon";

grant delete on table "public"."rb_shops" to "authenticated";

grant insert on table "public"."rb_shops" to "authenticated";

grant references on table "public"."rb_shops" to "authenticated";

grant select on table "public"."rb_shops" to "authenticated";

grant trigger on table "public"."rb_shops" to "authenticated";

grant truncate on table "public"."rb_shops" to "authenticated";

grant update on table "public"."rb_shops" to "authenticated";

grant delete on table "public"."rb_shops" to "service_role";

grant insert on table "public"."rb_shops" to "service_role";

grant references on table "public"."rb_shops" to "service_role";

grant select on table "public"."rb_shops" to "service_role";

grant trigger on table "public"."rb_shops" to "service_role";

grant truncate on table "public"."rb_shops" to "service_role";

grant update on table "public"."rb_shops" to "service_role";

grant delete on table "public"."rb_support_bundles" to "anon";

grant insert on table "public"."rb_support_bundles" to "anon";

grant references on table "public"."rb_support_bundles" to "anon";

grant select on table "public"."rb_support_bundles" to "anon";

grant trigger on table "public"."rb_support_bundles" to "anon";

grant truncate on table "public"."rb_support_bundles" to "anon";

grant update on table "public"."rb_support_bundles" to "anon";

grant delete on table "public"."rb_support_bundles" to "authenticated";

grant insert on table "public"."rb_support_bundles" to "authenticated";

grant references on table "public"."rb_support_bundles" to "authenticated";

grant select on table "public"."rb_support_bundles" to "authenticated";

grant trigger on table "public"."rb_support_bundles" to "authenticated";

grant truncate on table "public"."rb_support_bundles" to "authenticated";

grant update on table "public"."rb_support_bundles" to "authenticated";

grant delete on table "public"."rb_support_bundles" to "service_role";

grant insert on table "public"."rb_support_bundles" to "service_role";

grant references on table "public"."rb_support_bundles" to "service_role";

grant select on table "public"."rb_support_bundles" to "service_role";

grant trigger on table "public"."rb_support_bundles" to "service_role";

grant truncate on table "public"."rb_support_bundles" to "service_role";

grant update on table "public"."rb_support_bundles" to "service_role";

grant delete on table "public"."rb_update_packages" to "anon";

grant insert on table "public"."rb_update_packages" to "anon";

grant references on table "public"."rb_update_packages" to "anon";

grant select on table "public"."rb_update_packages" to "anon";

grant trigger on table "public"."rb_update_packages" to "anon";

grant truncate on table "public"."rb_update_packages" to "anon";

grant update on table "public"."rb_update_packages" to "anon";

grant delete on table "public"."rb_update_packages" to "authenticated";

grant insert on table "public"."rb_update_packages" to "authenticated";

grant references on table "public"."rb_update_packages" to "authenticated";

grant select on table "public"."rb_update_packages" to "authenticated";

grant trigger on table "public"."rb_update_packages" to "authenticated";

grant truncate on table "public"."rb_update_packages" to "authenticated";

grant update on table "public"."rb_update_packages" to "authenticated";

grant delete on table "public"."rb_update_packages" to "service_role";

grant insert on table "public"."rb_update_packages" to "service_role";

grant references on table "public"."rb_update_packages" to "service_role";

grant select on table "public"."rb_update_packages" to "service_role";

grant trigger on table "public"."rb_update_packages" to "service_role";

grant truncate on table "public"."rb_update_packages" to "service_role";

grant update on table "public"."rb_update_packages" to "service_role";

grant delete on table "public"."rb_update_policy" to "anon";

grant insert on table "public"."rb_update_policy" to "anon";

grant references on table "public"."rb_update_policy" to "anon";

grant select on table "public"."rb_update_policy" to "anon";

grant trigger on table "public"."rb_update_policy" to "anon";

grant truncate on table "public"."rb_update_policy" to "anon";

grant update on table "public"."rb_update_policy" to "anon";

grant delete on table "public"."rb_update_policy" to "authenticated";

grant insert on table "public"."rb_update_policy" to "authenticated";

grant references on table "public"."rb_update_policy" to "authenticated";

grant select on table "public"."rb_update_policy" to "authenticated";

grant trigger on table "public"."rb_update_policy" to "authenticated";

grant truncate on table "public"."rb_update_policy" to "authenticated";

grant update on table "public"."rb_update_policy" to "authenticated";

grant delete on table "public"."rb_update_policy" to "service_role";

grant insert on table "public"."rb_update_policy" to "service_role";

grant references on table "public"."rb_update_policy" to "service_role";

grant select on table "public"."rb_update_policy" to "service_role";

grant trigger on table "public"."rb_update_policy" to "service_role";

grant truncate on table "public"."rb_update_policy" to "service_role";

grant update on table "public"."rb_update_policy" to "service_role";

grant delete on table "public"."rb_user_prefs" to "anon";

grant insert on table "public"."rb_user_prefs" to "anon";

grant references on table "public"."rb_user_prefs" to "anon";

grant select on table "public"."rb_user_prefs" to "anon";

grant trigger on table "public"."rb_user_prefs" to "anon";

grant truncate on table "public"."rb_user_prefs" to "anon";

grant update on table "public"."rb_user_prefs" to "anon";

grant delete on table "public"."rb_user_prefs" to "authenticated";

grant insert on table "public"."rb_user_prefs" to "authenticated";

grant references on table "public"."rb_user_prefs" to "authenticated";

grant select on table "public"."rb_user_prefs" to "authenticated";

grant trigger on table "public"."rb_user_prefs" to "authenticated";

grant truncate on table "public"."rb_user_prefs" to "authenticated";

grant update on table "public"."rb_user_prefs" to "authenticated";

grant delete on table "public"."rb_user_prefs" to "service_role";

grant insert on table "public"."rb_user_prefs" to "service_role";

grant references on table "public"."rb_user_prefs" to "service_role";

grant select on table "public"."rb_user_prefs" to "service_role";

grant trigger on table "public"."rb_user_prefs" to "service_role";

grant truncate on table "public"."rb_user_prefs" to "service_role";

grant update on table "public"."rb_user_prefs" to "service_role";

grant delete on table "public"."routing_operations" to "anon";

grant insert on table "public"."routing_operations" to "anon";

grant references on table "public"."routing_operations" to "anon";

grant select on table "public"."routing_operations" to "anon";

grant trigger on table "public"."routing_operations" to "anon";

grant truncate on table "public"."routing_operations" to "anon";

grant update on table "public"."routing_operations" to "anon";

grant delete on table "public"."routing_operations" to "authenticated";

grant insert on table "public"."routing_operations" to "authenticated";

grant references on table "public"."routing_operations" to "authenticated";

grant select on table "public"."routing_operations" to "authenticated";

grant trigger on table "public"."routing_operations" to "authenticated";

grant truncate on table "public"."routing_operations" to "authenticated";

grant update on table "public"."routing_operations" to "authenticated";

grant delete on table "public"."routing_operations" to "service_role";

grant insert on table "public"."routing_operations" to "service_role";

grant references on table "public"."routing_operations" to "service_role";

grant select on table "public"."routing_operations" to "service_role";

grant trigger on table "public"."routing_operations" to "service_role";

grant truncate on table "public"."routing_operations" to "service_role";

grant update on table "public"."routing_operations" to "service_role";

grant delete on table "public"."shop_members" to "anon";

grant insert on table "public"."shop_members" to "anon";

grant references on table "public"."shop_members" to "anon";

grant select on table "public"."shop_members" to "anon";

grant trigger on table "public"."shop_members" to "anon";

grant truncate on table "public"."shop_members" to "anon";

grant update on table "public"."shop_members" to "anon";

grant delete on table "public"."shop_members" to "authenticated";

grant insert on table "public"."shop_members" to "authenticated";

grant references on table "public"."shop_members" to "authenticated";

grant select on table "public"."shop_members" to "authenticated";

grant trigger on table "public"."shop_members" to "authenticated";

grant truncate on table "public"."shop_members" to "authenticated";

grant update on table "public"."shop_members" to "authenticated";

grant delete on table "public"."shop_members" to "service_role";

grant insert on table "public"."shop_members" to "service_role";

grant references on table "public"."shop_members" to "service_role";

grant select on table "public"."shop_members" to "service_role";

grant trigger on table "public"."shop_members" to "service_role";

grant truncate on table "public"."shop_members" to "service_role";

grant update on table "public"."shop_members" to "service_role";

grant delete on table "public"."tenants" to "anon";

grant insert on table "public"."tenants" to "anon";

grant references on table "public"."tenants" to "anon";

grant select on table "public"."tenants" to "anon";

grant trigger on table "public"."tenants" to "anon";

grant truncate on table "public"."tenants" to "anon";

grant update on table "public"."tenants" to "anon";

grant delete on table "public"."tenants" to "authenticated";

grant insert on table "public"."tenants" to "authenticated";

grant references on table "public"."tenants" to "authenticated";

grant select on table "public"."tenants" to "authenticated";

grant trigger on table "public"."tenants" to "authenticated";

grant truncate on table "public"."tenants" to "authenticated";

grant update on table "public"."tenants" to "authenticated";

grant delete on table "public"."tenants" to "service_role";

grant insert on table "public"."tenants" to "service_role";

grant references on table "public"."tenants" to "service_role";

grant select on table "public"."tenants" to "service_role";

grant trigger on table "public"."tenants" to "service_role";

grant truncate on table "public"."tenants" to "service_role";

grant update on table "public"."tenants" to "service_role";

grant delete on table "public"."time_events" to "anon";

grant insert on table "public"."time_events" to "anon";

grant references on table "public"."time_events" to "anon";

grant select on table "public"."time_events" to "anon";

grant trigger on table "public"."time_events" to "anon";

grant truncate on table "public"."time_events" to "anon";

grant update on table "public"."time_events" to "anon";

grant delete on table "public"."time_events" to "authenticated";

grant insert on table "public"."time_events" to "authenticated";

grant references on table "public"."time_events" to "authenticated";

grant select on table "public"."time_events" to "authenticated";

grant trigger on table "public"."time_events" to "authenticated";

grant truncate on table "public"."time_events" to "authenticated";

grant update on table "public"."time_events" to "authenticated";

grant delete on table "public"."time_events" to "service_role";

grant insert on table "public"."time_events" to "service_role";

grant references on table "public"."time_events" to "service_role";

grant select on table "public"."time_events" to "service_role";

grant trigger on table "public"."time_events" to "service_role";

grant truncate on table "public"."time_events" to "service_role";

grant update on table "public"."time_events" to "service_role";

grant delete on table "public"."time_off_balances" to "anon";

grant insert on table "public"."time_off_balances" to "anon";

grant references on table "public"."time_off_balances" to "anon";

grant select on table "public"."time_off_balances" to "anon";

grant trigger on table "public"."time_off_balances" to "anon";

grant truncate on table "public"."time_off_balances" to "anon";

grant update on table "public"."time_off_balances" to "anon";

grant delete on table "public"."time_off_balances" to "authenticated";

grant insert on table "public"."time_off_balances" to "authenticated";

grant references on table "public"."time_off_balances" to "authenticated";

grant select on table "public"."time_off_balances" to "authenticated";

grant trigger on table "public"."time_off_balances" to "authenticated";

grant truncate on table "public"."time_off_balances" to "authenticated";

grant update on table "public"."time_off_balances" to "authenticated";

grant delete on table "public"."time_off_balances" to "service_role";

grant insert on table "public"."time_off_balances" to "service_role";

grant references on table "public"."time_off_balances" to "service_role";

grant select on table "public"."time_off_balances" to "service_role";

grant trigger on table "public"."time_off_balances" to "service_role";

grant truncate on table "public"."time_off_balances" to "service_role";

grant update on table "public"."time_off_balances" to "service_role";

grant delete on table "public"."time_off_policy" to "anon";

grant insert on table "public"."time_off_policy" to "anon";

grant references on table "public"."time_off_policy" to "anon";

grant select on table "public"."time_off_policy" to "anon";

grant trigger on table "public"."time_off_policy" to "anon";

grant truncate on table "public"."time_off_policy" to "anon";

grant update on table "public"."time_off_policy" to "anon";

grant delete on table "public"."time_off_policy" to "authenticated";

grant insert on table "public"."time_off_policy" to "authenticated";

grant references on table "public"."time_off_policy" to "authenticated";

grant select on table "public"."time_off_policy" to "authenticated";

grant trigger on table "public"."time_off_policy" to "authenticated";

grant truncate on table "public"."time_off_policy" to "authenticated";

grant update on table "public"."time_off_policy" to "authenticated";

grant delete on table "public"."time_off_policy" to "service_role";

grant insert on table "public"."time_off_policy" to "service_role";

grant references on table "public"."time_off_policy" to "service_role";

grant select on table "public"."time_off_policy" to "service_role";

grant trigger on table "public"."time_off_policy" to "service_role";

grant truncate on table "public"."time_off_policy" to "service_role";

grant update on table "public"."time_off_policy" to "service_role";

grant delete on table "public"."time_off_requests" to "anon";

grant insert on table "public"."time_off_requests" to "anon";

grant references on table "public"."time_off_requests" to "anon";

grant select on table "public"."time_off_requests" to "anon";

grant trigger on table "public"."time_off_requests" to "anon";

grant truncate on table "public"."time_off_requests" to "anon";

grant update on table "public"."time_off_requests" to "anon";

grant delete on table "public"."time_off_requests" to "authenticated";

grant insert on table "public"."time_off_requests" to "authenticated";

grant references on table "public"."time_off_requests" to "authenticated";

grant select on table "public"."time_off_requests" to "authenticated";

grant trigger on table "public"."time_off_requests" to "authenticated";

grant truncate on table "public"."time_off_requests" to "authenticated";

grant update on table "public"."time_off_requests" to "authenticated";

grant delete on table "public"."time_off_requests" to "service_role";

grant insert on table "public"."time_off_requests" to "service_role";

grant references on table "public"."time_off_requests" to "service_role";

grant select on table "public"."time_off_requests" to "service_role";

grant trigger on table "public"."time_off_requests" to "service_role";

grant truncate on table "public"."time_off_requests" to "service_role";

grant update on table "public"."time_off_requests" to "service_role";

grant delete on table "public"."timeclock_settings" to "anon";

grant insert on table "public"."timeclock_settings" to "anon";

grant references on table "public"."timeclock_settings" to "anon";

grant select on table "public"."timeclock_settings" to "anon";

grant trigger on table "public"."timeclock_settings" to "anon";

grant truncate on table "public"."timeclock_settings" to "anon";

grant update on table "public"."timeclock_settings" to "anon";

grant delete on table "public"."timeclock_settings" to "authenticated";

grant insert on table "public"."timeclock_settings" to "authenticated";

grant references on table "public"."timeclock_settings" to "authenticated";

grant select on table "public"."timeclock_settings" to "authenticated";

grant trigger on table "public"."timeclock_settings" to "authenticated";

grant truncate on table "public"."timeclock_settings" to "authenticated";

grant update on table "public"."timeclock_settings" to "authenticated";

grant delete on table "public"."timeclock_settings" to "service_role";

grant insert on table "public"."timeclock_settings" to "service_role";

grant references on table "public"."timeclock_settings" to "service_role";

grant select on table "public"."timeclock_settings" to "service_role";

grant trigger on table "public"."timeclock_settings" to "service_role";

grant truncate on table "public"."timeclock_settings" to "service_role";

grant update on table "public"."timeclock_settings" to "service_role";

grant delete on table "public"."travelers" to "anon";

grant insert on table "public"."travelers" to "anon";

grant references on table "public"."travelers" to "anon";

grant select on table "public"."travelers" to "anon";

grant trigger on table "public"."travelers" to "anon";

grant truncate on table "public"."travelers" to "anon";

grant update on table "public"."travelers" to "anon";

grant delete on table "public"."travelers" to "authenticated";

grant insert on table "public"."travelers" to "authenticated";

grant references on table "public"."travelers" to "authenticated";

grant select on table "public"."travelers" to "authenticated";

grant trigger on table "public"."travelers" to "authenticated";

grant truncate on table "public"."travelers" to "authenticated";

grant update on table "public"."travelers" to "authenticated";

grant delete on table "public"."travelers" to "service_role";

grant insert on table "public"."travelers" to "service_role";

grant references on table "public"."travelers" to "service_role";

grant select on table "public"."travelers" to "service_role";

grant trigger on table "public"."travelers" to "service_role";

grant truncate on table "public"."travelers" to "service_role";

grant update on table "public"."travelers" to "service_role";


  create policy "conversation_archives_delete_self"
  on "public"."conversation_archives"
  as permissive
  for delete
  to authenticated
using ((employee_id = public.rb_current_employee_id(shop_id)));



  create policy "conversation_archives_insert_self"
  on "public"."conversation_archives"
  as permissive
  for insert
  to authenticated
with check ((employee_id = public.rb_current_employee_id(shop_id)));



  create policy "conversation_archives_select_self"
  on "public"."conversation_archives"
  as permissive
  for select
  to authenticated
using ((employee_id = public.rb_current_employee_id(shop_id)));



  create policy "cm_read_own_memberships"
  on "public"."conversation_members"
  as permissive
  for select
  to authenticated
using (((shop_id = shop_id) AND (employee_id = public.rb_current_employee_id(shop_id))));



  create policy "conversation_members_select_self"
  on "public"."conversation_members"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.auth_user_id = auth.uid()) AND (e.shop_id = conversation_members.shop_id) AND (e.id = conversation_members.employee_id)))));



  create policy "conversations_insert_active"
  on "public"."conversations"
  as permissive
  for insert
  to public
with check (((shop_id = (public.current_employee()).shop_id) AND (created_by = (public.current_employee()).id) AND (is_active = true)));



  create policy "conversations_read_if_member"
  on "public"."conversations"
  as permissive
  for select
  to authenticated
using ((public.rb_is_conversation_member(shop_id, id) = true));



  create policy "conversations_select_member"
  on "public"."conversations"
  as permissive
  for select
  to public
using (((public.my_roster_active(shop_id) = true) AND (EXISTS ( SELECT 1
   FROM public.conversation_members cm
  WHERE ((cm.conversation_id = conversations.id) AND (cm.employee_id = public.my_employee_id(conversations.shop_id)))))));



  create policy "conversations_update_foreman"
  on "public"."conversations"
  as permissive
  for update
  to public
using (((shop_id = (public.current_employee()).shop_id) AND ((public.current_employee()).role = 'foreman'::text)))
with check (((shop_id = (public.current_employee()).shop_id) AND ((public.current_employee()).role = 'foreman'::text)));



  create policy "employee_roles_manage"
  on "public"."employee_roles"
  as permissive
  for all
  to authenticated
using (public.is_foreman(shop_id))
with check (public.is_foreman(shop_id));



  create policy "employee_roles_select"
  on "public"."employee_roles"
  as permissive
  for select
  to authenticated
using ((shop_id = ( SELECT my_employee.shop_id
   FROM public.my_employee() my_employee(id, shop_id))));



  create policy "employees read self"
  on "public"."employees"
  as permissive
  for select
  to public
using ((auth_user_id = auth.uid()));



  create policy "employees_foreman_manage"
  on "public"."employees"
  as permissive
  for all
  to public
using ((((public.current_employee()).role = 'foreman'::text) AND (shop_id = (public.current_employee()).shop_id)))
with check ((((public.current_employee()).role = 'foreman'::text) AND (shop_id = (public.current_employee()).shop_id)));



  create policy "employees_read_if_active_in_messaging"
  on "public"."employees"
  as permissive
  for select
  to authenticated
using ((public.rb_is_active_in_messaging(shop_id) = true));



  create policy "employees_select_own"
  on "public"."employees"
  as permissive
  for select
  to authenticated
using ((auth_user_id = auth.uid()));



  create policy "employees_select_same_shop"
  on "public"."employees"
  as permissive
  for select
  to public
using (((is_active = true) AND (shop_id = (public.current_employee()).shop_id)));



  create policy "employees_select_self"
  on "public"."employees"
  as permissive
  for select
  to public
using ((auth_user_id = auth.uid()));



  create policy "employees_update_self"
  on "public"."employees"
  as permissive
  for update
  to authenticated
using ((auth_user_id = auth.uid()))
with check ((auth_user_id = auth.uid()));



  create policy "holiday_manage"
  on "public"."holiday_calendar"
  as permissive
  for all
  to authenticated
using (public.is_foreman(shop_id))
with check (public.is_foreman(shop_id));



  create policy "holiday_select"
  on "public"."holiday_calendar"
  as permissive
  for select
  to authenticated
using ((shop_id = ( SELECT my_employee.shop_id
   FROM public.my_employee() my_employee(id, shop_id))));



  create policy "mr_delete_self"
  on "public"."message_reactions"
  as permissive
  for delete
  to public
using ((employee_id = public.get_my_employee_id(shop_id)));



  create policy "mr_insert_self_member"
  on "public"."message_reactions"
  as permissive
  for insert
  to public
with check (((employee_id = public.get_my_employee_id(shop_id)) AND (EXISTS ( SELECT 1
   FROM public.conversation_members cm
  WHERE ((cm.shop_id = cm.shop_id) AND (cm.conversation_id = cm.conversation_id) AND (cm.employee_id = public.get_my_employee_id(cm.shop_id)))))));



  create policy "mr_select_member"
  on "public"."message_reactions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.conversation_members cm
  WHERE ((cm.shop_id = message_reactions.shop_id) AND (cm.conversation_id = message_reactions.conversation_id) AND (cm.employee_id = public.get_my_employee_id(message_reactions.shop_id))))));



  create policy "message_reads_select_for_members"
  on "public"."message_reads"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.conversation_members cm
     JOIN public.conversations c ON ((c.id = cm.conversation_id)))
  WHERE ((cm.conversation_id = message_reads.conversation_id) AND (cm.employee_id = public.rb_current_employee_id(c.shop_id)) AND (c.shop_id = cm.shop_id)))));



  create policy "message_reads_write_own_row"
  on "public"."message_reads"
  as permissive
  for insert
  to authenticated
with check ((employee_id = ( SELECT public.rb_current_employee_id(c.shop_id) AS rb_current_employee_id
   FROM public.conversations c
  WHERE (c.id = message_reads.conversation_id)
 LIMIT 1)));



  create policy "reads_upsert_self"
  on "public"."message_reads"
  as permissive
  for all
  to public
using ((employee_id = (public.current_employee()).id))
with check ((employee_id = (public.current_employee()).id));



  create policy "messages read if member & active"
  on "public"."messages"
  as permissive
  for select
  to public
using ((public.is_messaging_active_employee(shop_id) AND (EXISTS ( SELECT 1
   FROM public.conversation_members cm
  WHERE ((cm.conversation_id = cm.conversation_id) AND (cm.employee_id = public.current_employee_id(messages.shop_id)))))));



  create policy "messages send if member & active"
  on "public"."messages"
  as permissive
  for insert
  to public
with check ((public.is_messaging_active_employee(shop_id) AND (sender_employee_id = public.current_employee_id(shop_id)) AND (EXISTS ( SELECT 1
   FROM public.conversation_members cm
  WHERE ((cm.conversation_id = cm.conversation_id) AND (cm.employee_id = public.current_employee_id(messages.shop_id)))))));



  create policy "messages_insert_if_member_and_sender_is_me"
  on "public"."messages"
  as permissive
  for insert
  to authenticated
with check (((public.rb_is_active_in_messaging(shop_id) = true) AND (public.rb_is_conversation_member(shop_id, conversation_id) = true) AND (sender_employee_id = public.rb_current_employee_id(shop_id))));



  create policy "messages_insert_member"
  on "public"."messages"
  as permissive
  for insert
  to public
with check (((shop_id = (public.current_employee()).shop_id) AND (sender_employee_id = (public.current_employee()).id) AND (EXISTS ( SELECT 1
   FROM public.conversation_members cm
  WHERE ((cm.conversation_id = messages.conversation_id) AND (cm.employee_id = (public.current_employee()).id) AND (cm.is_active = true))))));



  create policy "messages_insert_self"
  on "public"."messages"
  as permissive
  for insert
  to public
with check (((public.my_roster_active(shop_id) = true) AND (sender_employee_id = public.my_employee_id(shop_id)) AND (EXISTS ( SELECT 1
   FROM public.conversation_members cm
  WHERE ((cm.conversation_id = messages.conversation_id) AND (cm.employee_id = public.my_employee_id(messages.shop_id)))))));



  create policy "messages_read_if_member_and_active"
  on "public"."messages"
  as permissive
  for select
  to authenticated
using (((public.rb_is_active_in_messaging(shop_id) = true) AND (public.rb_is_conversation_member(shop_id, conversation_id) = true) AND (deleted_at IS NULL)));



  create policy "messages_select_if_in_convo"
  on "public"."messages"
  as permissive
  for select
  to public
using (((public.my_roster_active(shop_id) = true) AND (EXISTS ( SELECT 1
   FROM public.conversation_members cm
  WHERE ((cm.conversation_id = messages.conversation_id) AND (cm.employee_id = public.my_employee_id(messages.shop_id)))))));



  create policy "messages_select_member"
  on "public"."messages"
  as permissive
  for select
  to public
using (((shop_id = (public.current_employee()).shop_id) AND (EXISTS ( SELECT 1
   FROM public.conversation_members cm
  WHERE ((cm.conversation_id = messages.conversation_id) AND (cm.employee_id = (public.current_employee()).id) AND (cm.is_active = true))))));



  create policy "messaging_roster_read_if_active"
  on "public"."messaging_roster"
  as permissive
  for select
  to authenticated
using ((public.rb_is_active_in_messaging(shop_id) = true));



  create policy "roster_select_shop_member"
  on "public"."messaging_roster"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.auth_user_id = auth.uid()) AND (e.shop_id = messaging_roster.shop_id)))));



  create policy "push_tokens_delete_self"
  on "public"."push_tokens"
  as permissive
  for delete
  to public
using ((employee_id = public.rb_current_employee_id(shop_id)));



  create policy "push_tokens_insert_self"
  on "public"."push_tokens"
  as permissive
  for insert
  to public
with check ((employee_id = public.rb_current_employee_id(shop_id)));



  create policy "push_tokens_select_self"
  on "public"."push_tokens"
  as permissive
  for select
  to public
using ((employee_id = public.rb_current_employee_id(shop_id)));



  create policy "push_tokens_update_self"
  on "public"."push_tokens"
  as permissive
  for update
  to public
using ((employee_id = public.rb_current_employee_id(shop_id)))
with check ((employee_id = public.rb_current_employee_id(shop_id)));



  create policy "audit_select_member"
  on "public"."rb_audit"
  as permissive
  for select
  to authenticated
using (((shop_id IS NULL) OR public.rb_is_shop_member(shop_id, auth.uid())));



  create policy "ca_delete_admins"
  on "public"."rb_control_admins"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.rb_control_admins a
  WHERE (a.user_id = auth.uid()))));



  create policy "ca_insert_admins"
  on "public"."rb_control_admins"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.rb_control_admins a
  WHERE (a.user_id = auth.uid()))));



  create policy "ca_select_admins"
  on "public"."rb_control_admins"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.rb_control_admins a
  WHERE (a.user_id = auth.uid()))));



  create policy "dat_delete_admin"
  on "public"."rb_device_activation_tokens"
  as permissive
  for delete
  to authenticated
using (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "dat_insert_admin"
  on "public"."rb_device_activation_tokens"
  as permissive
  for insert
  to authenticated
with check (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "dat_select_member"
  on "public"."rb_device_activation_tokens"
  as permissive
  for select
  to authenticated
using (public.rb_is_shop_member(shop_id, auth.uid()));



  create policy "dat_update_admin"
  on "public"."rb_device_activation_tokens"
  as permissive
  for update
  to authenticated
using (public.rb_is_shop_admin(shop_id, auth.uid()))
with check (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "devices_delete_admin"
  on "public"."rb_devices"
  as permissive
  for delete
  to authenticated
using (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "devices_insert_admin"
  on "public"."rb_devices"
  as permissive
  for insert
  to authenticated
with check (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "devices_select_member"
  on "public"."rb_devices"
  as permissive
  for select
  to authenticated
using (public.rb_is_shop_member(shop_id, auth.uid()));



  create policy "devices_update_admin"
  on "public"."rb_devices"
  as permissive
  for update
  to authenticated
using (public.rb_is_shop_admin(shop_id, auth.uid()))
with check (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "members_delete_admin"
  on "public"."rb_shop_members"
  as permissive
  for delete
  to authenticated
using (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "members_insert_admin"
  on "public"."rb_shop_members"
  as permissive
  for insert
  to authenticated
with check (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "members_select_self"
  on "public"."rb_shop_members"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "members_select_shop_admin"
  on "public"."rb_shop_members"
  as permissive
  for select
  to authenticated
using (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "members_update_admin"
  on "public"."rb_shop_members"
  as permissive
  for update
  to authenticated
using (public.rb_is_shop_admin(shop_id, auth.uid()))
with check (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "shops_delete_admin"
  on "public"."rb_shops"
  as permissive
  for delete
  to authenticated
using (public.rb_is_shop_admin(id, auth.uid()));



  create policy "shops_select_member"
  on "public"."rb_shops"
  as permissive
  for select
  to authenticated
using (public.rb_is_shop_member(id, auth.uid()));



  create policy "shops_update_admin"
  on "public"."rb_shops"
  as permissive
  for update
  to authenticated
using (public.rb_is_shop_admin(id, auth.uid()))
with check (public.rb_is_shop_admin(id, auth.uid()));



  create policy "sb_insert_member"
  on "public"."rb_support_bundles"
  as permissive
  for insert
  to authenticated
with check (public.rb_is_shop_member(shop_id, auth.uid()));



  create policy "sb_select_member"
  on "public"."rb_support_bundles"
  as permissive
  for select
  to authenticated
using (public.rb_is_shop_member(shop_id, auth.uid()));



  create policy "up_insert_control_admin"
  on "public"."rb_update_packages"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.rb_control_admins a
  WHERE (a.user_id = auth.uid()))));



  create policy "up_select_authed"
  on "public"."rb_update_packages"
  as permissive
  for select
  to authenticated
using (true);



  create policy "up_update_control_admin"
  on "public"."rb_update_packages"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.rb_control_admins a
  WHERE (a.user_id = auth.uid()))))
with check ((EXISTS ( SELECT 1
   FROM public.rb_control_admins a
  WHERE (a.user_id = auth.uid()))));



  create policy "policy_select_member"
  on "public"."rb_update_policy"
  as permissive
  for select
  to authenticated
using (public.rb_is_shop_member(shop_id, auth.uid()));



  create policy "policy_update_admin"
  on "public"."rb_update_policy"
  as permissive
  for update
  to authenticated
using (public.rb_is_shop_admin(shop_id, auth.uid()))
with check (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "policy_upsert_admin"
  on "public"."rb_update_policy"
  as permissive
  for insert
  to authenticated
with check (public.rb_is_shop_admin(shop_id, auth.uid()));



  create policy "prefs_insert_self"
  on "public"."rb_user_prefs"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "prefs_select_self"
  on "public"."rb_user_prefs"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "prefs_update_self"
  on "public"."rb_user_prefs"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "time_events_delete_none"
  on "public"."time_events"
  as permissive
  for delete
  to authenticated
using (false);



  create policy "time_events_insert_own"
  on "public"."time_events"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.current_employee_clock() ce(employee_id, shop_id)
  WHERE ((ce.employee_id = time_events.employee_id) AND (ce.shop_id = time_events.shop_id)))));



  create policy "time_events_select_own"
  on "public"."time_events"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.current_employee_clock() ce(employee_id, shop_id)
  WHERE ((ce.employee_id = time_events.employee_id) AND (ce.shop_id = time_events.shop_id)))));



  create policy "time_events_update_none"
  on "public"."time_events"
  as permissive
  for update
  to authenticated
using (false);



  create policy "balances_select"
  on "public"."time_off_balances"
  as permissive
  for select
  to authenticated
using (((employee_id = ( SELECT my_employee.id
   FROM public.my_employee() my_employee(id, shop_id))) OR public.is_foreman(shop_id)));



  create policy "balances_update_foreman"
  on "public"."time_off_balances"
  as permissive
  for update
  to authenticated
using (public.is_foreman(shop_id))
with check (public.is_foreman(shop_id));



  create policy "policy_select"
  on "public"."time_off_policy"
  as permissive
  for select
  to authenticated
using ((shop_id = ( SELECT my_employee.shop_id
   FROM public.my_employee() my_employee(id, shop_id))));



  create policy "policy_update"
  on "public"."time_off_policy"
  as permissive
  for update
  to authenticated
using (public.is_foreman(shop_id))
with check (public.is_foreman(shop_id));



  create policy "req_cancel_self"
  on "public"."time_off_requests"
  as permissive
  for update
  to authenticated
using (((employee_id = ( SELECT my_employee.id
   FROM public.my_employee() my_employee(id, shop_id))) AND (status = 'PENDING'::text)))
with check (((employee_id = ( SELECT my_employee.id
   FROM public.my_employee() my_employee(id, shop_id))) AND (status = ANY (ARRAY['PENDING'::text, 'CANCELLED'::text]))));



  create policy "req_decide_foreman"
  on "public"."time_off_requests"
  as permissive
  for update
  to authenticated
using (public.is_foreman(shop_id))
with check (public.is_foreman(shop_id));



  create policy "req_insert_self"
  on "public"."time_off_requests"
  as permissive
  for insert
  to authenticated
with check (((employee_id = ( SELECT my_employee.id
   FROM public.my_employee() my_employee(id, shop_id))) AND (shop_id = ( SELECT my_employee.shop_id
   FROM public.my_employee() my_employee(id, shop_id)))));



  create policy "req_select"
  on "public"."time_off_requests"
  as permissive
  for select
  to authenticated
using (((employee_id = ( SELECT my_employee.id
   FROM public.my_employee() my_employee(id, shop_id))) OR public.is_foreman(shop_id)));


CREATE TRIGGER trg_conversations_title_check BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.conversations_title_check();

CREATE TRIGGER trg_bump_conversation_updated_at AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_updated_at();

CREATE TRIGGER trg_rb_touch_convo_updated_at AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.rb_touch_conversation_updated_at();

CREATE TRIGGER trg_routing_ops_updated_at BEFORE UPDATE ON public.routing_operations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at_routing_ops();

CREATE TRIGGER trg_time_events_block_if_timeoff BEFORE INSERT OR UPDATE ON public.time_events FOR EACH ROW EXECUTE FUNCTION public.time_events_block_if_timeoff();

CREATE TRIGGER trg_time_events_updated_at BEFORE UPDATE ON public.time_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


  create policy "avatars_read 1oj01fe_0"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'avatars'::text));



  create policy "avatars_read 1oj01fe_1"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'avatars'::text));



  create policy "avatars_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "avatars_update_authenticated"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'avatars'::text))
with check ((bucket_id = 'avatars'::text));



  create policy "avatars_upload_authenticated 1oj01fe_0"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'avatars'::text));



  create policy "avatars_upload_authenticated"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'avatars'::text));



  create policy "support_upload_shop_member"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'rb-support-bundles'::text) AND public.rb_is_shop_member((split_part(name, '/'::text, 2))::uuid, auth.uid())));



  create policy "updates_upload_control_admin"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'rb-updates'::text) AND (EXISTS ( SELECT 1
   FROM public.rb_control_admins a
  WHERE (a.user_id = auth.uid())))));


CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


