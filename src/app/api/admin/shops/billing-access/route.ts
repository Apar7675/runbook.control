import { NextResponse } from "next/server";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { writeAudit } from "@/lib/audit/writeAudit";
import { describeShopAccess } from "@/lib/billing/access";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { parseIsoMillis, SHOP_BILLING_SELECT_COLUMNS } from "@/lib/billing/manual";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportedAction =
  | "extend_trial"
  | "extend_grace"
  | "set_entitlement_override"
  | "clear_overrides";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function parsePositiveDays(value: unknown, label: string) {
  const raw = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(raw) || raw < 1 || raw > 3650) {
    throw new Error(`${label} must be between 1 and 3650 days.`);
  }
  return raw;
}

function addDaysFromBaseline(existingIso: string | null | undefined, days: number) {
  const now = Date.now();
  const existingMs = parseIsoMillis(existingIso);
  const baseline = existingMs && existingMs > now ? existingMs : now;
  return new Date(baseline + days * 24 * 60 * 60 * 1000).toISOString();
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function normalizeEntitlementOverride(value: unknown): "allow" | "restricted" | null {
  const normalized = text(value).toLowerCase();
  if (!normalized || normalized === "none" || normalized === "normal") return null;
  if (normalized === "allow" || normalized === "restricted") return normalized;
  throw new Error("Override must be allow, restricted, or none.");
}

async function loadShop(admin: ReturnType<typeof supabaseAdmin>, shopId: string) {
  const { data, error } = await admin
    .from("rb_shops")
    .select(SHOP_BILLING_SELECT_COLUMNS.join(","))
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as any;
  if (!row?.id) throw new Error("Shop not found");
  return row;
}

export async function POST(req: Request) {
  let actorUserId: string | null = null;
  let actorEmail: string | null = null;
  let shopId = "";
  let requestedAction = "";

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:access:${ip}`, limit: 60, windowMs: 60_000 });

    const { user } = await requirePlatformAdminAal2();
    actorUserId = user.id;
    actorEmail = user.email ?? null;

    const body = await req.json().catch(() => ({}));
    shopId = text((body as any).shop_id);
    requestedAction = text((body as any).action);

    if (!shopId) {
      return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    }

    assertUuid("shop_id", shopId);

    const action = requestedAction as SupportedAction;
    const note = text((body as any).note);
    const admin = supabaseAdmin();
    const currentShop = await loadShop(admin, shopId);

    let patch: Record<string, unknown>;
    let auditAction: string;
    let auditMeta: Record<string, unknown>;

    if (action === "extend_trial") {
      if (!note) {
        return NextResponse.json({ ok: false, error: "Add an operator note before extending trial access." }, { status: 400 });
      }

      const days = parsePositiveDays((body as any).days, "Trial extension");
      const nextTrialEndsAt = addDaysFromBaseline(currentShop.trial_ends_at ?? null, days);

      patch = {
        trial_ends_at: nextTrialEndsAt,
        trial_override_reason: note,
        manual_billing_override: true,
        manual_billing_status: "trial_extended",
      };
      auditAction = "billing.access.trial_extended";
      auditMeta = {
        days,
        note,
        previous_trial_ends_at: currentShop.trial_ends_at ?? null,
        next_trial_ends_at: nextTrialEndsAt,
      };
    } else if (action === "extend_grace") {
      if (!note) {
        return NextResponse.json({ ok: false, error: "Add an operator note before extending grace." }, { status: 400 });
      }

      const days = parsePositiveDays((body as any).days, "Grace extension");
      const nextGraceEndsAt = addDaysFromBaseline(currentShop.grace_ends_at ?? null, days);

      patch = {
        grace_ends_at: nextGraceEndsAt,
      };
      auditAction = "billing.access.grace_extended";
      auditMeta = {
        days,
        note,
        previous_grace_ends_at: currentShop.grace_ends_at ?? null,
        next_grace_ends_at: nextGraceEndsAt,
      };
    } else if (action === "set_entitlement_override") {
      if (!note) {
        return NextResponse.json({ ok: false, error: "Add an operator note before changing access override." }, { status: 400 });
      }

      const entitlementOverride = normalizeEntitlementOverride((body as any).override);
      patch = {
        entitlement_override: entitlementOverride,
      };
      auditAction = "billing.access.entitlement_override_set";
      auditMeta = {
        note,
        previous_override: currentShop.entitlement_override ?? null,
        next_override: entitlementOverride,
      };
    } else if (action === "clear_overrides") {
      if (!note) {
        return NextResponse.json({ ok: false, error: "Add an operator note before clearing overrides." }, { status: 400 });
      }

      patch = {
        manual_billing_override: false,
        manual_billing_status: null,
        entitlement_override: null,
      };
      auditAction = "billing.access.override_cleared";
      auditMeta = {
        note,
        previous_manual_billing_override: Boolean(currentShop.manual_billing_override),
        previous_manual_billing_status: currentShop.manual_billing_status ?? null,
        previous_entitlement_override: currentShop.entitlement_override ?? null,
        trial_ends_at_retained: currentShop.trial_ends_at ?? null,
        grace_ends_at_retained: currentShop.grace_ends_at ?? null,
      };
    } else {
      return NextResponse.json({ ok: false, error: "Unsupported billing access action." }, { status: 400 });
    }

    const changedFields = Object.entries(patch)
      .filter(([key, value]) => !sameValue(currentShop[key], value))
      .map(([key, value]) => ({
        field: key,
        before: currentShop[key] ?? null,
        after: value ?? null,
      }));

    if (changedFields.length === 0) {
      const entitlement = await getShopEntitlement(shopId);
      return NextResponse.json({
        ok: true,
        changed: false,
        shop: currentShop,
        entitlement,
        access: describeShopAccess(entitlement),
      });
    }

    const { data: updatedShop, error: updateError } = await admin
      .from("rb_shops")
      .update(patch)
      .eq("id", shopId)
      .select(SHOP_BILLING_SELECT_COLUMNS.join(","))
      .single();

    if (updateError) throw new Error(updateError.message);

    await writeAudit({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: auditAction,
      target_type: "shop",
      target_id: shopId,
      shop_id: shopId,
      meta: {
        ...auditMeta,
        changed_fields: changedFields,
      },
    });

    const entitlement = await getShopEntitlement(shopId);
    return NextResponse.json({
      ok: true,
      changed: true,
      shop: updatedShop,
      entitlement,
      access: describeShopAccess(entitlement),
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);

    if (actorUserId && shopId) {
      try {
        await writeAudit({
          actor_user_id: actorUserId,
          actor_email: actorEmail,
          action: "billing.access.update_failed",
          target_type: "shop",
          target_id: shopId,
          shop_id: shopId,
          meta: {
            requested_action: requestedAction || null,
            error: msg,
          },
        });
      } catch {
      }
    }

    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : /shop not found/i.test(msg) ? 404
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
