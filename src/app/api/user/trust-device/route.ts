import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

const TRUST_HOURS = 24;

export async function POST(req: Request) {
  try {
    await cookies();

    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `trust:${ip}`, limit: 20, windowMs: 60_000 });

    const supabase = await supabaseServer();
    const admin = supabaseAdmin();

    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const user = userRes.user;

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";
    if (aal !== "aal2") {
      return NextResponse.json({ ok: false, error: "MFA required (AAL2)" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const device_id = String((body as any)?.device_id ?? "").trim();
    const device_name = String((body as any)?.device_name ?? "").trim() || null;
    const device_type = String((body as any)?.device_type ?? "").trim() || null;

    if (!device_id) {
      return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    }

    const now = new Date();
    const trusted_until = new Date(now.getTime() + TRUST_HOURS * 60 * 60 * 1000).toISOString();

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

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, trusted_until });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
