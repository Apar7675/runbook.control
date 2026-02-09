import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const session_id = (url.searchParams.get("session_id") ?? "").trim();
    if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(session_id);

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
            current_period_end: sub.current_period_end ?? null,
            metadata: sub.metadata ?? null,
          }
        : null,
    });
  } catch (e: any) {
    console.error("debug-session error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
