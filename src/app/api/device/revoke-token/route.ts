// REPLACE ENTIRE FILE: src/app/api/device/revoke-token/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:revoke:${ip}`, limit: 120, windowMs: 60_000 });

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
    const token_id = String(body?.token_id ?? "").trim();
    if (!token_id) return NextResponse.json({ error: "Missing token_id" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: tok, error: readErr } = await admin
      .from("rb_device_tokens")
      .select("id,device_id,revoked_at")
      .eq("id", token_id)
      .maybeSingle();

    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    if (!tok) return NextResponse.json({ error: "Token not found" }, { status: 404 });

    if (!tok.revoked_at) {
      const { error: upErr } = await admin
        .from("rb_device_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", token_id);

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    await writeAudit({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "device_token.revoke",
      target_type: "token",
      target_id: token_id,
      meta: { device_id: tok.device_id },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
