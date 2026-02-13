import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:revoke:${ip}`, limit: 120, windowMs: 60_000 });

    const { user } = await requirePlatformAdminAal2();

    const body = await req.json().catch(() => ({}));
    const token_id = String((body as any)?.token_id ?? "").trim();
    if (!token_id) return NextResponse.json({ ok: false, error: "Missing token_id" }, { status: 400 });
    assertUuid("token_id", token_id);

    const admin = supabaseAdmin();
    const { data: tok, error: readErr } = await admin
      .from("rb_device_tokens")
      .select("id,device_id,revoked_at")
      .eq("id", token_id)
      .maybeSingle();

    if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    if (!tok) return NextResponse.json({ ok: false, error: "Token not found" }, { status: 404 });

    const now = new Date().toISOString();
    if (!tok.revoked_at) {
      const { error: upErr } = await admin.from("rb_device_tokens").update({ revoked_at: now }).eq("id", token_id);
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    try {
      await writeAudit({
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "device_token.revoke",
        target_type: "token",
        target_id: token_id,
        meta: { device_id: tok.device_id, at: now },
      });
    } catch {}

    return NextResponse.json({ ok: true });
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
