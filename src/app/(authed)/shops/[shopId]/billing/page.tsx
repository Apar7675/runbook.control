"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";

type ShopBilling = {
  billing_status: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_override_reason?: string | null;
  billing_current_period_end: string | null;
  billing_amount?: string | number | null;
  billing_interval?: string | null;
  next_billing_date?: string | null;
  manual_billing_status?: string | null;
  grace_ends_at?: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan?: string | null;
  entitlement_override?: string | null;
  manual_billing_override?: boolean | null;
  billing_notes?: string | null;
};

type ShopEntitlement = {
  status:
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "expired"
    | "trial_active"
    | "trial_extended"
    | "trial_ended"
    | "payment_required"
    | "paid_active"
    | "suspended";
  allowed: boolean;
  restricted: boolean;
  reason: string;
  grace_active: boolean;
};

type BillingOk = {
  ok: true;
  shop: ShopBilling;
  entitlement: ShopEntitlement;
  admin?: { is_platform_admin?: boolean };
};
type BillingErr = { ok: false; error?: string };
type BillingResp = BillingOk | BillingErr;

type AdminBillingForm = {
  trial_ends_at: string;
  trial_override_reason: string;
  billing_amount: string;
  billing_interval: string;
  next_billing_date: string;
  manual_billing_status: string;
  manual_billing_override: boolean;
  billing_notes: string;
};

const TRIAL_LABEL = "30-day free trial";
const PRICE_LABEL = "$149 / month";
const EMPTY_VALUE = "-";
const MANUAL_STATUS_OPTIONS = [
  "trial_active",
  "trial_extended",
  "trial_ended",
  "payment_required",
  "paid_active",
  "suspended",
] as const;
const BILLING_INTERVAL_OPTIONS = ["month", "quarter", "year", "custom"] as const;

function formatIsoToLocal(iso: string) {
  try {
    return formatDateTime(iso);
  } catch {
    return iso;
  }
}

function displayValue(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : EMPTY_VALUE;
}

function toDateTimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function buildAdminForm(shop: ShopBilling | null): AdminBillingForm {
  return {
    trial_ends_at: toDateTimeLocalValue(shop?.trial_ends_at),
    trial_override_reason: String(shop?.trial_override_reason ?? ""),
    billing_amount: shop?.billing_amount === null || shop?.billing_amount === undefined ? "" : String(shop.billing_amount),
    billing_interval: String(shop?.billing_interval ?? "month"),
    next_billing_date: toDateTimeLocalValue(shop?.next_billing_date),
    manual_billing_status: String(shop?.manual_billing_status ?? "trial_active"),
    manual_billing_override: Boolean(shop?.manual_billing_override),
    billing_notes: String(shop?.billing_notes ?? ""),
  };
}

export default function ShopBillingPage() {
  const params = useParams();
  const shopId = (params as any)?.shopId as string | undefined;

  const sp = useSearchParams();
  const statusParam = sp.get("status") ?? "";
  const sessionId = sp.get("session_id") ?? "";

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [shop, setShop] = useState<ShopBilling | null>(null);
  const [entitlement, setEntitlement] = useState<ShopEntitlement | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminForm, setAdminForm] = useState<AdminBillingForm>(() => buildAdminForm(null));

  const banner = useMemo(() => {
    if (statusParam === "success") return `Checkout completed. Session: ${displayValue(sessionId)}.`;
    if (statusParam === "cancel") return "Checkout canceled.";
    return "";
  }, [statusParam, sessionId]);

  async function refreshStatus(forceShopId?: string) {
    const id = forceShopId ?? shopId;
    if (!id) {
      setMsg("Missing shopId (route param not ready yet).");
      return;
    }

    setMsg("");
    setLoading(true);

    try {
      const res = await fetch(`/api/billing/shop-status?shop_id=${encodeURIComponent(id)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const maybe = json as any;
        setMsg(`[${res.status}] ${maybe?.error ?? text ?? "Failed to load billing"}`);
        return;
      }

      const j = json as BillingResp | null;
      if (!j) {
        setMsg("Failed to load billing (empty response).");
        return;
      }

      if (j.ok !== true) {
        setMsg(j.error ?? "Failed to load billing");
        return;
      }

      setShop(j.shop);
      setEntitlement(j.entitlement);
      setIsPlatformAdmin(Boolean(j.admin?.is_platform_admin));
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function startCheckout() {
    if (!shopId) return setMsg("Missing shopId.");
    setMsg("");
    setBusy(true);

    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ shop_id: shopId }),
      });

      const text = await res.text();
      let j: any = null;
      try {
        j = text ? JSON.parse(text) : null;
      } catch {}

      if (!res.ok) {
        setMsg(`[${res.status}] ${j?.error ?? text ?? "Failed to create checkout session"}`);
        return;
      }

      if (!j?.ok || !j?.url) {
        setMsg(j?.error ?? "Failed to create checkout session");
        return;
      }

      window.location.href = j.url;
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    if (!shopId) return setMsg("Missing shopId.");
    setMsg("");
    setPortalBusy(true);

    try {
      const res = await fetch("/api/billing/create-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ shop_id: shopId }),
      });

      const text = await res.text();
      let j: any = null;
      try {
        j = text ? JSON.parse(text) : null;
      } catch {}

      if (!res.ok) {
        setMsg(`[${res.status}] ${j?.error ?? text ?? "Failed to open billing portal"}`);
        return;
      }

      if (!j?.ok || !j?.url) {
        setMsg(j?.error ?? "Failed to open billing portal");
        return;
      }

      window.location.href = j.url;
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setPortalBusy(false);
    }
  }

  useEffect(() => {
    if (!shopId) return;
    refreshStatus(shopId);
  }, [shopId]);

  useEffect(() => {
    setAdminForm(buildAdminForm(shop));
  }, [shop]);

  useEffect(() => {
    if (statusParam !== "success") return;
    if (!shopId) return;

    let tries = 0;
    const maxTries = 8;
    const t = setInterval(() => {
      tries++;
      refreshStatus(shopId);
      if (tries >= maxTries) clearInterval(t);
    }, 5000);

    return () => clearInterval(t);
  }, [statusParam, shopId]);

  const periodEndLabel = shop?.billing_current_period_end ? formatIsoToLocal(shop.billing_current_period_end) : EMPTY_VALUE;
  const trialEndsLabel = shop?.trial_ends_at ? formatIsoToLocal(shop.trial_ends_at) : EMPTY_VALUE;
  const nextBillingLabel = shop?.next_billing_date ? formatIsoToLocal(shop.next_billing_date) : EMPTY_VALUE;
  const graceEndsLabel = shop?.grace_ends_at ? formatIsoToLocal(shop.grace_ends_at) : EMPTY_VALUE;
  const canManageBilling = Boolean(shop?.stripe_customer_id);
  const alreadyInTrial = Boolean(entitlement && entitlement.allowed) || Boolean(shop?.stripe_subscription_id);

  async function saveAdminOverrides() {
    if (!shopId) return setMsg("Missing shopId.");
    setMsg("");
    setAdminBusy(true);

    try {
      const res = await fetch("/api/admin/shops/manual-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          shop_id: shopId,
          trial_ends_at: adminForm.trial_ends_at || null,
          trial_override_reason: adminForm.trial_override_reason || null,
          billing_amount: adminForm.billing_amount || null,
          billing_interval: adminForm.billing_interval || null,
          next_billing_date: adminForm.next_billing_date || null,
          manual_billing_status: adminForm.manual_billing_status || null,
          manual_billing_override: adminForm.manual_billing_override,
          billing_notes: adminForm.billing_notes || null,
        }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}

      if (!res.ok) {
        setMsg(`[${res.status}] ${json?.error ?? text ?? "Failed to save manual billing overrides"}`);
        return;
      }

      if (!json?.ok) {
        setMsg(json?.error ?? "Failed to save manual billing overrides");
        return;
      }

      setShop(json.shop ?? null);
      setEntitlement(json.entitlement ?? null);
      setAdminForm(buildAdminForm(json.shop ?? null));
      setMsg(json.changed ? "Manual trial/billing overrides saved." : "No manual billing changes were needed.");
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setAdminBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Billing</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {TRIAL_LABEL} then <b>{PRICE_LABEL}</b>. Card required up-front. Cancel anytime before trial ends to avoid charges. <span style={{ opacity: 0.8 }}>ShopId: <b>{displayValue(shopId)}</b></span>
        </div>
      </div>

      {banner ? (
        <GlassCard title="Status">
          <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>{banner}</div>
        </GlassCard>
      ) : null}

      {msg ? (
        <GlassCard title="Message">
          <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>{msg}</div>
        </GlassCard>
      ) : null}

      <GlassCard title="Billing State">
        {!shop || !entitlement ? (
          <div style={{ opacity: 0.75 }}>{loading ? "Loading..." : "No billing data yet."}</div>
        ) : (
          <div style={{ display: "grid", gap: 8, fontSize: 12, opacity: 0.85 }}>
            <div>Lifecycle: <b>{entitlement.status}</b></div>
            <div>Allowed: <b>{String(entitlement.allowed)}</b></div>
            <div>Restricted: <b>{String(entitlement.restricted)}</b></div>
            <div>Reason: <b>{entitlement.reason}</b></div>
            <div>Grace active: <b>{String(entitlement.grace_active)}</b></div>
            <div>Trial ends: <b>{trialEndsLabel}</b></div>
            <div>Trial override reason: <b>{displayValue(shop.trial_override_reason)}</b></div>
            <div>Manual billing override: <b>{String(Boolean(shop.manual_billing_override))}</b></div>
            <div>Manual billing status: <b>{displayValue(shop.manual_billing_status)}</b></div>
            <div>Billing amount: <b>{displayValue(shop.billing_amount === null || shop.billing_amount === undefined ? null : String(shop.billing_amount))}</b></div>
            <div>Billing interval: <b>{displayValue(shop.billing_interval)}</b></div>
            <div>Next billing date: <b>{nextBillingLabel}</b></div>
            <div>Billing period end: <b>{periodEndLabel}</b></div>
            <div>Grace ends: <b>{graceEndsLabel}</b></div>
            <div>Billing notes: <b>{displayValue(shop.billing_notes)}</b></div>
            <div>Entitlement override: <b>{displayValue(shop.entitlement_override ?? "none")}</b></div>
            <div>Stripe customer: <b>{displayValue(shop.stripe_customer_id)}</b></div>
            <div>Stripe subscription: <b>{displayValue(shop.stripe_subscription_id)}</b></div>
            <div>Subscription plan: <b>{displayValue(shop.subscription_plan)}</b></div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => refreshStatus()}
                disabled={!shopId || loading}
                style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}
              >
                {loading ? "Refreshing..." : "Refresh billing status"}
              </button>

              <button
                onClick={openPortal}
                disabled={!shopId || portalBusy || !canManageBilling}
                style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}
              >
                {portalBusy ? "Opening..." : "Manage billing in Stripe"}
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard title="Subscription">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            You get <b>{TRIAL_LABEL}</b>. After the trial, Stripe charges <b>{PRICE_LABEL}</b> automatically unless you cancel.
          </div>

          {alreadyInTrial ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              This shop already has billing set up. Use the Stripe button above if you need to review or update it.
            </div>
          ) : (
            <button
              onClick={startCheckout}
              disabled={busy || !shopId}
              style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}
            >
              {busy ? "Starting..." : "Start Free Trial (Card Required)"}
            </button>
          )}
        </div>
      </GlassCard>

      {isPlatformAdmin ? (
        <GlassCard title="Admin Manual Overrides">
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              These controls are for internal Control admins only. Changes are written to the shop activity log as <b>billing.override.updated</b>.
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={adminForm.manual_billing_override}
                onChange={(e) => setAdminForm((current) => ({ ...current, manual_billing_override: e.target.checked }))}
              />
              Manual billing override wins over automatic entitlement evaluation.
            </label>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Manual billing status</div>
              <select
                value={adminForm.manual_billing_status}
                onChange={(e) => setAdminForm((current) => ({ ...current, manual_billing_status: e.target.value }))}
                style={{ padding: "10px 12px", borderRadius: 12 }}
              >
                {MANUAL_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Trial ends</span>
                <input
                  type="datetime-local"
                  value={adminForm.trial_ends_at}
                  onChange={(e) => setAdminForm((current) => ({ ...current, trial_ends_at: e.target.value }))}
                  style={{ padding: "10px 12px", borderRadius: 12 }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Next billing date</span>
                <input
                  type="datetime-local"
                  value={adminForm.next_billing_date}
                  onChange={(e) => setAdminForm((current) => ({ ...current, next_billing_date: e.target.value }))}
                  style={{ padding: "10px 12px", borderRadius: 12 }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Billing amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adminForm.billing_amount}
                  onChange={(e) => setAdminForm((current) => ({ ...current, billing_amount: e.target.value }))}
                  style={{ padding: "10px 12px", borderRadius: 12 }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Billing interval</span>
                <select
                  value={adminForm.billing_interval}
                  onChange={(e) => setAdminForm((current) => ({ ...current, billing_interval: e.target.value }))}
                  style={{ padding: "10px 12px", borderRadius: 12 }}
                >
                  {BILLING_INTERVAL_OPTIONS.map((interval) => (
                    <option key={interval} value={interval}>{interval}</option>
                  ))}
                </select>
              </label>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>Trial override reason</span>
              <textarea
                value={adminForm.trial_override_reason}
                onChange={(e) => setAdminForm((current) => ({ ...current, trial_override_reason: e.target.value }))}
                rows={3}
                style={{ padding: "10px 12px", borderRadius: 12, resize: "vertical" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>Internal billing notes</span>
              <textarea
                value={adminForm.billing_notes}
                onChange={(e) => setAdminForm((current) => ({ ...current, billing_notes: e.target.value }))}
                rows={4}
                style={{ padding: "10px 12px", borderRadius: 12, resize: "vertical" }}
              />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={saveAdminOverrides}
                disabled={adminBusy}
                style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}
              >
                {adminBusy ? "Saving..." : "Save Manual Overrides"}
              </button>

              <button
                onClick={() => setAdminForm(buildAdminForm(shop))}
                disabled={adminBusy}
                style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}
              >
                Reset Form
              </button>
            </div>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
