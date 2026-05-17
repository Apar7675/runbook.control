import { NextResponse } from "next/server";
import { assertUuid, requireShopAccessOrAdminAal2 } from "@/lib/authz";
import { formatReadinessStatus, READINESS_STATUSES, sanitizeReadinessPayload } from "@/lib/control/readiness";
import { loadShopReadinessReports } from "@/lib/control/readinessViews";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function errorStatus(message: string) {
  if (/not authenticated/i.test(message)) return 401;
  if (/mfa required/i.test(message)) return 403;
  if (/access denied/i.test(message)) return 403;
  if (/must be a uuid/i.test(message)) return 400;
  return 500;
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:readiness:${ip}`, limit: 120, windowMs: 60_000 });

    const url = new URL(req.url);
    const shopId = text(url.searchParams.get("shop_id"));

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    await requireShopAccessOrAdminAal2(shopId);
    const result = await loadShopReadinessReports(shopId);

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `shops:readiness:write:${ip}`, limit: 60, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const shopId = text(body?.shop_id);

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    const { user } = await requireShopAccessOrAdminAal2(shopId);
    const payload = sanitizeReadinessPayload(body);

    if (!payload.computer_name) {
      return NextResponse.json({ ok: false, error: "computer_name is required" }, { status: 400 });
    }

    if (!READINESS_STATUSES.includes(payload.overall_status)) {
      return NextResponse.json({ ok: false, error: "Invalid overall_status" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("rb_device_readiness_reports")
      .insert({
        shop_id: shopId,
        device_id: payload.device_id,
        computer_name: payload.computer_name,
        reported_by_user_id: user.id,
        overall_status: payload.overall_status,
        score: payload.score,
        summary: payload.summary,
        checks: payload.checks,
        app_version: payload.app_version,
        service_version: payload.service_version,
        os_summary: payload.os_summary,
        machine_summary: payload.machine_summary,
        reported_at: payload.reported_at ?? new Date().toISOString(),
      })
      .select("id,shop_id,overall_status,reported_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Readiness report recorded. Control displays submitted readiness reports; it does not scan computers directly.",
      report: {
        id: data?.id ?? null,
        shop_id: data?.shop_id ?? shopId,
        overall_status: formatReadinessStatus(payload.overall_status),
        reported_at: data?.reported_at ?? payload.reported_at ?? null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
