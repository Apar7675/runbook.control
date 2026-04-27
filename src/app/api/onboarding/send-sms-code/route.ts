import { NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import {
  generateSixDigitCode,
  isDisposableEmail,
  isObviouslyInvalidPhone,
  normalizeEmail,
  normalizePhone,
} from "@/lib/onboarding/identity";
import { isTwilioVerifyConfigured, sendOnboardingSmsCode } from "@/lib/onboarding/messaging";
import { issueVerificationCode, upsertOnboardingState } from "@/lib/onboarding/state";
import { getRouteUser } from "@/lib/supabase/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getRouteUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const full_name = String((body as any)?.full_name ?? "").trim();
    const email = normalizeEmail((body as any)?.email);
    const phone = normalizePhone((body as any)?.phone);
    const shop_name = String((body as any)?.shop_name ?? "").trim();
    const device_id = String((body as any)?.device_id ?? "").trim() || null;
    const ip = req.headers.get("x-forwarded-for") ?? "local";

    if (!full_name) return NextResponse.json({ ok: false, error: "Full name required." }, { status: 400 });
    if (!email) return NextResponse.json({ ok: false, error: "Email required." }, { status: 400 });
    if (!phone) return NextResponse.json({ ok: false, error: "Phone number required." }, { status: 400 });
    if (isDisposableEmail(email)) {
      return NextResponse.json({ ok: false, error: "Disposable email addresses are not allowed." }, { status: 400 });
    }
    if (isObviouslyInvalidPhone(phone)) {
      return NextResponse.json({ ok: false, error: "Enter a valid phone number." }, { status: 400 });
    }

    rateLimitOrThrow({ key: `onboarding:sms:ip:${ip}`, limit: 8, windowMs: 10 * 60_000 });
    rateLimitOrThrow({ key: `onboarding:sms:phone:${phone}`, limit: 5, windowMs: 10 * 60_000 });

    await upsertOnboardingState(user.id, { full_name, email, phone, shop_name, device_id });

    let expires_at: string | null = null;
    let resend_available_in = 45;
    let delivery;
    if (isTwilioVerifyConfigured()) {
      delivery = await sendOnboardingSmsCode({ phone });
    } else {
      const code = generateSixDigitCode();
      const issue = await issueVerificationCode({
        userId: user.id,
        channel: "sms",
        destination: phone,
        code,
      });
      expires_at = issue.expires_at;
      resend_available_in = issue.resend_available_in;
      delivery = await sendOnboardingSmsCode({ phone, code });
    }

    return NextResponse.json({
      expires_at,
      resend_available_in,
      message: "SMS code sent. Use it to confirm this phone number before continuing.",
      ...delivery,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
