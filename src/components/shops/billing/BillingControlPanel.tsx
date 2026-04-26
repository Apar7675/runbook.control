"use client";

import React from "react";
import { safeFetch } from "@/lib/http/safeFetch";
import BillingSummaryCard from "@/components/shops/billing/BillingSummaryCard";
import BillingAccessOverrideCard from "@/components/shops/billing/BillingAccessOverrideCard";
import BillingStripeControlsCard from "@/components/shops/billing/BillingStripeControlsCard";
import BillingActivityCard from "@/components/shops/billing/BillingActivityCard";
import { theme } from "@/lib/ui/theme";

type BillingSnapshot = {
  shop: {
    billing_status: string | null;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
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
  };
  entitlement: {
    status: string;
    allowed: boolean;
    restricted: boolean;
    reason: string;
    grace_active: boolean;
  };
  access: {
    display_status: string;
    summary: string;
    desktop_mode: string;
    mobile_mode: string;
    workstation_mode: string;
  };
};

type BillingStatusResponse =
  | ({ ok: true; admin?: { is_platform_admin?: boolean } } & BillingSnapshot)
  | { ok: false; error?: string };

type BillingActivityRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  meta: Record<string, any>;
};

type BillingActivityResponse =
  | { ok: true; rows: BillingActivityRow[] }
  | { ok: false; error?: string };

type BillingMutationResponse =
  | ({ ok: true; changed?: boolean } & BillingSnapshot)
  | { ok: false; error?: string };

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function isBillingStatusSuccess(data: BillingStatusResponse): data is Extract<BillingStatusResponse, { ok: true }> {
  return data.ok === true;
}

function isBillingActivitySuccess(data: BillingActivityResponse): data is Extract<BillingActivityResponse, { ok: true }> {
  return data.ok === true;
}

function isBillingMutationSuccess(data: BillingMutationResponse): data is Extract<BillingMutationResponse, { ok: true }> {
  return data.ok === true;
}

export default function BillingControlPanel({
  shopId,
  shopName,
}: {
  shopId: string;
  shopName: string;
}) {
  const [snapshot, setSnapshot] = React.useState<BillingSnapshot | null>(null);
  const [activity, setActivity] = React.useState<BillingActivityRow[]>([]);
  const [loadingStatus, setLoadingStatus] = React.useState(true);
  const [loadingActivity, setLoadingActivity] = React.useState(true);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [accessMessage, setAccessMessage] = React.useState("");
  const [stripeMessage, setStripeMessage] = React.useState("");
  const [accessBusy, setAccessBusy] = React.useState(false);
  const [syncBusy, setSyncBusy] = React.useState(false);
  const [portalBusy, setPortalBusy] = React.useState(false);
  const [checkoutBusy, setCheckoutBusy] = React.useState(false);

  async function loadStatus() {
    setLoadingStatus(true);
    const response = await safeFetch<BillingStatusResponse>(`/api/billing/shop-status?shop_id=${encodeURIComponent(shopId)}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !isBillingStatusSuccess(response.data)) {
      setStatusMessage(response.ok ? (response.data as any)?.error ?? "Could not load billing state." : `${response.status}: ${response.error}`);
      setLoadingStatus(false);
      return;
    }

    setSnapshot({
      shop: response.data.shop,
      entitlement: response.data.entitlement,
      access: response.data.access,
    });
    setStatusMessage("");
    setLoadingStatus(false);
  }

  async function loadActivity() {
    setLoadingActivity(true);
    const response = await safeFetch<BillingActivityResponse>(`/api/shops/billing-activity?shop_id=${encodeURIComponent(shopId)}&limit=12`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !isBillingActivitySuccess(response.data)) {
      setActivity([]);
      setLoadingActivity(false);
      return;
    }

    setActivity(response.data.rows ?? []);
    setLoadingActivity(false);
  }

  async function refreshAll() {
    await Promise.all([loadStatus(), loadActivity()]);
  }

  React.useEffect(() => {
    void refreshAll();
  }, [shopId]);

  async function runAccessAction(payload: {
    action: "extend_trial" | "extend_grace" | "set_entitlement_override" | "clear_overrides";
    days?: number;
    override?: "allow" | "restricted" | null;
    note: string;
  }) {
    setAccessBusy(true);
    setAccessMessage("");

    try {
      const response = await fetch("/api/admin/shops/billing-access", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ shop_id: shopId, ...payload }),
      });

      const json = await parseJsonResponse<BillingMutationResponse>(response);
      if (!response.ok || !json || !isBillingMutationSuccess(json)) {
        setAccessMessage((json as any)?.error ?? `Access update failed (${response.status}).`);
        return;
      }

      setSnapshot({
        shop: json.shop,
        entitlement: json.entitlement,
        access: json.access,
      });
      setAccessMessage((json as any).changed ? "Access override updated." : "No access changes were needed.");
      await loadActivity();
    } catch (e: any) {
      setAccessMessage(e?.message ?? String(e));
    } finally {
      setAccessBusy(false);
    }
  }

  async function runStripeSync() {
    setSyncBusy(true);
    setStripeMessage("");

    try {
      const response = await fetch("/api/admin/shops/billing-stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ shop_id: shopId, action: "sync" }),
      });

      const json = await parseJsonResponse<BillingMutationResponse>(response);
      if (!response.ok || !json || !isBillingMutationSuccess(json)) {
        setStripeMessage((json as any)?.error ?? `Stripe sync failed (${response.status}).`);
        return;
      }

      setSnapshot({
        shop: json.shop,
        entitlement: json.entitlement,
        access: json.access,
      });
      setStripeMessage("Stripe state synced into Control.");
      await loadActivity();
    } catch (e: any) {
      setStripeMessage(e?.message ?? String(e));
    } finally {
      setSyncBusy(false);
    }
  }

  async function openPortal() {
    setPortalBusy(true);
    setStripeMessage("");

    try {
      const response = await fetch("/api/billing/create-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ shop_id: shopId }),
      });

      const json = await parseJsonResponse<{ ok?: boolean; url?: string; error?: string }>(response);
      if (!response.ok || !json?.ok || !json.url) {
        setStripeMessage(json?.error ?? `Could not open Stripe portal (${response.status}).`);
        return;
      }

      window.location.href = json.url;
    } catch (e: any) {
      setStripeMessage(e?.message ?? String(e));
    } finally {
      setPortalBusy(false);
    }
  }

  async function startCheckout() {
    setCheckoutBusy(true);
    setStripeMessage("");

    try {
      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ shop_id: shopId }),
      });

      const json = await parseJsonResponse<{ ok?: boolean; url?: string; error?: string }>(response);
      if (!response.ok || !json?.ok || !json.url) {
        setStripeMessage(json?.error ?? `Could not start Stripe checkout (${response.status}).`);
        return;
      }

      window.location.href = json.url;
    } catch (e: any) {
      setStripeMessage(e?.message ?? String(e));
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {statusMessage ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 16,
            border: theme.border.warning,
            background: theme.bg.panelWarning,
            color: theme.text.primary,
            fontSize: 13,
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      <BillingSummaryCard snapshot={snapshot} loading={loadingStatus} onRefresh={loadStatus} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)", gap: 16 }}>
        <BillingAccessOverrideCard snapshot={snapshot} busy={accessBusy} message={accessMessage} onAction={runAccessAction} />
        <BillingStripeControlsCard
          snapshot={snapshot}
          syncBusy={syncBusy}
          portalBusy={portalBusy}
          checkoutBusy={checkoutBusy}
          message={stripeMessage}
          onSync={runStripeSync}
          onOpenPortal={openPortal}
          onStartCheckout={startCheckout}
        />
      </div>

      <BillingActivityCard rows={activity} loading={loadingActivity} onRefresh={loadActivity} />

      <div style={{ fontSize: 12, color: theme.text.quiet }}>
        Billing support for <strong>{shopName}</strong> is read from server routes only. Access overrides and Stripe actions are intentionally separated so the panel never implies a Stripe change when only Control access was changed.
      </div>
    </div>
  );
}
