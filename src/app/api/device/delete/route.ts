import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:delete:${ip}`, limit: 60, windowMs: 60_000 });

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    // Auth
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const user = userRes.user;

    // AAL2
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel ?? "aal1") as "aal1" | "aal2" | "aal3";
    if (aal !== "aal2") {
      return NextResponse.json({ ok: false, error: "MFA required (AAL2)" }, { status: 403 });
    }

    // Platform admin
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
    const device_id = String(body?.device_id ?? "").trim();
    if (!device_id) {
      return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    }

    // Read for audit context
    const { data: dev, error: devErr } = await admin
      .from("rb_devices")
      .select("id,shop_id,name,device_type,status")
      .eq("id", device_id)
      .maybeSingle();

    if (devErr) {
      return NextResponse.json({ ok: false, error: devErr.message }, { status: 500 });
    }
    if (!dev) {
      return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
    }

    // Delete (tokens should cascade)
    const { error: delErr } = await admin.from("rb_devices").delete().eq("id", device_id);
    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }

    // Audit best-effort
    try {
      await writeAudit({
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "device.delete",
        target_type: "device",
        target_id: device_id,
        shop_id: dev.shop_id ?? null,
        meta: { name: dev.name, device_type: dev.device_type ?? null, prev_status: dev.status ?? null },
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
