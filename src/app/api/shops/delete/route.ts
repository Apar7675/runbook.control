import { NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { orchestrateShopDelete } from "@/lib/delete/orchestrateShopDelete";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:delete:${ip}`, limit: 60, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shopId = String((body as any)?.shopId ?? "").trim();
    const confirmName = String((body as any)?.confirmName ?? "").trim();

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shopId" }, { status: 400 });
    assertUuid("shopId", shopId);

    const { user } = await requirePlatformAdminAal2();
    const result = await orchestrateShopDelete({
      shopId,
      confirmName,
      actorUserId: user.id,
    });

    if (!result.ok) {
      const lower = String(result.error ?? "").toLowerCase();
      const status =
        lower.includes("confirmation") || lower.includes("not found") || lower.includes("missing")
          ? 400
          : 500;
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? "Delete failed",
          operation: result.operation,
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        already_deleted: result.already_deleted,
        operation: result.operation,
        result: result.result,
      },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : /confirmation/i.test(msg) ? 400
      : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
