import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { describeShopAccess } from "@/lib/billing/access";
import { formatCleanupResponse, loadPendingCleanup } from "@/lib/control/cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const url = new URL(req.url);
    const shop_id = String(url.searchParams.get("shop_id") ?? "").trim();

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shop_id);

    const admin = supabaseAdmin();
    const pendingCleanup = await loadPendingCleanup({
      shopId: shop_id,
      authUserId: user.id,
      targetApps: ["mobile"],
    });

    if (pendingCleanup.preferred) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cleanup required",
          cleanup_required: true,
          cleanup: formatCleanupResponse(pendingCleanup.preferred),
        },
        { status: 410, headers: corsHeaders(req) }
      );
    }

    const { data: member, error: memberError } = await admin
      .from("rb_shop_members")
      .select("id,role")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) return NextResponse.json({ ok: false, error: memberError.message }, { status: 500 });
    if (!member?.id) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const { data: shop, error: shopError } = await admin
      .from("rb_shops")
      .select("id,name,billing_status,trial_started_at,trial_ends_at,billing_current_period_end,grace_ends_at,stripe_customer_id,stripe_subscription_id,subscription_plan,entitlement_override")
      .eq("id", shop_id)
      .maybeSingle();

    if (shopError) return NextResponse.json({ ok: false, error: shopError.message }, { status: 500 });
    if (!shop?.id) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

    const entitlement = await getShopEntitlement(shop_id);
    const access = describeShopAccess(entitlement);

    return NextResponse.json({ ok: true, shop, entitlement, access }, { headers: corsHeaders(req) });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401
      : /access denied/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status, headers: corsHeaders(req) });
  }
}
