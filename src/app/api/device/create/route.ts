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
    rateLimitOrThrow({ key: `device:create:${ip}`, limit: 60, windowMs: 60_000 });

    const { user } = await requirePlatformAdminAal2();

    const body = await req.json().catch(() => ({}));
    const name = String((body as any)?.name ?? "").trim();
    const device_type = String((body as any)?.device_type ?? "desktop").trim() || "desktop";
    const shop_id = String((body as any)?.shop_id ?? "").trim();

    if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shop_id);

    const admin = supabaseAdmin();

    const { data: device, error } = await admin
      .from("rb_devices")
      .insert({ name, device_type, shop_id, status: "active" })
      .select("*")
      .maybeSingle();

    if (error || !device) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 });
    }

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
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401 :
      /mfa required/i.test(msg) ? 403 :
      /not a platform admin/i.test(msg) ? 403 :
      /must be a uuid/i.test(msg) ? 400 :
      500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
