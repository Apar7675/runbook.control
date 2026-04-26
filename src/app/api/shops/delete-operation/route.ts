import { NextResponse } from "next/server";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { normalizeDeleteResult, findLatestDeleteOperation } from "@/lib/delete/operations";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:delete-operation:${ip}`, limit: 120, windowMs: 60_000 });

    const url = new URL(req.url);
    const shopId = text(url.searchParams.get("shop_id"));
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    await requirePlatformAdminAal2();

    const operation = await findLatestDeleteOperation(shopId);
    return NextResponse.json({
      ok: true,
      operation: operation ? normalizeDeleteResult(operation) : null,
    });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
