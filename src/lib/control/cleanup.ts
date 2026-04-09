import { supabaseAdmin } from "@/lib/supabase/admin";

export type CleanupApp = "desktop" | "workstation" | "mobile";

export type PendingCleanup = {
  id: string;
  target_app: CleanupApp;
  action: "purge_shop_data" | "revoke_shop_access" | "clear_local_trust" | "reset_pairing";
  reason: string;
  shop_id: string | null;
  shop_name: string | null;
  auth_user_id: string | null;
  employee_id: string | null;
  device_id: string | null;
  payload: Record<string, unknown>;
  issued_at: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function isMissingCleanupTable(message: string) {
  const lower = text(message).toLowerCase();
  return lower.includes("rb_remote_cleanup_commands") && (lower.includes("does not exist") || lower.includes("schema cache"));
}

function pickPreferred(cleanups: PendingCleanup[]) {
  const weight = (cleanup: PendingCleanup) =>
    cleanup.action === "reset_pairing"
      ? 4
      : cleanup.action === "purge_shop_data"
      ? 3
      : cleanup.action === "clear_local_trust"
      ? 2
      : 1;

  return [...cleanups].sort((left, right) => {
    const byWeight = weight(right) - weight(left);
    if (byWeight !== 0) return byWeight;
    return text(right.issued_at).localeCompare(text(left.issued_at));
  })[0] ?? null;
}

export async function loadPendingCleanup(args: {
  shopId?: string | null;
  authUserId?: string | null;
  employeeId?: string | null;
  deviceId?: string | null;
  targetApps: CleanupApp[];
}) {
  const admin = supabaseAdmin();
  let query = admin
    .from("rb_remote_cleanup_commands")
    .select("id,target_app,action,reason,shop_id,shop_name,auth_user_id,employee_id,device_id,payload,issued_at")
    .eq("state", "pending");

  if (args.shopId) query = query.eq("shop_id", args.shopId);
  if (args.authUserId) query = query.eq("auth_user_id", args.authUserId);
  if (args.employeeId) query = query.eq("employee_id", args.employeeId);
  if (args.deviceId) query = query.eq("device_id", args.deviceId);
  if (args.targetApps.length > 0) query = query.in("target_app", args.targetApps);

  const { data, error } = await query.order("issued_at", { ascending: false }).limit(10);
  if (error) {
    if (isMissingCleanupTable(error.message ?? "")) {
      return { items: [] as PendingCleanup[], preferred: null as PendingCleanup | null };
    }
    throw new Error(error.message);
  }

  const cleanups = ((data ?? []) as any[]).map((row) => ({
    id: text(row.id),
    target_app: row.target_app as CleanupApp,
    action: row.action as PendingCleanup["action"],
    reason: text(row.reason),
    shop_id: text(row.shop_id) || null,
    shop_name: text(row.shop_name) || null,
    auth_user_id: text(row.auth_user_id) || null,
    employee_id: text(row.employee_id) || null,
    device_id: text(row.device_id) || null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    issued_at: text(row.issued_at),
  }));

  return {
    items: cleanups,
    preferred: pickPreferred(cleanups),
  };
}

export function formatCleanupResponse(cleanup: PendingCleanup) {
  return {
    required: true,
    target_app: cleanup.target_app,
    action: cleanup.action,
    reason: cleanup.reason,
    shop_id: cleanup.shop_id,
    shop_name: cleanup.shop_name,
    issued_at: cleanup.issued_at,
    payload: cleanup.payload ?? {},
  };
}
