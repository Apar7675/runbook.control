import { NextResponse } from "next/server";
import { completeOnboardingForCurrentUser } from "@/lib/onboarding/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await completeOnboardingForCurrentUser();
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      redirect_to: "/onboarding/complete",
      completed_at: result.state.completed_at,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
