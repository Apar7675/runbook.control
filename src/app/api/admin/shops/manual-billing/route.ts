import { NextResponse } from "next/server";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { writeAudit } from "@/lib/audit/writeAudit";
import {
  normalizeBillingInterval,
  normalizeRuntimeBillingStatus,
  toIsoOrNull,
  SHOP_BILLING_SELECT_COLUMNS,
} from "@/lib/billing/manual";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { describeShopAccess } from "@/lib/billing/access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function textOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function numberOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) throw new Error("billing_amount must be a non-negative number.");
  return Number(num.toFixed(2));
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export async function POST(req: Request) {
  try {
    const { user } = await requirePlatformAdminAal2();
    const body = await req.json().catch(() => ({}));

    const shopId = String((body as any).shop_id ?? "").trim();
    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    assertUuid("shop_id", shopId);

    const manualBillingOverride = Boolean((body as any).manual_billing_override);
    const trialEndsAt = toIsoOrNull((body as any).trial_ends_at);
    const trialOverrideReason = textOrNull((body as any).trial_override_reason);
    const billingAmount = numberOrNull((body as any).billing_amount);
    const billingInterval = textOrNull((body as any).billing_interval)
      ? normalizeBillingInterval((body as any).billing_interval)
      : null;
    const nextBillingDate = toIsoOrNull((body as any).next_billing_date);
    const manualBillingStatus = manualBillingOverride
      ? normalizeRuntimeBillingStatus((body as any).manual_billing_status)
      : null;
    const billingNotes = textOrNull((body as any).billing_notes);

    if (manualBillingOverride && !textOrNull((body as any).manual_billing_status)) {
      return NextResponse.json({ ok: false, error: "Select a manual billing status." }, { status: 400 });
    }

    if (manualBillingOverride && !billingNotes && !trialOverrideReason) {
      return NextResponse.json(
        { ok: false, error: "Add an internal note or trial override reason before saving a manual override." },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();
    const { data: currentShopRaw, error: currentErr } = await admin
      .from("rb_shops")
      .select(SHOP_BILLING_SELECT_COLUMNS.join(","))
      .eq("id", shopId)
      .maybeSingle();

    if (currentErr) throw new Error(currentErr.message);
    const currentShop = currentShopRaw as any;
    if (!currentShop?.id) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

    const patch = {
      trial_ends_at: trialEndsAt,
      trial_override_reason: trialOverrideReason,
      billing_amount: billingAmount,
      billing_interval: billingInterval,
      next_billing_date: nextBillingDate,
      manual_billing_status: manualBillingStatus,
      manual_billing_override: manualBillingOverride,
      billing_notes: billingNotes,
    };

    const changedFields = Object.entries(patch)
      .filter(([key, value]) => !sameValue((currentShop as any)[key], value))
      .map(([key, value]) => ({
        field: key,
        before: (currentShop as any)[key] ?? null,
        after: value ?? null,
      }));

    if (
      changedFields.some((field) => field.field === "trial_ends_at") &&
      !trialOverrideReason
    ) {
      return NextResponse.json({ ok: false, error: "Add a trial override reason when changing the trial end date." }, { status: 400 });
    }

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

    const { data: updatedShopRaw, error: updateErr } = await admin
      .from("rb_shops")
      .update(patch)
      .eq("id", shopId)
      .select(SHOP_BILLING_SELECT_COLUMNS.join(","))
      .single();

    if (updateErr) throw new Error(updateErr.message);
    const updatedShop = updatedShopRaw as any;

    await writeAudit({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "billing.override.updated",
      target_type: "shop",
      target_id: shopId,
      shop_id: shopId,
      meta: {
        changed_fields: changedFields,
        manual_billing_override: manualBillingOverride,
        manual_billing_status: manualBillingStatus,
        billing_notes: billingNotes,
        trial_override_reason: trialOverrideReason,
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
    const status =
      /not authenticated/i.test(msg) ? 401
      : /mfa required/i.test(msg) ? 403
      : /not a platform admin/i.test(msg) ? 403
      : /must be a uuid/i.test(msg) ? 400
      : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
