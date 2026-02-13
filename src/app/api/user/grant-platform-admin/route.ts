import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { writeAudit } from "@/lib/audit/writeAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `user:grant-admin:${ip}`, limit: 60, windowMs: 60_000 });

    const { user } = await requirePlatformAdminAal2();

    const body = await req.json().catch(() => ({}));
    const targetUserId = String((body as any)?.user_id ?? (body as any)?.target_user_id ?? "").trim();
    if (!targetUserId) return NextResponse.json({ ok: false, error: "Missing user_id" }, { status: 400 });
    assertUuid("targetUserId", targetUserId);

    const admin = supabaseAdmin();
    const { error: insErr } = await admin.from("rb_control_admins").insert({ user_id: targetUserId });

    if (insErr) {
      const msg = insErr.message ?? "Insert failed";
      // If already exists, treat as ok (idempotent)
      const lower = msg.toLowerCase();
      if (lower.includes("duplicate") || lower.includes("unique")) {
        return NextResponse.json({ ok: true, already: true });
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    try {
      await writeAudit({
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "platform_admin.grant",
        target_type: "user",
        target_id: targetUserId,
        meta: {},
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
