import { NextResponse } from "next/server";
import { normalizeEmail, normalizePhone, splitFullName } from "@/lib/onboarding/identity";
import { upsertOnboardingState } from "@/lib/onboarding/state";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const full_name = String((body as any)?.full_name ?? "").trim();
    const email = normalizeEmail((body as any)?.email ?? user.email ?? "");
    const phone = normalizePhone((body as any)?.phone);
    const shop_name = String((body as any)?.shop_name ?? "").trim();
    const device_id = String((body as any)?.device_id ?? "").trim() || null;

    if (!full_name) return NextResponse.json({ ok: false, error: "Full name required" }, { status: 400 });
    if (!email) return NextResponse.json({ ok: false, error: "Email required" }, { status: 400 });
    if (!phone) return NextResponse.json({ ok: false, error: "Phone number required" }, { status: 400 });
    if (!shop_name) return NextResponse.json({ ok: false, error: "Shop name required" }, { status: 400 });
    if (user.email && normalizeEmail(user.email) !== email) {
      return NextResponse.json({ ok: false, error: "Profile email must match the signed-in account email" }, { status: 400 });
    }

    const { first_name, last_name } = splitFullName(full_name);

    try {
      const admin = supabaseAdmin();
      await admin.from("rb_profiles").upsert({
        id: user.id,
        first_name,
        last_name,
        phone,
        email,
        updated_at: new Date().toISOString(),
      });
    } catch (profileError) {
      console.warn("onboarding/save-profile rb_profiles sync warning:", profileError);
    }

    const state = await upsertOnboardingState(user.id, {
      full_name,
      email,
      phone,
      shop_name,
      device_id,
    });

    return NextResponse.json({
      ok: true,
      state: {
        email_verified: Boolean(state.email_verified),
        phone_verified: Boolean(state.phone_verified),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
