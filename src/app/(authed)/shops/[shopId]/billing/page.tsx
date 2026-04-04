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
  billing_current_period_end: string | null;
  grace_ends_at?: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan?: string | null;
  entitlement_override?: string | null;
};

type ShopEntitlement = {
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  allowed: boolean;
  restricted: boolean;
  reason: string;
  grace_active: boolean;
};

type BillingOk = { ok: true; shop: ShopBilling; entitlement: ShopEntitlement };
type BillingErr = { ok: false; error?: string };
type BillingResp = BillingOk | BillingErr;

const TRIAL_LABEL = "30-day free trial";
const PRICE_LABEL = "$149 / month";
const EMPTY_VALUE = "-";

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
  const graceEndsLabel = shop?.grace_ends_at ? formatIsoToLocal(shop.grace_ends_at) : EMPTY_VALUE;
  const canManageBilling = Boolean(shop?.stripe_customer_id);
  const alreadyInTrial = entitlement?.status === "trialing" || entitlement?.status === "active";

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
            <div>Billing period end: <b>{periodEndLabel}</b></div>
            <div>Grace ends: <b>{graceEndsLabel}</b></div>
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
    </div>
  );
}
