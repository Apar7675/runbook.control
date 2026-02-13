// REPLACE ENTIRE FILE: src/app/api/device/issue-token/route.ts
//
// REFACTOR (this pass):
// - Uses centralized authz.ts: requirePlatformAdminAal2() + assertUuid().
// - Keeps rate limit.
// - Keeps best-effort idempotency via rb_idempotency_keys if table exists.
// - Keeps audit write.
// - No billing gate (admin endpoint).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";
import { generateRawToken, hashToken } from "@/lib/device/tokens";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Best-effort idempotency using a lightweight table if it exists.
// Table suggestion: public.rb_idempotency_keys (key text primary key, created_at timestamptz default now())
async function rbTryConsumeIdempotencyKey(key: string): Promise<boolean> {
  if (!key) return true;
  const admin = supabaseAdmin();
  try {
    const { error } = await admin.from("rb_idempotency_keys").insert({ key });
    if (!error) return true;

    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) return false;

    console.warn("rb_idempotency_keys insert error (non-fatal):", error.message);
    return true;
  } catch (e: any) {
    console.warn("rb_idempotency_keys not available (non-fatal):", e?.message ?? e);
    return true;
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:issue:${ip}`, limit: 60, windowMs: 60_000 });

    // AAL2 + platform admin enforced here
    const { user } = await requirePlatformAdminAal2();

    const body = await req.json().catch(() => ({}));
    const device_id = String((body as any)?.device_id ?? "").trim();
    const label = String((body as any)?.label ?? "").trim() || null;

    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    assertUuid("device_id", device_id);

    const idem = String(req.headers.get("idempotency-key") ?? "").trim();
    const canProceed = await rbTryConsumeIdempotencyKey(idem);
    if (!canProceed) {
      // If you want to return the prior token, we need durable storage of the issued token_id by idem key.
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
    }

    const raw = generateRawToken();
    const token_hash = hashToken(raw);

    const admin = supabaseAdmin();

    // Rotate: revoke any active tokens for this device
    const { error: revokeErr } = await admin
      .from("rb_device_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("device_id", device_id)
      .is("revoked_at", null);

    if (revokeErr) return NextResponse.json({ ok: false, error: revokeErr.message }, { status: 500 });

    const { data: inserted, error } = await admin
      .from("rb_device_tokens")
      .insert({ device_id, token_hash, label })
      .select("id,device_id,created_at,issued_at,revoked_at,label")
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Audit (best-effort)
    try {
      await writeAudit({
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "device_token.issue",
        target_type: "device",
        target_id: device_id,
        meta: { token_id: inserted?.id ?? null, label, idempotency_key: idem || null },
      });
    } catch {
      // ignore
    }

    // Return raw token ONCE
    return NextResponse.json({ ok: true, token: raw, token_id: inserted?.id ?? null });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
