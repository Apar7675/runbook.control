// REPLACE ENTIRE FILE: src/app/api/billing/debug-session/route.ts
//
// HARDENING (this pass):
// - Rate limit (this endpoint can leak billing info).
// - Requires platform admin + AAL2 (not just "any authed user").
// - Redacts output: does NOT return full subscription object.
// - Keeps useful fields for debugging Stripe linkage.
//
// NOTE: This should be considered a privileged endpoint. If you don't need it in prod,
// consider removing it or gating behind NODE_ENV !== 'production'.

import { NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { getStripe } from "@/lib/stripe/server";
import { requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:debug-session:${ip}`, limit: 60, windowMs: 60_000 });

    await requirePlatformAdminAal2();

    const url = new URL(req.url);
    const session_id = (url.searchParams.get("session_id") ?? "").trim();
    if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

    const stripe = getStripe();
    const session: any = await stripe.checkout.sessions.retrieve(session_id);

    let sub: any = null;
    if (session.subscription) {
      sub = await stripe.subscriptions.retrieve(String(session.subscription));
    }

    return NextResponse.json({
      ok: true,
      session: {
        id: session.id,
        mode: session.mode,
        status: session.status,
        payment_status: session.payment_status,
        client_reference_id: session.client_reference_id,
        customer: session.customer,
        subscription: session.subscription,
        metadata: session.metadata,
      },
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            customer: sub.customer,
            // intentionally redacted: keep only what you need
            current_period_end: sub.current_period_end ?? null,
            metadata: sub.metadata ?? null,
          }
        : null,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) ? 403 : /not a platform admin/i.test(msg) ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
