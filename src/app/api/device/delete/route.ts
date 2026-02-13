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
    rateLimitOrThrow({ key: `device:delete:${ip}`, limit: 60, windowMs: 60_000 });

    const { user } = await requirePlatformAdminAal2();

    const body = await req.json().catch(() => ({}));
    const device_id = String((body as any)?.device_id ?? "").trim();
    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    assertUuid("device_id", device_id);

    const admin = supabaseAdmin();

    const { data: dev, error: devErr } = await admin
      .from("rb_devices")
      .select("id,shop_id,name,device_type,status")
      .eq("id", device_id)
      .maybeSingle();

    if (devErr) return NextResponse.json({ ok: false, error: devErr.message }, { status: 500 });
    if (!dev) return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });

    const { error: delErr } = await admin.from("rb_devices").delete().eq("id", device_id);
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });

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
