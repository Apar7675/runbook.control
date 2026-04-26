"use client";

import React from "react";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import ControlPanelV2 from "@/components/control/v2/ControlPanelV2";
import { ControlActionButtonV2 } from "@/components/control/v2/ControlActionButtonV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import { ControlTableV2, ControlTableCellV2, ControlTableHeadCellV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";

type BillingSnapshot = {
  shop: {
    billing_status: string | null;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
    billing_current_period_end: string | null;
    billing_amount?: string | number | null;
    billing_interval?: string | null;
    grace_ends_at?: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_plan?: string | null;
    entitlement_override?: string | null;
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
  };
};

type BillingStatusResponse = ({ ok: true } & BillingSnapshot) | { ok: false; error?: string };
type BillingActivityRow = { id: string; created_at: string; actor_email: string | null; action: string; meta: Record<string, any> };
type BillingActivityResponse = { ok: true; rows: BillingActivityRow[] } | { ok: false; error?: string };
type BillingMutationResponse = ({ ok: true; changed?: boolean } & BillingSnapshot) | { ok: false; error?: string };

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function summaryCell(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: "grid", gap: 4, padding: "10px 12px", border: `1px solid ${t.color.border}`, borderRadius: t.radius.md, background: t.color.surface }}>
      <div style={{ color: t.color.textQuiet, ...t.type.label }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.color.textMuted, lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function labelValue(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ color: t.color.textQuiet, ...t.type.label }}>{label}</div>
      <div style={{ fontSize: 12.5, color: t.color.textMuted, lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

function honestDisabled(label: string, detail: string) {
  return (
    <div style={{ display: "grid", gap: 4, padding: "10px 0", borderTop: `1px solid ${t.color.border}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled
          style={{
            minHeight: 30,
            padding: "5px 9px",
            borderRadius: t.radius.sm,
            border: `1px solid ${t.color.border}`,
            background: t.color.surfaceMuted,
            color: t.color.textQuiet,
            fontSize: 12,
            fontWeight: 700,
            opacity: 0.66,
          }}
        >
          {label}
        </button>
        <span style={{ fontSize: 12, color: t.color.textQuiet }}>{detail}</span>
      </div>
    </div>
  );
}

export default function BillingTabV2({ shopId }: { shopId: string }) {
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
  const [customTrialDays, setCustomTrialDays] = React.useState("30");
  const [customGraceDays, setCustomGraceDays] = React.useState("7");
  const [overrideValue, setOverrideValue] = React.useState<"allow" | "restricted">("allow");

  async function loadStatus() {
    setLoadingStatus(true);
    const response = await safeFetch<BillingStatusResponse>(`/api/billing/shop-status?shop_id=${encodeURIComponent(shopId)}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setStatusMessage(response.ok ? (response.data as any)?.error ?? "Could not load billing state." : `${response.status}: ${response.error}`);
      setLoadingStatus(false);
      return;
    }

    setSnapshot({
      shop: (response.data as any).shop,
      entitlement: (response.data as any).entitlement,
      access: (response.data as any).access,
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
    if (!response.ok || !(response.data as any)?.ok) {
      setActivity([]);
      setLoadingActivity(false);
      return;
    }
    setActivity((response.data as any).rows ?? []);
    setLoadingActivity(false);
  }

  React.useEffect(() => {
    void Promise.all([loadStatus(), loadActivity()]);
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
      if (!response.ok || !json || !(json as any).ok) {
        setAccessMessage((json as any)?.error ?? `Access update failed (${response.status}).`);
        return;
      }
      setSnapshot({
        shop: (json as any).shop,
        entitlement: (json as any).entitlement,
        access: (json as any).access,
      });
      setAccessMessage((json as any).changed ? "Access state updated." : "No access changes were needed.");
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
      if (!response.ok || !json || !(json as any).ok) {
        setStripeMessage((json as any)?.error ?? `Stripe sync failed (${response.status}).`);
        return;
      }
      setSnapshot({
        shop: (json as any).shop,
        entitlement: (json as any).entitlement,
        access: (json as any).access,
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
    <div style={{ display: "grid", gap: 12 }}>
      {statusMessage ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>{statusMessage}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        {summaryCell("Plan", snapshot?.shop.subscription_plan ?? "Unknown")}
        {summaryCell("Subscription", snapshot?.shop.billing_status ? <ControlBadgeV2 label={snapshot.shop.billing_status.replace(/_/g, " ")} tone={toneFromStatusV2(snapshot.shop.billing_status)} /> : "Unknown")}
        {summaryCell("Access", snapshot?.access.display_status ?? "Loading")}
        {summaryCell("Override", snapshot?.shop.entitlement_override ?? "None")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 14 }}>
        <ControlPanelV2 title="Access / entitlement override" description="These controls change Control access state. They do not pretend to be Stripe mutations.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {labelValue("Entitlement reason", snapshot?.entitlement.reason ?? "Loading")}
            {labelValue("Trial end", snapshot?.shop.trial_ends_at ? formatDateTime(snapshot.shop.trial_ends_at) : "Not set")}
            {labelValue("Grace end", snapshot?.shop.grace_ends_at ? formatDateTime(snapshot.shop.grace_ends_at) : "Not set")}
            {labelValue("Manual override", snapshot?.shop.entitlement_override ?? "None")}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ControlActionButtonV2 onClick={() => void runAccessAction({ action: "extend_trial", days: 30, note: "Extended trial by 30 days from billing workspace." })} disabled={accessBusy || loadingStatus}>+30 days</ControlActionButtonV2>
            <ControlActionButtonV2 onClick={() => void runAccessAction({ action: "extend_trial", days: 60, note: "Extended trial by 60 days from billing workspace." })} disabled={accessBusy || loadingStatus}>+60 days</ControlActionButtonV2>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ControlInputV2 value={customTrialDays} onChange={(e) => setCustomTrialDays(e.target.value)} placeholder="Custom trial days" style={{ maxWidth: 140 }} />
            <ControlActionButtonV2
              onClick={() => void runAccessAction({ action: "extend_trial", days: Number(customTrialDays), note: `Extended trial by ${customTrialDays} days from billing workspace.` })}
              disabled={accessBusy || !Number.isFinite(Number(customTrialDays)) || Number(customTrialDays) <= 0}
            >
              Extend trial
            </ControlActionButtonV2>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ControlInputV2 value={customGraceDays} onChange={(e) => setCustomGraceDays(e.target.value)} placeholder="Grace days" style={{ maxWidth: 140 }} />
            <ControlActionButtonV2
              onClick={() => void runAccessAction({ action: "extend_grace", days: Number(customGraceDays), note: `Extended grace by ${customGraceDays} days from billing workspace.` })}
              disabled={accessBusy || !Number.isFinite(Number(customGraceDays)) || Number(customGraceDays) <= 0}
            >
              Add grace
            </ControlActionButtonV2>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ControlSelectV2 value={overrideValue} onChange={(e) => setOverrideValue(e.target.value as "allow" | "restricted")} style={{ maxWidth: 180 }}>
              <option value="allow">Manual allow</option>
              <option value="restricted">Manual restrict</option>
            </ControlSelectV2>
            <ControlActionButtonV2 onClick={() => void runAccessAction({ action: "set_entitlement_override", override: overrideValue, note: `Set entitlement override to ${overrideValue} from billing workspace.` })} disabled={accessBusy}>
              Apply override
            </ControlActionButtonV2>
            <ControlActionButtonV2 onClick={() => void runAccessAction({ action: "clear_overrides", note: "Cleared billing overrides from billing workspace." })} disabled={accessBusy}>
              Clear override
            </ControlActionButtonV2>
          </div>

          {accessMessage ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>{accessMessage}</div> : null}
        </ControlPanelV2>

        <ControlPanelV2 title="Stripe / subscription" description="Only actions with real backend support are enabled here. Unsupported Stripe mutations stay visibly disabled.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {labelValue("Customer", snapshot?.shop.stripe_customer_id ?? "Not connected")}
            {labelValue("Subscription", snapshot?.shop.stripe_subscription_id ?? "Not connected")}
            {labelValue("Monthly amount", snapshot?.shop.billing_amount ? `$${snapshot.shop.billing_amount}/${snapshot.shop.billing_interval ?? "month"}` : "Not available")}
            {labelValue("Current period end", snapshot?.shop.billing_current_period_end ? formatDateTime(snapshot.shop.billing_current_period_end) : "Not set")}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ControlActionButtonV2 onClick={() => void runStripeSync()} disabled={syncBusy}>{syncBusy ? "Syncing..." : "Sync billing"}</ControlActionButtonV2>
            <ControlActionButtonV2 onClick={() => void openPortal()} disabled={portalBusy || !snapshot?.shop.stripe_customer_id}>{portalBusy ? "Opening..." : "Open portal"}</ControlActionButtonV2>
            <ControlActionButtonV2 onClick={() => void startCheckout()} disabled={checkoutBusy || !!snapshot?.shop.stripe_subscription_id}>{checkoutBusy ? "Starting..." : "Start checkout"}</ControlActionButtonV2>
          </div>

          {honestDisabled("Pause billing", "Disabled because pause/resume is not wired to a real backend action here yet.")}
          {honestDisabled("Resume billing", "Disabled because pause/resume is not wired to a real backend action here yet.")}
          {honestDisabled("Set custom monthly amount", "Disabled because local-only pricing edits would be misleading without a real Stripe mutation.")}
          {honestDisabled("Mark manually paid", "Disabled because the current billing model does not support a safe truthful manual-paid write here.")}

          {stripeMessage ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>{stripeMessage}</div> : null}
        </ControlPanelV2>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Billing Activity</div>
          <ControlActionButtonV2 onClick={() => void loadActivity()} disabled={loadingActivity}>{loadingActivity ? "Refreshing..." : "Refresh"}</ControlActionButtonV2>
        </div>

        <ControlTableWrapV2>
          <ControlTableV2>
            <thead>
              <tr>
                {["Time", "Action", "Actor", "Detail"].map((heading) => (
                  <ControlTableHeadCellV2 key={heading}>{heading}</ControlTableHeadCellV2>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingActivity ? (
                <tr><td colSpan={4} style={{ padding: 14, color: t.color.textMuted }}>Loading activity...</td></tr>
              ) : activity.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 14, color: t.color.textMuted }}>No billing activity was recorded yet.</td></tr>
              ) : (
                activity.map((row) => (
                  <tr key={row.id}>
                    <ControlTableCellV2>{formatDateTime(row.created_at)}</ControlTableCellV2>
                    <ControlTableCellV2><span style={{ fontWeight: 700, color: t.color.text }}>{row.action}</span></ControlTableCellV2>
                    <ControlTableCellV2>{row.actor_email ?? "System"}</ControlTableCellV2>
                    <ControlTableCellV2>{Object.keys(row.meta ?? {}).length ? JSON.stringify(row.meta) : "No additional detail"}</ControlTableCellV2>
                  </tr>
                ))
              )}
            </tbody>
          </ControlTableV2>
        </ControlTableWrapV2>
      </div>
    </div>
  );
}
