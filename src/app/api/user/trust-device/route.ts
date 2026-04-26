import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { requireAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRUST_HOURS = 24;

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `trust:${ip}`, limit: 20, windowMs: 60_000 });

    const { user } = await requireAal2();
    const body = await req.json().catch(() => ({}));
    const jar = await cookies();

    const device_id =
      text((body as any)?.device_id) ||
      text(jar.get("rb_device_id")?.value);
    const device_name = text((body as any)?.device_name) || null;
    const device_type = text((body as any)?.device_type) || "browser";

    if (!device_id) {
      return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    }

    const now = new Date();
    const trusted_until = new Date(now.getTime() + TRUST_HOURS * 60 * 60 * 1000).toISOString();

    const admin = supabaseAdmin();
    const { error } = await admin
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
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id,device_id" }
      );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, trusted_until, device_id });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
