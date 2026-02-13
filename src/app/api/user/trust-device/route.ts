// REPLACE ENTIRE FILE: src/app/api/user/trust-device/route.ts
//
// REFACTOR (this pass):
// - Uses centralized authz.ts: requireAal2() + assertUuid().
// - Keeps rate limit.
// - Removes unnecessary cookies() call (supabaseServer already reads cookies).
// - UUID tripwire for user_id + device_id (assumes device_id is UUID; if it's NOT, tell me).
// - Uses admin client for upsert (service role).
// - Keeps TRUST_HOURS semantics.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requireAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRUST_HOURS = 24;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `trust:${ip}`, limit: 20, windowMs: 60_000 });

    const { user } = await requireAal2();
    assertUuid("userId", user.id);

    const body = await req.json().catch(() => ({}));
    const device_id = String((body as any)?.device_id ?? "").trim();
    const device_name = String((body as any)?.device_name ?? "").trim() || null;
    const device_type = String((body as any)?.device_type ?? "").trim() || null;

    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    assertUuid("device_id", device_id);

    const now = new Date();
    const trusted_until = new Date(now.getTime() + TRUST_HOURS * 60 * 60 * 1000).toISOString();

    const admin = supabaseAdmin();
    const { error: upErr } = await admin
      .from("rb_trusted_devices")
      .upsert(
        {
          user_id: user.id,
          device_id,
          device_name,
          device_type,
          trusted_at: now.toISOString(),
          trusted_until,
          last_seen_at: now.toISOString(),
        },
        { onConflict: "user_id,device_id" }
      );

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, trusted_until });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
