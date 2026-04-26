import { supabaseServer } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit/writeAudit";

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

  await writeAudit({
    actor_user_id: args.actor_user_id ?? me.user?.id ?? null,
    actor_email: me.user?.email ?? null,
    actor_kind: args.actor_kind ?? "user",
    action: args.action,
    target_type: args.entity_type ?? null,
    target_id: args.entity_id ?? null,
    shop_id: args.shop_id ?? null,
    meta: args.details ?? {},
  });
}
