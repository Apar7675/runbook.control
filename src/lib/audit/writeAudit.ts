// REPLACE ENTIRE FILE: src/lib/audit/writeAudit.ts

import { supabaseAdmin } from "@/lib/supabase/admin";

export type AuditEvent = {
  actor_user_id?: string | null;
  actor_email?: string | null;

  action: string;
  target_type?: string | null;
  target_id?: string | null;

  shop_id?: string | null;
  meta?: Record<string, any>;
};

export async function writeAudit(event: AuditEvent) {
  const admin = supabaseAdmin();

  const payload = {
    actor_user_id: event.actor_user_id ?? null,
    actor_email: event.actor_email ?? null,
    action: event.action,
    target_type: event.target_type ?? null,
    target_id: event.target_id ?? null,
    shop_id: event.shop_id ?? null,
    meta: event.meta ?? {},
  };

  const { error } = await admin.from("rb_audit_log").insert(payload);
  if (error) throw new Error(error.message);
}
