import { supabaseAdmin } from "@/lib/supabase/admin";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export type DeleteOperationStatus = "pending" | "running" | "failed" | "partial_failed" | "completed";

export async function createDeleteOperation(args: {
  shopId: string | null;
  shopName: string | null;
  actorUserId: string;
  resultJson?: Record<string, unknown>;
}) {
  const admin = supabaseAdmin();
  const payload = {
    shop_id: args.shopId,
    shop_name: args.shopName,
    actor_user_id: args.actorUserId,
    status: "running" as DeleteOperationStatus,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    result_json: args.resultJson ?? {},
  };

  const { data, error } = await admin
    .from("rb_delete_operations")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function completeDeleteOperation(operationId: string, resultJson: Record<string, unknown>) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_delete_operations")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      result_json: resultJson,
      error_json: null,
    })
    .eq("id", operationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function failDeleteOperation(operationId: string, errorJson: Record<string, unknown>, resultJson?: Record<string, unknown>) {
  return setDeleteOperationStatus(operationId, "failed", {
    error_json: errorJson,
    ...(resultJson ? { result_json: resultJson } : {}),
  });
}

export async function partialFailDeleteOperation(operationId: string, errorJson: Record<string, unknown>, resultJson?: Record<string, unknown>) {
  return setDeleteOperationStatus(operationId, "partial_failed", {
    error_json: errorJson,
    ...(resultJson ? { result_json: resultJson } : {}),
  });
}

export async function updateDeleteOperation(operationId: string, patch: {
  status?: DeleteOperationStatus;
  result_json?: Record<string, unknown>;
  error_json?: Record<string, unknown> | null;
  completed_at?: string | null;
}) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_delete_operations")
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.result_json ? { result_json: patch.result_json } : {}),
      ...(patch.error_json !== undefined ? { error_json: patch.error_json } : {}),
      ...(patch.completed_at !== undefined ? { completed_at: patch.completed_at } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", operationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function setDeleteOperationStatus(
  operationId: string,
  status: DeleteOperationStatus,
  patch: {
    result_json?: Record<string, unknown>;
    error_json?: Record<string, unknown> | null;
  }
) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_delete_operations")
    .update({
      status,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(patch.error_json !== undefined ? { error_json: patch.error_json } : {}),
      ...(patch.result_json ? { result_json: patch.result_json } : {}),
    })
    .eq("id", operationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function findLatestDeleteOperation(shopId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_delete_operations")
    .select("*")
    .eq("shop_id", shopId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export function normalizeDeleteResult(raw: any) {
  return {
    id: text(raw?.id),
    status: text(raw?.status),
    shop_id: text(raw?.shop_id) || null,
    shop_name: text(raw?.shop_name) || null,
    started_at: text(raw?.started_at) || null,
    completed_at: text(raw?.completed_at) || null,
    result_json: raw?.result_json ?? {},
    error_json: raw?.error_json ?? null,
  };
}
