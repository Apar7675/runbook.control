// REPLACE ENTIRE FILE: src/app/api/device/issue-token/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";
import { generateRawToken, hashToken } from "@/lib/device/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:issue:${ip}`, limit: 60, windowMs: 60_000 });

    const supabase = await supabaseServer();

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user ?? null;
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    // Must be AAL2
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";
    if (aal !== "aal2") return NextResponse.json({ ok: false, error: "MFA required (AAL2)" }, { status: 403 });

    // Must be platform admin
    const { data: row } = await supabase
      .from("rb_control_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ ok: false, error: "Not a platform admin" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const device_id = String(body?.device_id ?? "").trim();
    const label = String(body?.label ?? "").trim() || null;
    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });

    const raw = generateRawToken();
    const token_hash = hashToken(raw);

    const admin = supabaseAdmin();

    // Rotate: revoke any active tokens for this device
    await admin
      .from("rb_device_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("device_id", device_id)
      .is("revoked_at", null);

    const { data: inserted, error } = await admin
      .from("rb_device_tokens")
      .insert({ device_id, token_hash, label })
      .select("id,device_id,created_at,issued_at,revoked_at,label")
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await writeAudit({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "device_token.issue",
      target_type: "device",
      target_id: device_id,
      meta: { token_id: inserted?.id ?? null, label },
    });

    // Return raw token ONCE
    return NextResponse.json({ ok: true, token: raw, token_id: inserted?.id ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
