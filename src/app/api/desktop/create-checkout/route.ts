import { NextResponse } from "next/server";
import { requireUserFromBearer } from "@/lib/desktopAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This just forwards to your existing /api/billing/create-checkout,
// but uses Bearer auth instead of cookies.
export async function POST(req: Request) {
  try {
    const { accessToken } = await requireUserFromBearer(req);
    const body = await req.json().catch(() => ({}));
    const shop_id = String(body.shop_id ?? "").trim();
    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });

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
    return NextResponse.json({ ok: false, error: msg }, { status: /not authenticated/i.test(msg) ? 401 : 400 });
  }
}
