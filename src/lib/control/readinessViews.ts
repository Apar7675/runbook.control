import { supabaseAdmin } from "@/lib/supabase/admin";
import { countIssueChecks, normalizeReadinessStatus, sanitizeMachineSummary, sanitizeReadinessChecks, type ReadinessReportRow, type ReadinessStatus } from "@/lib/control/readiness";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function isoOrNull(value: unknown) {
  const normalized = text(value);
  return normalized || null;
}

export type ShopReadinessSummary = {
  totalReports: number;
  readyCount: number;
  needsAttentionCount: number;
  notReadyCount: number;
  notCheckedCount: number;
  latestReportedAt: string | null;
  averageScore: number | null;
};

export async function loadShopReadinessReports(shopId: string): Promise<{
  rows: ReadinessReportRow[];
  summary: ShopReadinessSummary;
}> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_device_readiness_reports")
    .select("id,shop_id,device_id,computer_name,reported_by_user_id,overall_status,score,summary,checks,app_version,service_version,os_summary,machine_summary,created_at,updated_at,reported_at")
    .eq("shop_id", shopId)
    .order("reported_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: text(row.id),
    shop_id: text(row.shop_id),
    device_id: text(row.device_id) || null,
    computer_name: text(row.computer_name) || "Unnamed computer",
    reported_by_user_id: text(row.reported_by_user_id) || null,
    overall_status: normalizeReadinessStatus(row.overall_status),
    score: typeof row.score === "number" ? row.score : null,
    summary: text(row.summary) || null,
    checks: sanitizeReadinessChecks(row.checks),
    app_version: text(row.app_version) || null,
    service_version: text(row.service_version) || null,
    os_summary: text(row.os_summary) || null,
    machine_summary: sanitizeMachineSummary(row.machine_summary),
    created_at: isoOrNull(row.created_at),
    updated_at: isoOrNull(row.updated_at),
    reported_at: isoOrNull(row.reported_at),
  }));

  let readyCount = 0;
  let needsAttentionCount = 0;
  let notReadyCount = 0;
  let notCheckedCount = 0;
  let latestReportedAt: string | null = null;
  let totalScore = 0;
  let scoredCount = 0;

  for (const row of rows) {
    if (row.overall_status === "ready") readyCount += 1;
    else if (row.overall_status === "needs_attention") needsAttentionCount += 1;
    else if (row.overall_status === "not_ready") notReadyCount += 1;
    else notCheckedCount += 1;

    if (row.reported_at && (!latestReportedAt || row.reported_at > latestReportedAt)) {
      latestReportedAt = row.reported_at;
    }

    if (typeof row.score === "number") {
      totalScore += row.score;
      scoredCount += 1;
    }
  }

  return {
    rows,
    summary: {
      totalReports: rows.length,
      readyCount,
      needsAttentionCount,
      notReadyCount,
      notCheckedCount,
      latestReportedAt,
      averageScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : null,
    },
  };
}

export function readinessTone(status: ReadinessStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "ready") return "success";
  if (status === "needs_attention") return "warning";
  if (status === "not_ready") return "danger";
  return "neutral";
}

export function readinessIssueCount(row: ReadinessReportRow) {
  return countIssueChecks(row.checks);
}
