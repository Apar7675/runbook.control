import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";
import { assertUuid } from "@/lib/authz";
import {
  loadDesktopShopLink,
  loadPrimaryDesktopShopLink,
  upsertDesktopShopLink,
} from "@/lib/desktop/shopDeviceTrust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRole(value: unknown) {
  const role = String(value ?? "").trim().toLowerCase();
  return role === "primary" || role === "secondary" ? role : "";
}

async function requireMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied");
}

export async function GET(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const url = new URL(req.url);
    const shopId = String(url.searchParams.get("shop_id") ?? "").trim();
    const deviceId = String(url.searchParams.get("device_id") ?? "").trim();

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!deviceId) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    assertUuid("shop_id", shopId);
    assertUuid("device_id", deviceId);

    const admin = supabaseAdmin();
    await requireMembership(admin, shopId, user.id);

    const device = await loadDesktopShopLink(admin, shopId, deviceId);
    const primary = await loadPrimaryDesktopShopLink(admin, shopId, deviceId);

    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      device_id: deviceId,
      linked: !!device?.device_id,
      device_role: String(device?.device_role ?? "").trim(),
      primary_exists: !!primary?.device_id,
      primary_device_id: String(primary?.device_id ?? "").trim(),
      primary_device_name: String(primary?.device_name ?? "").trim(),
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shopId = String(body.shop_id ?? "").trim();
    const deviceId = String(body.device_id ?? "").trim();
    const deviceRole = normalizeRole(body.role);
    const deviceName = String(body.device_name ?? "").trim();

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!deviceId) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    if (!deviceRole) return NextResponse.json({ ok: false, error: "Missing role" }, { status: 400 });
    assertUuid("shop_id", shopId);
    assertUuid("device_id", deviceId);

    const admin = supabaseAdmin();
    await requireMembership(admin, shopId, user.id);

    const otherPrimary = await loadPrimaryDesktopShopLink(admin, shopId, deviceId);
    if (deviceRole === "primary" && otherPrimary?.device_id) {
      return NextResponse.json({
        ok: false,
        error: "A main shop computer is already set for this shop.",
        primary_device_id: String(otherPrimary.device_id ?? "").trim(),
        primary_device_name: String(otherPrimary.device_name ?? "").trim(),
      }, { status: 409 });
    }

    const name = deviceName || `RunBook Desktop (${deviceId.slice(0, 8)})`;
    const link = await upsertDesktopShopLink(admin, {
      shopId,
      deviceId,
      deviceName: name,
      status: "active",
      deviceRole,
    });

    const primary = await loadPrimaryDesktopShopLink(admin, shopId);
    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      device_id: deviceId,
      linked: !!link?.device_id,
      device_role: String(link?.device_role ?? deviceRole).trim(),
      primary_exists: !!primary?.device_id,
      primary_device_id: String(primary?.device_id ?? "").trim(),
      primary_device_name: String(primary?.device_name ?? "").trim(),
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
