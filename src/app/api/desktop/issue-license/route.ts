import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";
import { getShopEntitlement } from "@/lib/billing/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sign(payload: any, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64url(Buffer.from(JSON.stringify(header)));
  const p = b64url(Buffer.from(JSON.stringify(payload)));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

async function requireActiveDevice(admin: ReturnType<typeof supabaseAdmin>, shopId: string, deviceId: string) {
  const { data: device, error } = await admin
    .from("rb_devices")
    .select("id,shop_id,status")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!device?.id) return { ok: false, error: "Device not registered for this shop." };
  if (String(device.shop_id ?? "").trim() !== shopId) return { ok: false, error: "Device not registered for this shop." };
  if (String(device.status ?? "").trim().toLowerCase() !== "active") return { ok: false, error: "Device inactive." };
  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shop_id = String(body.shop_id ?? "").trim();
    const device_id = String(body.device_id ?? "").trim();

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });

    const admin = supabaseAdmin();

    const { data: mem } = await admin
      .from("rb_shop_members")
      .select("role")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mem) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const deviceCheck = await requireActiveDevice(admin, shop_id, device_id);
    if (!deviceCheck.ok) {
      return NextResponse.json({ ok: false, error: deviceCheck.error }, { status: 403 });
    }

    const entitlement = await getShopEntitlement(shop_id);
    if (!entitlement.allowed || entitlement.restricted) {
      return NextResponse.json(
        { ok: false, error: entitlement.reason, entitlement },
        { status: 402 }
      );
    }

    const secret = env("RUNBOOK_LICENSE_SIGNING_SECRET");

    const token = sign(
      {
        iss: "runbook.control",
        sub: user.id,
        shop_id,
        device_id,
        status: entitlement.status,
        restricted: entitlement.restricted,
        grace_active: entitlement.grace_active,
        iat: Math.floor(Date.now() / 1000),
      },
      secret
    );

    return NextResponse.json({ ok: true, token, entitlement });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

