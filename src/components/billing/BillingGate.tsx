"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BillingFeature } from "@/lib/billing/features";
import { safeMode, parseCsv, isWithinGrace, clampGraceDays } from "@/lib/billing/logic";

type ShopBilling = {
  billing_status: string | null;
  billing_current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type BillingOk = { ok: true; shop: ShopBilling };
type BillingErr = { ok: false; error?: string };
type BillingResp = BillingOk | BillingErr;

export type BillingGateMode = "hard" | "soft" | "hybrid";

type BillingAccess = {
  status: string;        // 'trialing' | 'active' | 'grace' | 'past_due' | 'none' | 'loading' | 'unknown'
  isAllowed: boolean;    // allowed to view/use (trialing|active|grace|unlocked)
  isReadOnly: boolean;   // hybrid + !allowed => true
  isBlockedAll: boolean; // hard + !allowed => true
  canWrite: (feature: BillingFeature) => boolean;

  shop?: ShopBilling | null;

  unlocked: boolean;
  reason?: string;
  graceUntilIso?: string;
};

const BillingAccessContext = createContext<BillingAccess | null>(null);

export function useBillingAccess() {
  const v = useContext(BillingAccessContext);
  if (!v) throw new Error("useBillingAccess must be used inside <BillingGate>");
  return v;
}

export function useCanWrite(feature: BillingFeature) {
  const a = useBillingAccess();
  return a.canWrite(feature);
}

export function BillingGate(props: {
  shopId: string;
  children: React.ReactNode;

  mode?: BillingGateMode;          // passed from server layout
  allowDuringLoading?: boolean;    // default true

  // NEW:
  graceDays?: number;              // default 14
  emergencyUnlock?: boolean;       // default false
  unlockShopsCsv?: string;         // default ""
}) {
  const router = useRouter();
  const mode = safeMode(props.mode);

  const graceDays = clampGraceDays(props.graceDays, 14);
  const unlockShops = useMemo(() => parseCsv(props.unlockShopsCsv ?? ""), [props.unlockShopsCsv]);
  const unlocked = !!props.emergencyUnlock || unlockShops.includes(props.shopId);

  const [loading, setLoading] = useState(true);
  const [resp, setResp] = useState<BillingResp | null>(null);

  const access = useMemo<BillingAccess>(() => {
    // Emergency unlock bypasses everything.
    if (unlocked) {
      return {
        status: "unlocked",
        isAllowed: true,
        isReadOnly: false,
        isBlockedAll: false,
        canWrite: () => true,
        shop: (resp as any)?.ok ? (resp as any).shop : null,
        unlocked: true,
        reason: props.emergencyUnlock ? "Emergency unlock enabled" : "Shop allowlist unlock",
      };
    }

    const ok = resp && (resp as any).ok === true;
    const shop = ok ? (resp as BillingOk).shop : null;

    const rawStatus = ok ? (shop?.billing_status ?? "none") : "unknown";
    const status = String(rawStatus || "none").toLowerCase();

    const baseAllowed = status === "trialing" || status === "active";

    // Grace logic: if not allowed but current period end exists, extend for graceDays.
    const grace = !baseAllowed ? isWithinGrace(shop?.billing_current_period_end ?? null, graceDays) : { inGrace: false };
    const inGrace = grace.inGrace;

    const isAllowed = baseAllowed || inGrace;
    const computedStatus = loading ? "loading" : baseAllowed ? status : inGrace ? "grace" : status || "none";

    const isBlockedAll = !loading && mode === "hard" && !isAllowed;
    const isReadOnly = !loading && mode === "hybrid" && !isAllowed;

    const canWrite = (_feature: BillingFeature) => {
      if (mode === "soft") return true;      // soft never blocks actions (overlay only)
      if (mode === "hard") return isAllowed; // hard blocks by redirect / null render
      return isAllowed;                      // hybrid: allow writes only if allowed (includes grace)
    };

    let reason: string | undefined;
    if (!ok && !loading) reason = (resp as BillingErr)?.error ?? "Billing status unavailable";
    else if (inGrace) reason = `Grace until ${grace.graceUntilIso}`;
    else if (!isAllowed && !loading) reason = "Subscription not active";

    return {
      status: computedStatus,
      isAllowed: loading ? true : isAllowed,
      isReadOnly,
      isBlockedAll,
      canWrite,
      shop,
      unlocked: false,
      reason,
      graceUntilIso: grace.graceUntilIso,
    };
  }, [resp, loading, mode, unlocked, graceDays, props.shopId, props.emergencyUnlock]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      try {
        const r = await fetch(`/api/billing/shop-status?shop_id=${encodeURIComponent(props.shopId)}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        const text = await r.text();
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch {}

        if (!alive) return;

        if (!r.ok) {
          setResp({ ok: false, error: json?.error ?? text ?? `HTTP ${r.status}` });
          return;
        }

        setResp(json as BillingResp);
      } catch (e: any) {
        if (!alive) return;
        setResp({ ok: false, error: e?.message ?? String(e) });
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => { alive = false; };
  }, [props.shopId]);

  // HARD mode: redirect if not allowed
  useEffect(() => {
    if (mode !== "hard") return;
    if (loading) return;
    if (access.isAllowed) return;

    router.replace(`/shops/${props.shopId}/billing`);
  }, [mode, loading, access.isAllowed, props.shopId, router]);

  // During loading, allow rendering to reduce flicker unless explicitly disabled
  if (loading && (props.allowDuringLoading ?? true)) {
    return (
      <BillingAccessContext.Provider
        value={{
          status: "loading",
          isAllowed: true,
          isReadOnly: false,
          isBlockedAll: false,
          canWrite: () => true,
          shop: null,
          unlocked,
          reason: "Loading",
        }}
      >
        {props.children}
      </BillingAccessContext.Provider>
    );
  }

  // Hard mode + not allowed -> render nothing (redirect will happen)
  if (mode === "hard" && !access.isAllowed) return null;

  // Soft mode -> overlay paywall
  if (mode === "soft" && !access.isAllowed) {
    return (
      <BillingAccessContext.Provider value={access}>
        <div style={{ position: "relative" }}>
          <div style={{ filter: "blur(2px)", opacity: 0.35, pointerEvents: "none" }}>
            {props.children}
          </div>

          <PaywallOverlay
            title="Subscription required"
            subtitle="Start your free trial or manage billing to regain access."
            shopId={props.shopId}
          />
        </div>
      </BillingAccessContext.Provider>
    );
  }

  // Hybrid mode -> allow view, block writes via canWrite(feature)
  return <BillingAccessContext.Provider value={access}>{props.children}</BillingAccessContext.Provider>;
}

function PaywallOverlay(props: { title: string; subtitle: string; shopId: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 18 }}>
      <div
        style={{
          width: "min(640px, 100%)",
          borderRadius: 16,
          padding: 18,
          background: "rgba(10,12,20,0.85)",
          border: "1px solid rgba(120,130,170,0.25)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900 }}>{props.title}</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{props.subtitle}</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <a
            href={`/shops/${props.shopId}/billing`}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 900,
              textDecoration: "none",
              background: "rgba(110,120,255,0.25)",
              border: "1px solid rgba(140,150,255,0.35)",
              color: "inherit",
            }}
          >
            Go to Billing
          </a>

          <a
            href={`/shops/${props.shopId}/billing`}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 900,
              textDecoration: "none",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "inherit",
            }}
          >
            Start / Manage Trial
          </a>
        </div>
      </div>
    </div>
  );
}
