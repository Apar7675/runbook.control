import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { describeShopAccess } from "@/lib/billing/access";
import { requireWorkstationSession, workstationAuthError } from "@/lib/workstationAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: any) {
  return String(v ?? "").trim();
}

async function ensureEmployee(admin: any, shopId: string, employeeId: string) {
  const { data, error } = await admin
    .from("employees")
    .select("id,shop_id,is_active,workstation_access_enabled,can_timeclock")
    .eq("shop_id", shopId)
    .eq("id", employeeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Employee not found.");
  if (!(data as any).is_active) throw new Error("Employee is inactive.");
  if (!(data as any).workstation_access_enabled || !(data as any).can_timeclock) {
    throw new Error("Time Clock access not assigned.");
  }
}

async function requireActiveWorkstation(admin: any, shopId: string, workstationId: string) {
  const { data, error } = await admin
    .from("rb_devices")
    .select("id,shop_id,status,device_type")
    .eq("id", workstationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Workstation not registered.");
  if (s((data as any).shop_id) !== shopId) throw new Error("Workstation not registered for this shop.");
  if (s((data as any).device_type).toLowerCase() !== "workstation") throw new Error("Device is not a workstation.");
  if (s((data as any).status).toLowerCase() !== "active") throw new Error("Workstation is disabled.");
}

async function loadRecentPunches(admin: any, shopId: string, employeeId: string) {
  const { data, error } = await admin
    .from("time_events")
    .select("id,employee_id,shop_id,event_type,client_ts,server_ts,created_at,source,device_id,offline_id,note,is_offline")
    .eq("shop_id", shopId)
    .eq("employee_id", employeeId)
    .order("client_ts", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: s(row.id),
    employee_id: s(row.employee_id),
    shop_id: s(row.shop_id),
    event_type: s(row.event_type),
    client_ts: s(row.client_ts),
    server_ts: s(row.server_ts) || s(row.created_at),
    source: s(row.source),
    device_id: s(row.device_id),
    offline_id: s(row.offline_id),
    note: s(row.note),
    is_offline: !!row.is_offline,
  }));
}

export async function GET(req: Request) {
  try {
    const session = requireWorkstationSession(req);
    const admin = supabaseAdmin();
    const access = describeShopAccess(await getShopEntitlement(session.shop_id));
    if (access.workstation_mode !== "full") {
      return NextResponse.json({ ok: false, error: access.summary, access }, { status: 402 });
    }
    await ensureEmployee(admin, session.shop_id, session.employee_id);
    const punches = await loadRecentPunches(admin, session.shop_id, session.employee_id);
    return NextResponse.json({ ok: true, punches, employee_id: session.employee_id, shop_id: session.shop_id, workstation_id: session.workstation_id, access });
  } catch (e) {
    return workstationAuthError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = requireWorkstationSession(req);
    const admin = supabaseAdmin();
    const access = describeShopAccess(await getShopEntitlement(session.shop_id));
    if (access.workstation_mode !== "full") {
      return NextResponse.json({ ok: false, error: access.summary, access }, { status: 402 });
    }
    await ensureEmployee(admin, session.shop_id, session.employee_id);
    await requireActiveWorkstation(admin, session.shop_id, session.workstation_id);

    const body = await req.json().catch(() => ({}));
    const event_type = s((body as any).event_type);
    const client_ts = s((body as any).client_ts) || new Date().toISOString();
    const offline_id = s((body as any).offline_id) || `${session.workstation_id}-${Date.now()}`;
    const note = s((body as any).note);

    if (!event_type) return NextResponse.json({ ok: false, error: "event_type required" }, { status: 400 });

    const { error } = await admin.from("time_events").upsert({
      employee_id: session.employee_id,
      shop_id: session.shop_id,
      event_type,
      client_ts,
      source: "workstation",
      device_id: session.workstation_id,
      offline_id,
      note: note || null,
      is_offline: false,
    }, { onConflict: "offline_id" });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const punches = await loadRecentPunches(admin, session.shop_id, session.employee_id);
    return NextResponse.json({ ok: true, punches, employee_id: session.employee_id, shop_id: session.shop_id, workstation_id: session.workstation_id, access });
  } catch (e) {
    return workstationAuthError(e);
  }
}
