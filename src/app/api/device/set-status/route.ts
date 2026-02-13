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
    rateLimitOrThrow({ key: `device:set-status:${ip}`, limit: 60, windowMs: 60_000 });

    const { user } = await requirePlatformAdminAal2();

    const body = await req.json().catch(() => ({}));
    const device_id = String((body as any)?.device_id ?? "").trim();
    const status = String((body as any)?.status ?? "").trim();

    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    assertUuid("device_id", device_id);

    if (status !== "active" && status !== "disabled") {
      return NextResponse.json({ ok: false, error: "Invalid status (use active|disabled)" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: dev, error: devErr } = await admin
      .from("rb_devices")
      .select("id,shop_id,name,device_type,status")
      .eq("id", device_id)
      .maybeSingle();

    if (devErr) return NextResponse.json({ ok: false, error: devErr.message }, { status: 500 });
    if (!dev) return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });

    const prevStatus = dev.status ?? null;

    const { error: upErr } = await admin.from("rb_devices").update({ status }).eq("id", device_id);
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    try {
      await writeAudit({
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "device.status.set",
        target_type: "device",
        target_id: device_id,
        shop_id: dev.shop_id ?? null,
        meta: {
          name: dev.name ?? null,
          device_type: dev.device_type ?? null,
          prev_status: prevStatus,
          new_status: status,
        },
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
