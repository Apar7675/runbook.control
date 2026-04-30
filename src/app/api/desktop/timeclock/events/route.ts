import { NextResponse } from "next/server";
import { assertUuid } from "@/lib/authz";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 250;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsed)));
}

function parseSince(value: string | null): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new Error("since must be a valid timestamp.");
  return new Date(parsed).toISOString();
}

async function requireActiveShopMembership(admin: ReturnType<typeof supabaseAdmin>, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id,role,is_active")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error("Shop authorization could not be verified.");
  if (!data?.id) throw new Error("Access denied.");
}

async function requireActiveDesktopDevice(admin: ReturnType<typeof supabaseAdmin>, shopId: string, deviceId: string) {
  const normalized = text(deviceId);
  if (!normalized) return;

  assertUuid("device_id", normalized);
  const { data, error } = await admin
    .from("rb_devices")
    .select("id,shop_id,device_type,status")
    .eq("id", normalized)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error) throw new Error("Desktop device authorization could not be verified.");
  if (!data?.id) throw new Error("Desktop device is not authorized for this shop.");

  const deviceType = text((data as any).device_type).toLowerCase();
  const status = text((data as any).status).toLowerCase();
  if (deviceType && deviceType !== "desktop") throw new Error("Device is not a Desktop device.");
  if (status && status !== "active") throw new Error("Desktop device is inactive.");
}

function safeError(message: string): string {
  if (/not authenticated|access denied|authorization|device|entitlement|uuid|timestamp/i.test(message)) {
    return message;
  }

  return "Time event import lookup failed.";
}

function statusFor(message: string): number {
  if (/not authenticated/i.test(message)) return 401;
  if (/access denied|authorization|device is not|device inactive|entitlement/i.test(message)) return 403;
  if (/uuid|timestamp/i.test(message)) return 400;
  return 500;
}

export async function GET(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const url = new URL(req.url);
    const shopId = text(url.searchParams.get("shop_id"));
    const deviceId = text(url.searchParams.get("device_id"));
    const since = parseSince(url.searchParams.get("since"));
    const limit = parseLimit(url.searchParams.get("limit"));

    if (!shopId) {
      return NextResponse.json({ ok: false, error: "shop_id required" }, { status: 400 });
    }

    assertUuid("shop_id", shopId);
    const admin = supabaseAdmin();
    await requireActiveShopMembership(admin, shopId, user.id);
    await requireActiveDesktopDevice(admin, shopId, deviceId);

    const entitlement = await getShopEntitlement(shopId);
    if (!entitlement.allowed || entitlement.restricted) {
      return NextResponse.json({ ok: false, error: "Shop entitlement does not allow Desktop time event import." }, { status: 403 });
    }

    let query = admin
      .from("time_events")
      .select("id,employee_id,shop_id,event_type,client_ts,server_ts,updated_at,source,device_id,offline_id,note,is_offline,needs_review")
      .eq("shop_id", shopId)
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit);

    if (since) {
      query = query.gt("updated_at", since);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      events: (data ?? []).map((event: any) => ({
        id: text(event.id),
        employee_id: text(event.employee_id),
        shop_id: text(event.shop_id),
        event_type: text(event.event_type),
        client_ts: text(event.client_ts),
        server_ts: text(event.server_ts),
        updated_at: text(event.updated_at),
        source: text(event.source),
        device_id: text(event.device_id),
        offline_id: text(event.offline_id),
        note: event.note == null ? null : text(event.note),
        is_offline: !!event.is_offline,
        needs_review: !!event.needs_review,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Time event import lookup failed.";
    return NextResponse.json(
      { ok: false, error: safeError(message), events: [] },
      { status: statusFor(message) }
    );
  }
}
