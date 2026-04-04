"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BillingFeature } from "@/lib/billing/features";
import { safeMode, parseCsv, clampGraceDays } from "@/lib/billing/logic";

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

type ShopAccess = {
  state: "trialing" | "active" | "grace" | "restricted" | "expired";
  display_status: "Free Trial" | "Active" | "Payment Needed" | "Restricted" | "Expired";
  summary: string;
  reason: string;
  desktop_mode: "full" | "read_only" | "blocked";
  mobile_mode: "full" | "queue_only" | "blocked";
  workstation_mode: "full" | "blocked";
};

type BillingOk = { ok: true; shop: ShopBilling; entitlement: ShopEntitlement; access: ShopAccess };

type BillingErr = { ok: false; error?: string };
type BillingResp = BillingOk | BillingErr;

export type BillingGateMode = "hard" | "soft" | "hybrid";

type BillingAccess = {
  status: string;
  isAllowed: boolean;
  isReadOnly: boolean;
  isBlockedAll: boolean;
  canWrite: (feature: BillingFeature) => boolean;
  shop?: ShopBilling | null;
  entitlement?: ShopEntitlement | null;
  access?: ShopAccess | null;
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
  mode?: BillingGateMode;
  allowDuringLoading?: boolean;
  graceDays?: number;
  emergencyUnlock?: boolean;
  unlockShopsCsv?: string;
}) {
  const router = useRouter();
  const mode = safeMode(props.mode);
  clampGraceDays(props.graceDays, 14);
  const unlockShops = useMemo(() => parseCsv(props.unlockShopsCsv ?? ""), [props.unlockShopsCsv]);
  const unlocked = !!props.emergencyUnlock || unlockShops.includes(props.shopId);

  const [loading, setLoading] = useState(true);
  const [resp, setResp] = useState<BillingResp | null>(null);

  const access = useMemo<BillingAccess>(() => {
    if (unlocked) {
      return {
        status: "unlocked",
        isAllowed: true,
        isReadOnly: false,
        isBlockedAll: false,
        canWrite: () => true,
        shop: (resp as any)?.ok ? (resp as any).shop : null,
        entitlement: (resp as any)?.ok ? (resp as any).entitlement : null,
        access: (resp as any)?.ok ? (resp as any).access : null,
        unlocked: true,
        reason: props.emergencyUnlock ? "Emergency unlock enabled" : "Shop allowlist unlock",
      };
    }

    const ok = resp && (resp as any).ok === true;
    const shop = ok ? (resp as BillingOk).shop : null;
    const entitlement = ok ? (resp as BillingOk).entitlement : null;
    const access = ok ? (resp as BillingOk).access : null;

    const computedStatus = loading ? "loading" : access?.display_status ?? entitlement?.status ?? "unknown";
    const isAllowed = !!entitlement?.allowed;
    const isRestricted = !!entitlement?.restricted;
    const isFullAccess = isAllowed && !isRestricted;
    const isRestrictedMode = !isAllowed && isRestricted;
    const isBlockedMode = !isAllowed && !isRestricted;
    const isBlockedAll = !loading && isBlockedMode;
    const isReadOnly = !loading && isRestrictedMode;

    const canWrite = (_feature: BillingFeature) => {
      if (mode === "soft") return isFullAccess;
      if (mode === "hard") return isFullAccess;
      return isFullAccess;
    };

    let reason: string | undefined;
    if (!ok && !loading) reason = (resp as BillingErr)?.error ?? "Billing status unavailable";
    else if (entitlement) reason = entitlement.reason;

    return {
      status: computedStatus,
      isAllowed: loading ? true : isFullAccess,
      isReadOnly,
      isBlockedAll,
      canWrite,
      shop,
      entitlement,
      access,
      unlocked: false,
      reason,
      graceUntilIso: shop?.grace_ends_at ?? undefined,
    };
  }, [resp, loading, mode, unlocked, props.emergencyUnlock]);

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

  useEffect(() => {
    if (mode !== "hard") return;
    if (loading) return;
    if (access.isAllowed || access.isReadOnly) return;

    router.replace(`/shops/${props.shopId}/billing`);
  }, [mode, loading, access.isAllowed, access.isReadOnly, props.shopId, router]);

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
          entitlement: null,
          access: null,
          unlocked,
          reason: "Loading",
        }}
      >
        {props.children}
      </BillingAccessContext.Provider>
    );
  }

  if (mode === "hard" && access.isBlockedAll) return null;

  if ((mode === "soft" || mode === "hard") && access.isReadOnly) {
    return (
      <BillingAccessContext.Provider value={access}>
        <div style={{ position: "relative" }}>
          <div style={{ filter: "blur(2px)", opacity: 0.35, pointerEvents: "none" }}>
            {props.children}
          </div>

          <PaywallOverlay
            title={access.access?.display_status ?? "Restricted"}
            subtitle={access.access?.summary ?? "Billing needs attention. You can review billing details, but write actions are disabled until billing is restored."}
            shopId={props.shopId}
          />
        </div>
      </BillingAccessContext.Provider>
    );
  }

  if (mode === "soft" && access.isBlockedAll) {
    return (
      <BillingAccessContext.Provider value={access}>
        <div style={{ position: "relative" }}>
          <div style={{ filter: "blur(2px)", opacity: 0.35, pointerEvents: "none" }}>
            {props.children}
          </div>

          <PaywallOverlay
            title={access.access?.display_status ?? "Expired"}
            subtitle={access.access?.summary ?? "Start your free trial or manage billing to regain access."}
            shopId={props.shopId}
          />
        </div>
      </BillingAccessContext.Provider>
    );
  }

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
