import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/onboarding/identity";
import { getOnboardingState, upsertOnboardingState, verifyStoredCode } from "@/lib/onboarding/state";
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
    const phone = normalizePhone((body as any)?.phone);
    const code = String((body as any)?.code ?? "").trim();

    if (!phone) return NextResponse.json({ ok: false, error: "Phone number required." }, { status: 400 });
    if (!code || code.length !== 6) return NextResponse.json({ ok: false, error: "Enter the 6-digit SMS code." }, { status: 400 });

    const state = await getOnboardingState(user.id);
    if (!state || normalizePhone(state.phone) !== phone) {
      return NextResponse.json({ ok: false, error: "Request an SMS code first." }, { status: 400 });
    }

    const result = await verifyStoredCode({
      userId: user.id,
      channel: "sms",
      destination: phone,
      code,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          reason: (result as any).reason ?? null,
          attempts_remaining: (result as any).attempts_remaining ?? null,
        },
        { status: 400 }
      );
    }

    const updated = await upsertOnboardingState(user.id, {
      phone,
      phone_verified: true,
      phone_verified_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      phone_verified: Boolean(updated.phone_verified),
      message: result.alreadyVerified ? "Phone number is already verified." : "Phone verified. You can continue once your email is verified too.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
