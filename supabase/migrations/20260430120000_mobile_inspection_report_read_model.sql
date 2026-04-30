-- Mobile inspection report references are a remote read model only.
-- Desktop/local company shell remains the source of official inspection report truth.
-- Desktop publishes sanitized references through a future Control ingestion API.
-- Control owns remote access policy and serves Mobile through /api/mobile/inspection-reports.
-- Mobile consumes these references read-only and must not write official inspection truth.

create table if not exists public.rb_mobile_inspection_report_references (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.rb_shops(id) on delete cascade,
  work_order_public_id text not null,
  operation_public_id text null,
  inspection_report_public_id text not null,
  report_type text not null,
  report_title text not null,
  report_status_display text not null,
  report_revision text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  finalized_at timestamptz null,
  reviewed_by_display_name text null,
  document_display_name text not null,
  document_content_type text not null default 'application/pdf',
  page_count integer null,
  remote_document_key text null,
  source_updated_at timestamptz not null,
  published_at timestamptz not null default now(),
  source_hash text not null,
  source_version text not null default '1',
  is_final boolean not null default false,
  is_stale boolean not null default false,
  is_deleted boolean not null default false,
  archived_at timestamptz null,
  publisher_device_id uuid null,
  source_system text not null default 'Desktop',

  constraint rb_mobile_inspection_report_refs_unique_report
    unique (shop_id, inspection_report_public_id),

  constraint rb_mobile_inspection_report_refs_report_type_check
    check (report_type in ('FirstArticle', 'InProcess', 'Final', 'Other')),

  constraint rb_mobile_inspection_report_refs_page_count_check
    check (page_count is null or page_count >= 0),

  constraint rb_mobile_inspection_report_refs_public_ids_no_local_paths_check
    check (
      work_order_public_id !~ '[\\/]'
      and inspection_report_public_id !~ '[\\/]'
      and coalesce(operation_public_id, '') !~ '[\\/]'
      and work_order_public_id !~* '^[a-z]:'
      and inspection_report_public_id !~* '^[a-z]:'
      and coalesce(operation_public_id, '') !~* '^[a-z]:'
      and work_order_public_id !~* 'api/workstation-local|30111|30112'
      and inspection_report_public_id !~* 'api/workstation-local|30111|30112'
      and coalesce(operation_public_id, '') !~* 'api/workstation-local|30111|30112'
    ),

  constraint rb_mobile_inspection_report_refs_remote_doc_no_local_paths_check
    check (
      remote_document_key is null
      or (
        remote_document_key !~ '\\'
        and remote_document_key !~* '^[a-z]:'
        and remote_document_key !~* 'api/workstation-local|30111|30112|runbook\.service|runbook\.desktop'
      )
    )
);

comment on table public.rb_mobile_inspection_report_references is
  'Remote read model of sanitized Mobile inspection report references. Not official inspection truth.';

comment on column public.rb_mobile_inspection_report_references.shop_id is
  'Control shop scope. Control API/RLS must enforce membership, entitlement, employee status, and Mobile access.';

comment on column public.rb_mobile_inspection_report_references.work_order_public_id is
  'Remote-safe public work order identifier. Must not be a Desktop SQLite id or local path.';

comment on column public.rb_mobile_inspection_report_references.operation_public_id is
  'Remote-safe public operation identifier. Null when the report is not operation-scoped.';

comment on column public.rb_mobile_inspection_report_references.inspection_report_public_id is
  'Remote-safe public inspection report identifier. Must not be a Desktop SQLite id or local path.';

comment on column public.rb_mobile_inspection_report_references.remote_document_key is
  'Private remote document/storage key only. Control must convert this to signed URLs or authorized document tokens.';

comment on column public.rb_mobile_inspection_report_references.source_hash is
  'Hash/version marker from the Desktop-published source artifact, used for idempotency and stale detection.';

comment on column public.rb_mobile_inspection_report_references.source_system is
  'Publisher label such as Desktop. This does not transfer inspection authority to Control.';

create index if not exists rb_mobile_inspection_report_refs_shop_idx
  on public.rb_mobile_inspection_report_references (shop_id);

create index if not exists rb_mobile_inspection_report_refs_work_order_idx
  on public.rb_mobile_inspection_report_references (shop_id, work_order_public_id);

create index if not exists rb_mobile_inspection_report_refs_operation_idx
  on public.rb_mobile_inspection_report_references (shop_id, operation_public_id)
  where operation_public_id is not null;

create index if not exists rb_mobile_inspection_report_refs_report_idx
  on public.rb_mobile_inspection_report_references (shop_id, inspection_report_public_id);

create index if not exists rb_mobile_inspection_report_refs_deleted_idx
  on public.rb_mobile_inspection_report_references (shop_id, is_deleted);

create index if not exists rb_mobile_inspection_report_refs_stale_idx
  on public.rb_mobile_inspection_report_references (shop_id, is_stale);

create index if not exists rb_mobile_inspection_report_refs_source_updated_idx
  on public.rb_mobile_inspection_report_references (shop_id, source_updated_at desc);

alter table public.rb_mobile_inspection_report_references enable row level security;

-- Direct Mobile table access is intentionally not granted.
-- Mobile reads must go through the Control API so policy, entitlement, and visibility checks stay server-side.
revoke all on table public.rb_mobile_inspection_report_references from anon;
revoke all on table public.rb_mobile_inspection_report_references from authenticated;
grant all on table public.rb_mobile_inspection_report_references to service_role;
