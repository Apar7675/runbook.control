import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { requirePlatformAdminAal2, assertUuid } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isMissingColumnError(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("does not exist") && m.includes("column");
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:list:${ip}`, limit: 120, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const admin = supabaseAdmin();

    // Try "new schema" first (last_seen_at + reported_version may or may not exist)
    const selectNew =
      "id,shop_id,name,status,created_at,last_seen_at,reported_version,device_type,device_key,device_key_hash, rb_shops(name)";
    const selectOld =
      "id,shop_id,name,status,created_at,device_type,device_key,device_key_hash, rb_shops(name)";

    let devicesRaw: any[] | null = null;

    {
      const r = await admin.from("rb_devices").select(selectNew).order("created_at", { ascending: false }).limit(200);
      if (!r.error) {
        devicesRaw = (r.data ?? []) as any[];
      } else if (isMissingColumnError(r.error.message)) {
        const r2 = await admin.from("rb_devices").select(selectOld).order("created_at", { ascending: false }).limit(200);
        if (r2.error) return NextResponse.json({ ok: false, error: r2.error.message }, { status: 500 });
        devicesRaw = (r2.data ?? []) as any[];
      } else {
        return NextResponse.json({ ok: false, error: r.error.message }, { status: 500 });
      }
    }

    const devices = (devicesRaw ?? []).map((d: any) => ({
      id: d.id,
      shop_id: d.shop_id,
      name: d.name,
      status: d.status,
      created_at: d.created_at,

      // these only exist on newer schema; keep null if missing
      last_seen_at: d.last_seen_at ?? null,
      reported_version: d.reported_version ?? null,

      device_type: d.device_type ?? null,

      // compatibility with older schema fields (if present)
      device_key: d.device_key ?? null,
      device_key_hash: d.device_key_hash ?? null,

      shop_name: d?.rb_shops?.name ?? null,
    }));

    const deviceIds = devices.map((d: any) => {
      assertUuid("device.id", String(d.id));
      return d.id;
    });

    let tokens: any[] = [];
    if (deviceIds.length) {
      const { data: tokData, error: tErr } = await admin
        .from("rb_device_tokens")
        .select("id,device_id,created_at,issued_at,revoked_at,last_seen_at,label")
        .in("device_id", deviceIds);

      if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
      tokens = tokData ?? [];
    }

    return NextResponse.json({ ok: true, devices, tokens });
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
