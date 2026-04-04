import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/onboarding/identity";
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
    const email = normalizeEmail((body as any)?.email);
    const code = String((body as any)?.code ?? "").trim();

    if (!email) return NextResponse.json({ ok: false, error: "Email required." }, { status: 400 });
    if (!code || code.length !== 6) return NextResponse.json({ ok: false, error: "Enter the 6-digit email code." }, { status: 400 });

    const state = await getOnboardingState(user.id);
    if (!state || normalizeEmail(state.email) !== email) {
      return NextResponse.json({ ok: false, error: "Request an email code first." }, { status: 400 });
    }

    const result = await verifyStoredCode({
      userId: user.id,
      channel: "email",
      destination: email,
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
      email,
      email_verified: true,
      email_verified_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      email_verified: Boolean(updated.email_verified),
      message: result.alreadyVerified ? "Email is already verified." : "Email verified. You can move on once your phone is verified too.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
