import { supabaseServer } from "@/lib/supabase/server";

export type AuditAction =
  | "shop.created"
  | "shop.deleted"
  | "member.added"
  | "member.removed"
  | "device.created"
  | "device.activated"
  | "device.disabled"
  | "device.deleted"
  | "device.token_deactivated"
  | "device.reactivation_forced"
  | "update.package_uploaded"
  | "policy.changed"
  | "support_bundle.uploaded";

export async function auditLog(args: {
  shop_id?: string | null;
  action: AuditAction;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, any>;
  actor_kind?: "user" | "device" | "system";
  actor_user_id?: string | null;
}) {
  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();

  const actor_user_id = args.actor_user_id ?? me.user?.id ?? null;

  const { error } = await supabase.from("rb_audit").insert({
    shop_id: args.shop_id ?? null,
    actor_user_id,
    actor_kind: args.actor_kind ?? "user",
    action: args.action,
    entity_type: args.entity_type ?? null,
    entity_id: args.entity_id ?? null,
    details: args.details ?? {},
  });

  if (error) console.error("[audit] insert failed:", error.message);
}
