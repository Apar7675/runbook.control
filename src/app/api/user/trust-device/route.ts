import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Next 16: cookies() is async in the type system
    await cookies();

    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `trust:${ip}`, limit: 20, windowMs: 60_000 });

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

    // Upsert trust record (service role)
    // NOTE: adjust table/columns if your schema differs.
    const { error: upErr } = await admin
      .from("rb_trusted_devices")
      .upsert(
        {
          user_id: user.id,
          device_id,
          device_name,
          device_type,
          trusted_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" }
      );

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    // Set a cookie (best-effort). If your project uses a different cookie name, change here.
    // We do NOT read x-forwarded-for from cookies anymore (that was the build-breaking line).
    try {
      const store = await cookies();
      store.set({
        name: "rb_trusted_device",
        value: device_id,
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
