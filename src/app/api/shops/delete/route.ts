import { NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { deleteShopLifecycle, type ShopDeleteMode } from "@/lib/shops/deleteShopLifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseDeleteMode(value: unknown): ShopDeleteMode {
  const normalized = String(value ?? "hard_delete").trim().toLowerCase();
  return normalized === "test_reset" ? "test_reset" : "hard_delete";
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:delete:${ip}`, limit: 30, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shopId = String((body as any)?.shopId ?? "").trim();
    const confirmName = String((body as any)?.confirmName ?? "").trim();
    const mode = parseDeleteMode((body as any)?.mode);

    if (!shopId) {
      return NextResponse.json({ ok: false, error: "Missing shopId" }, { status: 400 });
    }

    if (!confirmName) {
      return NextResponse.json({ ok: false, error: "Missing confirmation name" }, { status: 400 });
    }

    assertUuid("shopId", shopId);

    const { user } = await requirePlatformAdminAal2();

    const summary = await deleteShopLifecycle({
      actorUserId: user.id,
      shopId,
      confirmName,
      mode,
    });

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg)
        ? 401
        : /mfa required/i.test(msg)
          ? 403
          : /not a platform admin/i.test(msg)
            ? 403
            : /must be a uuid/i.test(msg) || /missing/i.test(msg) || /confirmation/i.test(msg) || /not found/i.test(msg)
              ? 400
              : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
