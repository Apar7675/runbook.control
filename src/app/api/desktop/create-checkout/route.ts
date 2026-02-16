// REPLACE ENTIRE FILE: src/app/api/desktop/create-checkout/route.ts
//
// Desktop checkout endpoint (Bearer auth).
// - Auth: Authorization: Bearer <access_token>
// - Enforces membership (rb_shop_members)
// - Forwards to /api/billing/create-checkout (which builds the Stripe session)

import { NextResponse } from "next/server";
import { requireUserFromBearer } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user, accessToken } = await requireUserFromBearer(req);

    const body = await req.json().catch(() => ({}));
    const shop_id = String((body as any)?.shop_id ?? "").trim();
    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shop_id);

    const admin = supabaseAdmin();

    // ✅ Must be a member of this shop
    const { data: member, error: memErr } = await admin
      .from("rb_shop_members")
      .select("id, role")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 });
    if (!member) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const url = new URL(req.url);
    const origin = url.origin;

    const r = await fetch(`${origin}/api/billing/create-checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ shop_id }),
    });

    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
