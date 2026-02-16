import { NextResponse } from "next/server";
import { requireUserFromBearer } from "@/lib/desktopAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { accessToken } = await requireUserFromBearer(req);

    const url = new URL(req.url);
    const shop_id = String(url.searchParams.get("shop_id") ?? "").trim();
    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });

    const origin = url.origin;

    const r = await fetch(`${origin}/api/billing/shop-status?shop_id=${encodeURIComponent(shop_id)}`, {
      method: "GET",
      headers: { "authorization": `Bearer ${accessToken}` },
    });

    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: /not authenticated/i.test(msg) ? 401 : 400 });
  }
}
