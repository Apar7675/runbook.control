import { NextResponse } from "next/server";
import { assertUuid } from "@/lib/authz";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportType = "FirstArticle" | "InProcess" | "Final" | "Other";
type ItemStatus = "accepted" | "skipped" | "rejected";

type InspectionReportReferenceInput = {
  shop_id: string;
  work_order_public_id: string;
  operation_public_id: string | null;
  inspection_report_public_id: string;
  report_type: ReportType;
  report_title: string;
  report_status_display: string;
  report_revision: string;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  reviewed_by_display_name: string | null;
  document_display_name: string;
  document_content_type: string;
  page_count: number | null;
  source_updated_at: string;
  source_hash: string;
  source_version: string;
  is_final: boolean;
  is_stale: boolean;
  is_deleted: boolean;
  archived_at: string | null;
};

type ItemResult = {
  index: number;
  status: ItemStatus;
  reason?: string;
};

const REPORT_TYPES = new Set<ReportType>(["FirstArticle", "InProcess", "Final", "Other"]);
const MAX_BATCH_SIZE = 25;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function optionalText(value: unknown): string | null {
  const candidate = text(value);
  return candidate.length > 0 ? candidate : null;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const candidate = text(value).toLowerCase();
  if (!candidate) return fallback;
  return candidate === "1" || candidate === "true" || candidate === "yes" || candidate === "y";
}

function pageCount(value: unknown): number | null {
  if (value === null || value === undefined || text(value) === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("page_count must be a number.");
  const whole = Math.trunc(parsed);
  if (whole < 0) throw new Error("page_count cannot be negative.");
  return whole;
}

function isoTimestamp(value: unknown, label: string, required: boolean): string | null {
  const candidate = text(value);
  if (!candidate) {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }

  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(parsed).toISOString();
}

function requireValue(value: unknown, label: string): string {
  const candidate = text(value);
  if (!candidate) throw new Error(`${label} is required.`);
  return candidate;
}

function rejectForbiddenValue(label: string, value: unknown) {
  const candidate = text(value);
  if (!candidate) return;

  if (/^[A-Za-z]:/.test(candidate)) throw new Error(`${label} contains a local path marker.`);
  if (/[\\]/.test(candidate)) throw new Error(`${label} contains a local path marker.`);
  if (/D:\\/i.test(candidate)) throw new Error(`${label} contains a local path marker.`);
  if (/\/api\/workstation-local/i.test(candidate)) throw new Error(`${label} contains a local API route.`);
  if (/localhost|127\.0\.0\.1/i.test(candidate)) throw new Error(`${label} contains a local host reference.`);
  if (/30111|30112/.test(candidate)) throw new Error(`${label} contains a local runtime/workstation port.`);
  if (/runbook\.service|runbook\.desktop|company-shell|company shell|_DATA\b/i.test(candidate)) {
    throw new Error(`${label} contains a local authority marker.`);
  }
}

function rejectRawLocalId(label: string, value: unknown) {
  const candidate = text(value);
  if (/^\d+$/.test(candidate)) throw new Error(`${label} must be a remote public id, not a raw local id.`);
}

function assertSafeStringFields(input: InspectionReportReferenceInput) {
  const fields: Array<[string, unknown]> = [
    ["shop_id", input.shop_id],
    ["work_order_public_id", input.work_order_public_id],
    ["operation_public_id", input.operation_public_id],
    ["inspection_report_public_id", input.inspection_report_public_id],
    ["report_type", input.report_type],
    ["report_title", input.report_title],
    ["report_status_display", input.report_status_display],
    ["report_revision", input.report_revision],
    ["created_at", input.created_at],
    ["updated_at", input.updated_at],
    ["finalized_at", input.finalized_at],
    ["reviewed_by_display_name", input.reviewed_by_display_name],
    ["document_display_name", input.document_display_name],
    ["document_content_type", input.document_content_type],
    ["source_updated_at", input.source_updated_at],
    ["source_hash", input.source_hash],
    ["source_version", input.source_version],
    ["archived_at", input.archived_at],
  ];

  for (const [label, value] of fields) {
    rejectForbiddenValue(label, value);
  }

  rejectRawLocalId("work_order_public_id", input.work_order_public_id);
  if (input.operation_public_id) rejectRawLocalId("operation_public_id", input.operation_public_id);
  rejectRawLocalId("inspection_report_public_id", input.inspection_report_public_id);
}

function parseReport(value: unknown): InspectionReportReferenceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Inspection report reference must be an object.");
  }

  const raw = value as Record<string, unknown>;
  const reportType = requireValue(raw.report_type, "report_type");
  if (!REPORT_TYPES.has(reportType as ReportType)) {
    throw new Error("report_type is not approved.");
  }

  const input: InspectionReportReferenceInput = {
    shop_id: requireValue(raw.shop_id, "shop_id"),
    work_order_public_id: requireValue(raw.work_order_public_id, "work_order_public_id"),
    operation_public_id: optionalText(raw.operation_public_id),
    inspection_report_public_id: requireValue(raw.inspection_report_public_id, "inspection_report_public_id"),
    report_type: reportType as ReportType,
    report_title: requireValue(raw.report_title, "report_title"),
    report_status_display: requireValue(raw.report_status_display, "report_status_display"),
    report_revision: text(raw.report_revision),
    created_at: isoTimestamp(raw.created_at, "created_at", true)!,
    updated_at: isoTimestamp(raw.updated_at, "updated_at", true)!,
    finalized_at: isoTimestamp(raw.finalized_at, "finalized_at", false),
    reviewed_by_display_name: optionalText(raw.reviewed_by_display_name),
    document_display_name: requireValue(raw.document_display_name, "document_display_name"),
    document_content_type: text(raw.document_content_type) || "application/pdf",
    page_count: pageCount(raw.page_count),
    source_updated_at: isoTimestamp(raw.source_updated_at, "source_updated_at", true)!,
    source_hash: requireValue(raw.source_hash, "source_hash"),
    source_version: text(raw.source_version) || "1",
    is_final: bool(raw.is_final, false),
    is_stale: bool(raw.is_stale, false),
    is_deleted: bool(raw.is_deleted, false),
    archived_at: isoTimestamp(raw.archived_at, "archived_at", false),
  };

  assertUuid("shop_id", input.shop_id);
  assertSafeStringFields(input);
  return input;
}

function readItems(body: unknown): unknown[] {
  if (!body || typeof body !== "object") return [];
  const raw = body as Record<string, unknown>;
  if (Array.isArray(raw.reports)) return raw.reports.slice(0, MAX_BATCH_SIZE);
  if (raw.report) return [raw.report];
  return [raw];
}

async function requireShopMembership(admin: ReturnType<typeof supabaseAdmin>, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id,role")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error("Shop authorization could not be verified.");
  if (!data?.id) throw new Error("Access denied.");
}

function isIncomingOlder(incoming: string, existing: string | null | undefined): boolean {
  if (!existing) return false;
  return Date.parse(incoming) < Date.parse(existing);
}

async function applyReport(admin: ReturnType<typeof supabaseAdmin>, report: InspectionReportReferenceInput): Promise<ItemStatus> {
  const { data: existing, error: existingError } = await admin
    .from("rb_mobile_inspection_report_references")
    .select("source_hash,source_updated_at")
    .eq("shop_id", report.shop_id)
    .eq("inspection_report_public_id", report.inspection_report_public_id)
    .maybeSingle();

  if (existingError) throw new Error("Inspection report read model lookup failed.");

  if (existing?.source_hash === report.source_hash) {
    return "skipped";
  }

  if (isIncomingOlder(report.source_updated_at, existing?.source_updated_at)) {
    return "skipped";
  }

  const { error: upsertError } = await admin
    .from("rb_mobile_inspection_report_references")
    .upsert(report, { onConflict: "shop_id,inspection_report_public_id" });

  if (upsertError) throw new Error("Inspection report read model update failed.");
  return "accepted";
}

function responseStatus(message: string): number {
  if (/not authenticated/i.test(message)) return 401;
  if (/access denied|authorization/i.test(message)) return 403;
  if (/uuid|required|approved|valid|number|negative|path|local|forbidden|public id/i.test(message)) return 400;
  return 500;
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const rawItems = readItems(body);

    if (rawItems.length === 0) {
      return NextResponse.json({ ok: false, success: false, error: "No inspection report references were provided." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const membershipCache = new Set<string>();
    const results: ItemResult[] = [];

    let accepted = 0;
    let skipped = 0;
    let rejected = 0;

    for (let index = 0; index < rawItems.length; index++) {
      try {
        const report = parseReport(rawItems[index]);

        if (!membershipCache.has(report.shop_id)) {
          await requireShopMembership(admin, report.shop_id, user.id);
          const entitlement = await getShopEntitlement(report.shop_id);
          if (!entitlement.allowed || entitlement.restricted) {
            throw new Error("Shop entitlement does not allow desktop publishing.");
          }
          membershipCache.add(report.shop_id);
        }

        const status = await applyReport(admin, report);
        if (status === "accepted") accepted++;
        else skipped++;
        results.push({ index, status });
      } catch (error: unknown) {
        rejected++;
        const reason = error instanceof Error ? error.message : "Inspection report reference was rejected.";
        results.push({ index, status: "rejected", reason });
      }
    }

    return NextResponse.json({
      ok: rejected === 0,
      success: rejected === 0,
      accepted,
      skipped,
      rejected,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Inspection report reference ingestion failed.";
    return NextResponse.json(
      {
        ok: false,
        success: false,
        accepted: 0,
        skipped: 0,
        rejected: 0,
        error: responseStatus(message) >= 500 ? "Inspection report reference ingestion failed." : message,
      },
      { status: responseStatus(message) }
    );
  }
}
