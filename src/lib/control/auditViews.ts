import { getViewerContext, type ViewerContext } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AuditFilterValues = {
  action: string;
  actor_email: string;
  shop_id: string;
  target_id: string;
  before: string;
  limit: string;
};

export type AuditViewRow = {
  id: string;
  created_at: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  shop_id: string | null;
  shop_name: string | null;
  meta: Record<string, unknown> | null;
  details_label: string;
  target_label: string;
  severity_label: string;
};

export type AuditViewsData = {
  context: ViewerContext;
  rows: AuditViewRow[];
  filters: AuditFilterValues;
  counts: {
    totalVisible: number;
    eventsToday: number;
    categoryEvents: number;
    highRiskEvents: number;
  };
};

type AuditDbRow = {
  id: string | null;
  created_at: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string | null;
  target_type: string | null;
  target_id: string | null;
  shop_id: string | null;
  meta: unknown;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function isoOrNull(value: unknown) {
  const text = asText(value);
  return text || null;
}

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function startOfTodayIso() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  return start.toISOString();
}

function buildDetailsLabel(meta: Record<string, unknown> | null, targetType: string | null, targetId: string | null) {
  if (targetType || targetId) {
    return `${targetType ?? "event"} ${targetId ?? ""}`.trim();
  }
  if (!meta || Object.keys(meta).length === 0) return "No additional detail";
  const compact = JSON.stringify(meta);
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function severityFromAction(action: string, meta: Record<string, unknown> | null) {
  const normalized = action.toLowerCase();
  if (normalized.includes("delete") || normalized.includes("revoke") || normalized.includes("failed") || normalized.includes("error")) return "High risk";
  if (normalized.includes("billing") || normalized.includes("support") || normalized.includes("security") || normalized.includes("mfa")) return "Watch";
  if (typeof meta?.success === "boolean") return meta.success ? "Success" : "Failed";
  return "Standard";
}

function matchesCategory(action: string) {
  const normalized = action.toLowerCase();
  return normalized.includes("billing") || normalized.includes("device") || normalized.includes("security") || normalized.includes("support");
}

function isHighRisk(action: string) {
  const normalized = action.toLowerCase();
  return normalized.includes("delete") || normalized.includes("revoke") || normalized.includes("grant") || normalized.includes("billing_access") || normalized.includes("failed") || normalized.includes("error");
}

async function fetchAuditRows(filters: AuditFilterValues) {
  const admin = supabaseAdmin();
  const limitRaw = Number(filters.limit || "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

  let query = admin
    .from("rb_audit_log")
    .select("id,created_at,actor_user_id,actor_email,action,target_type,target_id,shop_id,meta")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.before.trim()) query = query.lt("created_at", filters.before.trim());
  if (filters.shop_id.trim()) query = query.eq("shop_id", filters.shop_id.trim());
  if (filters.action.trim()) query = query.ilike("action", `%${filters.action.trim()}%`);
  if (filters.actor_email.trim()) query = query.ilike("actor_email", `%${filters.actor_email.trim()}%`);
  if (filters.target_id.trim()) query = query.ilike("target_id", `%${filters.target_id.trim()}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return asArray<AuditDbRow>(data);
}

async function countAuditRows(filters: AuditFilterValues, sinceIso?: string) {
  const admin = supabaseAdmin();
  let query = admin.from("rb_audit_log").select("id", { count: "exact", head: true });

  if (filters.before.trim()) query = query.lt("created_at", filters.before.trim());
  if (filters.shop_id.trim()) query = query.eq("shop_id", filters.shop_id.trim());
  if (filters.action.trim()) query = query.ilike("action", `%${filters.action.trim()}%`);
  if (filters.actor_email.trim()) query = query.ilike("actor_email", `%${filters.actor_email.trim()}%`);
  if (filters.target_id.trim()) query = query.ilike("target_id", `%${filters.target_id.trim()}%`);
  if (sinceIso) query = query.gte("created_at", sinceIso);

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function loadAuditViews(filters: AuditFilterValues): Promise<AuditViewsData> {
  const context = await getViewerContext();
  const rowsRaw = await fetchAuditRows(filters);
  const shopNameById = new Map(context.shops.map((shop) => [shop.id, shop.name]));

  const rows = rowsRaw.map((row) => {
    const meta = asRecord(row.meta);
    const action = asText(row.action) || "event";
    const targetType = isoOrNull(row.target_type);
    const targetId = isoOrNull(row.target_id);
    return {
      id: asText(row.id),
      created_at: isoOrNull(row.created_at),
      actor_user_id: isoOrNull(row.actor_user_id),
      actor_email: isoOrNull(row.actor_email),
      action,
      target_type: targetType,
      target_id: targetId,
      shop_id: isoOrNull(row.shop_id),
      shop_name: row.shop_id ? shopNameById.get(asText(row.shop_id)) ?? null : null,
      meta,
      details_label: buildDetailsLabel(meta, targetType, targetId),
      target_label: `${targetType ?? "event"} ${targetId ?? ""}`.trim(),
      severity_label: severityFromAction(action, meta),
    } satisfies AuditViewRow;
  });

  const [totalVisible, eventsToday] = await Promise.all([
    countAuditRows(filters),
    countAuditRows(filters, startOfTodayIso()),
  ]);

  return {
    context,
    rows,
    filters,
    counts: {
      totalVisible,
      eventsToday,
      categoryEvents: rows.filter((row) => matchesCategory(row.action)).length,
      highRiskEvents: rows.filter((row) => isHighRisk(row.action)).length,
    },
  };
}

export function auditSeverityTone(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("high")) return "danger" as const;
  if (normalized.includes("watch") || normalized.includes("failed")) return "warning" as const;
  if (normalized.includes("success")) return "success" as const;
  return "neutral" as const;
}
