// REPLACE ENTIRE FILE: src/app/api/user/revoke-platform-admin/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `admin:revoke:${ip}`, limit: 30, windowMs: 60_000 });

    const supabase = await supabaseServer();

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user ?? null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";
    if (aal !== "aal2") return NextResponse.json({ error: "MFA required (AAL2)" }, { status: 403 });

    const { data: row } = await supabase
      .from("rb_control_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) return NextResponse.json({ error: "Not a platform admin" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body?.user_id ?? "").trim();
    if (!targetUserId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Refusing to revoke your own admin" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { error: delErr } = await admin.from("rb_control_admins").delete().eq("user_id", targetUserId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    await writeAudit({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "platform_admin.revoke",
      target_type: "user",
      target_id: targetUserId,
      meta: {},
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
