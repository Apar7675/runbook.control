import { NextResponse } from "next/server";
import { loadSetupStatus, resolveOnboardingPathForCurrentUser } from "@/lib/onboarding/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { state, path } = await resolveOnboardingPathForCurrentUser();
    const status = await loadSetupStatus(state?.shop_id ?? null);

    return NextResponse.json({
      ok: true,
      employee_count: status.employee_count,
      workstation_count: status.workstation_count,
      onboarding_state: status.onboarding_state,
      validation_result: status.validation_result,
      billing_access_ok: status.billing_access_ok,
      system_ready: status.system_ready,
      can_launch: status.can_launch,
      reasons: status.reasons,
      shop_id: status.shopId,
      resolved_step: path,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
