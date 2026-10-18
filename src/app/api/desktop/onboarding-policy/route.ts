import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const required = process.env.RUNBOOK_DESKTOP_ONBOARDING_CONTACT_VERIFICATION_REQUIRED !== "false";

  return NextResponse.json(
    {
      ok: true,
      email_verification_required: required,
      sms_verification_required: required,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
