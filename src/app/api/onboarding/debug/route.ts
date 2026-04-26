import { NextResponse } from "next/server";
import { loadSetupChecklist, resolveOnboardingPathForCurrentUser } from "@/lib/onboarding/flow";
import { validateOnboardingState } from "@/lib/onboarding/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { state, path } = await resolveOnboardingPathForCurrentUser();
    const checklist = state?.shop_id ? await loadSetupChecklist(state.shop_id) : null;
    const validation = validateOnboardingState(state, { setupComplete: checklist?.canLaunch });

    return NextResponse.json({
      onboarding_state: state,
      resolved_step: path,
      is_complete: path === "/shops",
      validation_result: validation,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
