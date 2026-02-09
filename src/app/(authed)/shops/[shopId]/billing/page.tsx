"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import GlassCard from "@/components/GlassCard";

export const dynamic = "force-dynamic";

type ShopBilling = {
  billing_status: string | null;
  billing_current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type BillingOk = { ok: true; shop: ShopBilling };
type BillingErr = { ok: false; error?: string };
type BillingResp = BillingOk | BillingErr;

export default function ShopBillingPage() {
  const params = useParams();
  const shopId = (params as any)?.shopId as string | undefined;

  const sp = useSearchParams();
  const statusParam = sp.get("status") ?? "";
  const sessionId = sp.get("session_id") ?? "";

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [shop, setShop] = useState<ShopBilling | null>(null);

  const banner = useMemo(() => {
    if (statusParam === "success") return `Checkout completed. Session: ${sessionId || "—"}.`;
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

  useEffect(() => {
    if (!shopId) return;
    refreshStatus(shopId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Billing</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Shop-scoped billing (Stripe Test Mode).{" "}
          <span style={{ opacity: 0.8 }}>
            ShopId: <b>{shopId ?? "—"}</b>
          </span>
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
        {!shop ? (
          <div style={{ opacity: 0.75 }}>{loading ? "Loading…" : "No billing data yet."}</div>
        ) : (
          <div style={{ display: "grid", gap: 8, fontSize: 12, opacity: 0.85 }}>
            <div>
              Status: <b>{shop.billing_status ?? "none"}</b>
            </div>
            <div>
              Period end: <b>{shop.billing_current_period_end ?? "—"}</b>
            </div>
            <div>
              Stripe customer: <b>{shop.stripe_customer_id ?? "—"}</b>
            </div>
            <div>
              Stripe subscription: <b>{shop.stripe_subscription_id ?? "—"}</b>
            </div>

            <button
              onClick={() => refreshStatus()}
              disabled={!shopId || loading}
              style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}
            >
              {loading ? "Refreshing…" : "Refresh billing status"}
            </button>
          </div>
        )}
      </GlassCard>

      <GlassCard title="Subscription">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Plan: <b>$149 / month</b> (test price)
          </div>

          <button
            onClick={startCheckout}
            disabled={busy || !shopId}
            style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, width: "fit-content" }}
          >
            {busy ? "Starting…" : "Start Subscription (Test)"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            After checkout completes, your webhook (or manual sync) should update <b>rb_shops</b>.
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
