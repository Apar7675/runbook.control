import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    rateLimitOrThrow({ key: "device:create", limit: 60, windowMs: 60_000 });

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    // Auth
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const user = userRes.user;

    // MFA enforcement (AAL2)
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel ?? "aal1") as "aal1" | "aal2" | "aal3";
    if (aal !== "aal2") {
      return NextResponse.json({ ok: false, error: "MFA required (AAL2)" }, { status: 403 });
    }

    // Platform admin check
    const { data: adminRow } = await supabase
      .from("rb_control_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ ok: false, error: "Not a platform admin" }, { status: 403 });
    }

    // Input
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const device_type = String(body?.device_type ?? "desktop").trim() || "desktop";
    const shop_id = String(body?.shop_id ?? "").trim();

    if (!name) {
      return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
    }
    if (!shop_id) {
      return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    }

    // Insert device (service role)
    const { data: device, error } = await admin
      .from("rb_devices")
      .insert({
        name,
        device_type,
        shop_id,
        status: "active",
      })
      .select("*")
      .maybeSingle();

    if (error || !device) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 });
    }

    // Audit (best-effort)
    try {
      await writeAudit({
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "device.create",
        target_type: "device",
        target_id: device.id,
        shop_id,
        meta: { name, device_type },
      });
    } catch {}

    return NextResponse.json({ ok: true, device });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
