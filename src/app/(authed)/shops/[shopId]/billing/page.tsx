"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ActionLink, DataList, NoteList, PageHeader, SectionBlock, StatusBadge, toneFromStatus } from "@/components/control/ui";
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
    if (statusParam !== "success" || !shopId) return;
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
    <div className="rb-page">
      <PageHeader eyebrow="Billing" title="Billing" description={`${TRIAL_LABEL} then ${PRICE_LABEL}. Card required up-front. Cancel anytime before trial ends to avoid charges.`} actions={<><ActionLink href={`/shops/${shopId}`}>Back to Shop</ActionLink><ActionLink href={`/shops/${shopId}/devices`}>Devices</ActionLink></>} />

      {banner ? <SectionBlock title="Status" description="Checkout and billing events surface here first." tone="subtle"><div className="rb-pageCopy">{banner}</div></SectionBlock> : null}
      {msg ? <SectionBlock title="Message" description="Billing status and checkout feedback." tone="warning"><div className="rb-pageCopy">{msg}</div></SectionBlock> : null}

      <SectionBlock title="Billing State" description="Lifecycle status, entitlement, and Stripe linkage in one consistent readout.">
        {!shop || !entitlement ? (
          <div className="rb-fine">{loading ? "Loading..." : "No billing data yet."}</div>
        ) : (
          <div className="rb-stack">
            <div className="rb-chipRow">
              <StatusBadge label={entitlement.status} tone={toneFromStatus(entitlement.status)} />
              <StatusBadge label={entitlement.restricted ? "Restricted" : "Allowed"} tone={entitlement.restricted ? "critical" : "healthy"} />
              <StatusBadge label={shop.billing_status ?? "unknown"} tone={toneFromStatus(shop.billing_status ?? "")} />
            </div>
            <div className="rb-statStrip">
              <div className="rb-statCell"><div className="rb-statCell__label">Trial Ends</div><div className="rb-statCell__value" style={{ fontSize: 18 }}>{trialEndsLabel}</div></div>
              <div className="rb-statCell"><div className="rb-statCell__label">Period End</div><div className="rb-statCell__value" style={{ fontSize: 18 }}>{periodEndLabel}</div></div>
              <div className="rb-statCell"><div className="rb-statCell__label">Grace Ends</div><div className="rb-statCell__value" style={{ fontSize: 18 }}>{graceEndsLabel}</div></div>
            </div>
            <DataList
              items={[
                { label: "Allowed", value: String(entitlement.allowed) },
                { label: "Restricted", value: String(entitlement.restricted) },
                { label: "Reason", value: entitlement.reason },
                { label: "Grace Active", value: String(entitlement.grace_active) },
                { label: "Entitlement Override", value: displayValue(shop.entitlement_override ?? "none") },
                { label: "Stripe Customer", value: displayValue(shop.stripe_customer_id) },
                { label: "Stripe Subscription", value: displayValue(shop.stripe_subscription_id) },
                { label: "Subscription Plan", value: displayValue(shop.subscription_plan) },
              ]}
            />
            <div className="rb-inlineRow">
              <button onClick={() => refreshStatus()} disabled={!shopId || loading} className="rb-button">{loading ? "Refreshing..." : "Refresh billing status"}</button>
              <button onClick={openPortal} disabled={!shopId || portalBusy || !canManageBilling} className="rb-button">{portalBusy ? "Opening..." : "Manage billing in Stripe"}</button>
            </div>
          </div>
        )}
      </SectionBlock>

      <SectionBlock title="Subscription" description="Trial and conversion actions remain direct and easy to scan.">
        <div className="rb-stack">
          <div className="rb-pageCopy">You get <strong>{TRIAL_LABEL}</strong>. After the trial, Stripe charges <strong>{PRICE_LABEL}</strong> automatically unless you cancel.</div>
          {alreadyInTrial ? (
            <NoteList items={["This shop already has billing set up.", "Use the Stripe button above if you need to review or update it."]} />
          ) : (
            <button onClick={startCheckout} disabled={busy || !shopId} className="rb-button rb-button--primary">{busy ? "Starting..." : "Start Free Trial (Card Required)"}</button>
          )}
        </div>
      </SectionBlock>
    </div>
  );
}
