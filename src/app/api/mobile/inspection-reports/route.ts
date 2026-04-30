import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { assertUuid } from "@/lib/authz";
import { describeShopAccess } from "@/lib/billing/access";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MobileInspectionReportReference = {
  shopId: string;
  workOrderPublicId: string;
  operationPublicId: string | null;
  inspectionReportPublicId: string;
  reportType: "FirstArticle" | "InProcess" | "Final" | "Other";
  reportTitle: string;
  reportStatusDisplay: string;
  reportRevision: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  reviewedByDisplayName: string | null;
  documentDisplayName: string;
  documentContentType: string;
  pageCount: number | null;
  remoteViewUrl?: string;
  authorizedDocumentToken?: string;
  sourceUpdatedAt: string;
  publishedAt: string;
  isFinal: boolean;
  isStale: boolean;
};

type InspectionReportReferenceRow = {
  shop_id: string;
  work_order_public_id: string;
  operation_public_id: string | null;
  inspection_report_public_id: string;
  report_type: "FirstArticle" | "InProcess" | "Final" | "Other";
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
  published_at: string;
  is_final: boolean;
  is_stale: boolean;
};

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isInspectionViewer(employee: any) {
  const role = text(employee?.role);
  return Boolean(
    employee?.can_inspection ||
      employee?.can_inspection_entry ||
      /admin|foreman|manager|supervisor|quality|qc|inspection/i.test(role)
  );
}

function assertSafePublicId(label: string, value: string) {
  if (!value) return;
  if (/[\\/]|\bapi\/workstation-local\b|30111|30112/i.test(value)) {
    throw new Error(`${label} is not a valid remote public id.`);
  }
  if (/^[A-Za-z]:/.test(value)) {
    throw new Error(`${label} must not contain a local path.`);
  }
  if (value.length > 160) {
    throw new Error(`${label} is too long.`);
  }
}

function containsForbiddenLocalReference(value: unknown): boolean {
  const candidate = text(value);
  if (!candidate) return false;
  return /[\\]|\bapi\/workstation-local\b|30111|30112|runbook\.service|runbook\.desktop/i.test(candidate) ||
    /^[A-Za-z]:/.test(candidate);
}

function toInspectionReportReference(row: InspectionReportReferenceRow): MobileInspectionReportReference {
  return {
    shopId: text(row.shop_id),
    workOrderPublicId: text(row.work_order_public_id),
    operationPublicId: row.operation_public_id ? text(row.operation_public_id) : null,
    inspectionReportPublicId: text(row.inspection_report_public_id),
    reportType: row.report_type,
    reportTitle: text(row.report_title),
    reportStatusDisplay: text(row.report_status_display),
    reportRevision: text(row.report_revision),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    finalizedAt: row.finalized_at ? text(row.finalized_at) : null,
    reviewedByDisplayName: row.reviewed_by_display_name ? text(row.reviewed_by_display_name) : null,
    documentDisplayName: text(row.document_display_name),
    documentContentType: text(row.document_content_type) || "application/pdf",
    pageCount: typeof row.page_count === "number" ? row.page_count : null,
    sourceUpdatedAt: text(row.source_updated_at),
    publishedAt: text(row.published_at),
    isFinal: row.is_final === true,
    isStale: row.is_stale === true,
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const url = new URL(req.url);
    const shopId = text(url.searchParams.get("shop_id"));
    const workOrderPublicId = text(url.searchParams.get("work_order_public_id"));
    const operationPublicId = text(url.searchParams.get("operation_public_id"));

    if (!shopId) {
      return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400, headers: corsHeaders(req) });
    }

    assertUuid("shop_id", shopId);
    assertSafePublicId("work_order_public_id", workOrderPublicId);
    assertSafePublicId("operation_public_id", operationPublicId);

    const admin = supabaseAdmin();

    const { data: member, error: memberError } = await admin
      .from("rb_shop_members")
      .select("id,role")
      .eq("shop_id", shopId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (memberError) {
      return NextResponse.json({ ok: false, error: memberError.message }, { status: 500, headers: corsHeaders(req) });
    }
    if (!member?.id) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403, headers: corsHeaders(req) });
    }

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id,shop_id,auth_user_id,display_name,role,is_active,runbook_access_enabled,mobile_access_enabled,can_inspection,can_inspection_entry,can_work_orders")
      .eq("shop_id", shopId)
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (employeeError) {
      return NextResponse.json({ ok: false, error: employeeError.message }, { status: 500, headers: corsHeaders(req) });
    }
    if (!employee?.id) {
      return NextResponse.json({ ok: false, error: "No active employee record for this shop" }, { status: 403, headers: corsHeaders(req) });
    }
    if (employee.runbook_access_enabled === false || employee.mobile_access_enabled === false) {
      return NextResponse.json({ ok: false, error: "Mobile access is disabled for this shop" }, { status: 403, headers: corsHeaders(req) });
    }
    if (!isInspectionViewer(employee)) {
      return NextResponse.json({ ok: false, error: "Inspection report access is not enabled for this employee" }, { status: 403, headers: corsHeaders(req) });
    }

    const entitlement = await getShopEntitlement(shopId);
    const access = describeShopAccess(entitlement);
    if (!access.allowed || access.restricted || access.mobile_mode === "blocked") {
      return NextResponse.json({ ok: false, error: access.summary || "Mobile access is blocked for this shop" }, { status: 403, headers: corsHeaders(req) });
    }

    let query = admin
      .from("rb_mobile_inspection_report_references")
      .select(
        "shop_id,work_order_public_id,operation_public_id,inspection_report_public_id,report_type,report_title,report_status_display,report_revision,created_at,updated_at,finalized_at,reviewed_by_display_name,document_display_name,document_content_type,page_count,source_updated_at,published_at,is_final,is_stale"
      )
      .eq("shop_id", shopId)
      .eq("is_deleted", false);

    if (workOrderPublicId) {
      query = query.eq("work_order_public_id", workOrderPublicId);
    }

    if (operationPublicId) {
      query = query.eq("operation_public_id", operationPublicId);
    }

    const { data: rows, error: reportsError } = await query
      .order("is_stale", { ascending: true })
      .order("finalized_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(100);

    if (reportsError) {
      console.error("mobile inspection report read model unavailable", {
        code: reportsError.code,
        message: reportsError.message,
      });

      return NextResponse.json(
        {
          ok: true,
          reports: [],
          read_model: {
            available: false,
            reason: "inspection_report_read_model_unavailable",
          },
        },
        { headers: corsHeaders(req) }
      );
    }

    const reports = ((rows ?? []) as InspectionReportReferenceRow[])
      .filter((row) =>
        !containsForbiddenLocalReference(row.work_order_public_id) &&
        !containsForbiddenLocalReference(row.operation_public_id) &&
        !containsForbiddenLocalReference(row.inspection_report_public_id) &&
        !containsForbiddenLocalReference(row.document_display_name)
      )
      .map(toInspectionReportReference);

    return NextResponse.json(
      {
        ok: true,
        reports,
        read_model: {
          available: true,
        },
      },
      { headers: corsHeaders(req) }
    );
  } catch (error: any) {
    const message = error?.message ?? "Server error";
    const status =
      /not authenticated/i.test(message) ? 401
      : /access denied|disabled|not enabled|blocked/i.test(message) ? 403
      : /uuid|public id|local path|too long|missing/i.test(message) ? 400
      : 500;

    return NextResponse.json({ ok: false, error: message }, { status, headers: corsHeaders(req) });
  }
}
