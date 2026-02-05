import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const deviceId = String(body.deviceId ?? "").trim();
    const deviceKey = String(body.deviceKey ?? "").trim();
    const currentVersion = String(body.currentVersion ?? "").trim(); // optional

    if (!deviceId || !deviceKey) {
      return NextResponse.json({ error: "Missing deviceId or deviceKey" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: device, error: e1 } = await admin
      .from("rb_devices")
      .select("*")
      .eq("id", deviceId)
      .single();

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    const providedHash = sha256Hex(deviceKey);
    if (!device.device_key_hash || providedHash !== device.device_key_hash) {
      return NextResponse.json({ error: "Unauthorized device" }, { status: 401 });
    }

    if (device.status !== "active") {
      return NextResponse.json({ error: "Device disabled" }, { status: 403 });
    }

    // get policy
    const { data: pol, error: e2 } = await admin
      .from("rb_update_policy")
      .select("*")
      .eq("shop_id", device.shop_id)
      .maybeSingle();

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    const channel = (pol?.channel ?? "stable") as string;
    const pinned = pol?.pinned_version ?? null;

    // choose package
    let pkg: any = null;

    if (pinned) {
      const r = await admin.from("rb_update_packages").select("*").eq("channel", channel).eq("version", pinned).maybeSingle();
      if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
      pkg = r.data ?? null;
    }

    if (!pkg) {
      const r = await admin
        .from("rb_update_packages")
        .select("*")
        .eq("channel", channel)
        .order("created_at", { ascending: false })
        .limit(1);

      if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
      pkg = (r.data ?? [])[0] ?? null;
    }

    if (!pkg) {
      return NextResponse.json({ ok: true, update: null }, { status: 200 });
    }

    // If already on that version, return no update
    if (currentVersion && String(currentVersion) === String(pkg.version)) {
      return NextResponse.json({ ok: true, update: null }, { status: 200 });
    }

    // Signed URL for private bucket download
    const { data: signed, error: e3 } = await admin.storage
      .from("rb-updates")
      .createSignedUrl(pkg.file_path, 60); // 60 seconds

    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

    return NextResponse.json(
      {
        ok: true,
        update: {
          channel: pkg.channel,
          version: pkg.version,
          notes: pkg.notes ?? null,
          sha256: pkg.sha256 ?? null,
          downloadUrl: signed?.signedUrl ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
