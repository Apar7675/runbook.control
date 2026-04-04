import { NextResponse } from "next/server";
import { getOnboardingState } from "@/lib/onboarding/state";
import { resolveOnboardingPath } from "@/lib/onboarding/flow";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const state = await getOnboardingState(user.id);
    const resolvedRoute = await resolveOnboardingPath(state);

    return NextResponse.json({
      ok: true,
      state: {
        full_name: state?.full_name ?? "",
        email: state?.email ?? user.email ?? "",
        phone: state?.phone ?? "",
        shop_name: state?.shop_name ?? "",
        device_id: state?.device_id ?? null,
        email_verified: Boolean(state?.email_verified),
        phone_verified: Boolean(state?.phone_verified),
        current_step: state?.current_step ?? "profile",
        completed_steps: state?.completed_steps ?? [],
        completed_at: state?.completed_at ?? null,
        shop_id: state?.shop_id ?? null,
        last_seen_at: state?.last_seen_at ?? null,
        resolved_route: resolvedRoute,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
