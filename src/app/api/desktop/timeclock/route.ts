import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/authz";
import { getShopEntitlement } from "@/lib/billing/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: any) {
  return String(v ?? "").trim();
}

async function getShopMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Access denied");
}

async function ensureEmployee(admin: any, shopId: string, remoteEmployeeId: string) {
  const { data, error } = await admin
    .from("employees")
    .select("id, shop_id, is_active")
    .eq("shop_id", shopId)
    .eq("id", remoteEmployeeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Employee not found.");
  if (!(data as any).is_active) throw new Error("Employee is inactive.");
  return data;
}

async function loadTimeEvent(admin: any, shopId: string, remoteEmployeeId: string, offlineId: string) {
  const { data, error } = await admin
    .from("time_events")
    .select("id,employee_id,shop_id,event_type,client_ts,server_ts,created_at,source,device_id,offline_id,note,is_offline")
    .eq("shop_id", shopId)
    .eq("employee_id", remoteEmployeeId)
    .eq("offline_id", offlineId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Uploaded time event could not be loaded.");

  return {
    id: s((data as any).id),
    employee_id: s((data as any).employee_id),
    shop_id: s((data as any).shop_id),
    event_type: s((data as any).event_type),
    client_ts: s((data as any).client_ts),
    server_ts: s((data as any).server_ts) || s((data as any).created_at),
    source: s((data as any).source),
    device_id: s((data as any).device_id),
    offline_id: s((data as any).offline_id),
    note: s((data as any).note),
    is_offline: !!(data as any).is_offline,
  };
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));

    const shopId = s((body as any).shop_id);
    const remoteEmployeeId = s((body as any).remote_employee_id);
    const eventType = s((body as any).event_type);
    const clientTs = s((body as any).client_ts) || new Date().toISOString();
    const offlineId = s((body as any).offline_id);
    const note = s((body as any).note);
    const source = s((body as any).source) || "desktop";
    const deviceId = s((body as any).device_id);

    if (!shopId) return NextResponse.json({ ok: false, error: "shop_id required" }, { status: 400 });
    if (!remoteEmployeeId) return NextResponse.json({ ok: false, error: "remote_employee_id required" }, { status: 400 });
    if (!eventType) return NextResponse.json({ ok: false, error: "event_type required" }, { status: 400 });
    if (!offlineId) return NextResponse.json({ ok: false, error: "offline_id required" }, { status: 400 });

    assertUuid("shop_id", shopId);
    assertUuid("remote_employee_id", remoteEmployeeId);

    const admin = supabaseAdmin();
    await getShopMembership(admin, shopId, user.id);

    const entitlement = await getShopEntitlement(shopId);
    if (!entitlement.allowed || entitlement.restricted) {
      return NextResponse.json({ ok: false, error: entitlement.reason, entitlement }, { status: 402 });
    }

    await ensureEmployee(admin, shopId, remoteEmployeeId);

    const { error } = await admin.from("time_events").upsert({
      employee_id: remoteEmployeeId,
      shop_id: shopId,
      event_type: eventType,
      client_ts: clientTs,
      source,
      device_id: deviceId || null,
      offline_id: offlineId,
      note: note || null,
      is_offline: false,
    }, { onConflict: "offline_id" });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const event = await loadTimeEvent(admin, shopId, remoteEmployeeId, offlineId);
    return NextResponse.json({ ok: true, event, entitlement });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /access denied/i.test(msg) ? 403 : /must be a uuid|required/i.test(msg) ? 400 : /not found|inactive/i.test(msg) ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
