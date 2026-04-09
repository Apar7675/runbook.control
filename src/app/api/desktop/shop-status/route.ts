import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { describeShopAccess } from "@/lib/billing/access";
import { formatCleanupResponse, loadPendingCleanup } from "@/lib/control/cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tryExtractMissingColumn(msg: string): string | null {
  const text = String(msg ?? "");
  const relationMatch = text.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = text.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = text.match(/column\s+rb_shops\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  return null;
}

async function loadShopWithAutoStrip(admin: any, shopId: string) {
  const columns = [
    "id",
    "name",
    "billing_status",
    "trial_started_at",
    "trial_ends_at",
    "billing_current_period_end",
    "grace_ends_at",
    "stripe_customer_id",
    "stripe_subscription_id",
    "subscription_plan",
    "entitlement_override",
  ];

  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt++) {
    const { data, error } = await admin
      .from("rb_shops")
      .select(working.join(","))
      .eq("id", shopId)
      .single();

    if (!error) return data;

    const msg = String(error.message ?? error ?? "");
    const col = tryExtractMissingColumn(msg);
    if (col && working.includes(col)) {
      working = working.filter((entry) => entry !== col);
      continue;
    }

    throw new Error(msg);
  }

  throw new Error("Shop status lookup failed after stripping missing columns");
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
      targetApps: ["desktop"],
    });

    if (pendingCleanup.preferred) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cleanup required",
          cleanup_required: true,
          cleanup: formatCleanupResponse(pendingCleanup.preferred),
        },
        { status: 410 }
      );
    }

    const { data: member, error: memErr } = await admin
      .from("rb_shop_members")
      .select("id, role")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 });
    if (!member) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const shop = await loadShopWithAutoStrip(admin, shop_id);
    const entitlement = await getShopEntitlement(shop_id);
    const access = describeShopAccess(entitlement);
    return NextResponse.json({ ok: true, shop, entitlement, access });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
