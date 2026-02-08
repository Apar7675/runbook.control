import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceKey = String(body.deviceKey ?? "").trim();
    const version = String(body.version ?? "").trim();

    if (!deviceKey || !version) {
      return NextResponse.json({ error: "Missing deviceKey or version" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!url || !anon) {
      return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
    }

    // Device is not an authenticated user; use anon key + RPC granted to anon.
    const supabase = createClient(url, anon);

    const { error } = await supabase.rpc("rb_device_checkin", {
      p_device_key: deviceKey,
      p_reported_version: version,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 403 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
