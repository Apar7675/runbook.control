"use client";

import React from "react";
import { ControlActionButtonV2, ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";

type DirectoryRow = {
  id: string;
  name: string;
};

type BillingStatusSnapshot = {
  ok: true;
  shop: {
    billing_status: string | null;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
    billing_current_period_end?: string | null;
    billing_amount?: string | number | null;
    billing_interval?: string | null;
    grace_ends_at?: string | null;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    subscription_plan?: string | null;
    entitlement_override?: string | null;
    manual_billing_override?: boolean | null;
    manual_billing_status?: string | null;
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

type BillingStatusResponse = BillingStatusSnapshot | {
  ok?: false;
  error?: string;
};

type MutationResponse = BillingStatusResponse;

function labelRow(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <div style={{ color: t.color.textQuiet, ...t.type.label }}>{label}</div>
      <div style={{ fontSize: 12.5, color: t.color.text }}>{value}</div>
    </div>
  );
}

function formatMaybeDate(value?: string | null) {
  if (!value) return "Not set";
  return formatDateTime(value);
}

async function parseJson<T>(response: Response) {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as T;
}

function reasonText(reason: string | null) {
  return reason ? <div style={{ fontSize: 11.5, color: t.color.textQuiet }}>{reason}</div> : null;
}

export default function BillingAccessDrawerV2({
  row,
  open,
  onClose,
  onChanged,
}: {
  row: DirectoryRow | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<BillingStatusSnapshot | null>(null);
  const [status, setStatus] = React.useState("");
  const [note, setNote] = React.useState("");
  const [graceDays, setGraceDays] = React.useState("7");
  const [override, setOverride] = React.useState<"allow" | "restricted">("allow");
  const [busy, setBusy] = React.useState(false);
  const snapshotReady = Boolean(snapshot);
  const noteRequired = !note.trim();
  const graceDaysValid = Number.isFinite(Number(graceDays)) && Number(graceDays) > 0;
  const hasOverrideState = Boolean(snapshot?.shop.manual_billing_override || snapshot?.shop.entitlement_override);
  const overrideAlreadyApplied = snapshot?.shop.entitlement_override === override;
  const stripeConnected = Boolean(snapshot?.shop.stripe_subscription_id || snapshot?.shop.stripe_customer_id);

  const accessActionReason = !snapshotReady ? "Loading current billing state." : (noteRequired ? "Operator note required." : null);
  const graceActionReason = !snapshotReady ? "Loading current billing state." : (noteRequired ? "Operator note required." : (!graceDaysValid ? "Enter valid grace days." : null));
  const overrideActionReason =
    !snapshotReady ? "Loading current billing state." : (noteRequired ? "Operator note required." : (overrideAlreadyApplied ? `Override already set to ${override}.` : null));
  const clearActionReason =
    !snapshotReady ? "Loading current billing state." : (noteRequired ? "Operator note required." : (!hasOverrideState ? "No overrides are set." : null));
  const syncActionReason = !snapshotReady ? "Loading current billing state." : (stripeConnected ? null : "No Stripe customer or subscription id is recorded.");

  async function load() {
    if (!row) return;
    setLoading(true);
    const response = await safeFetch<BillingStatusResponse>(`/api/billing/shop-status?shop_id=${encodeURIComponent(row.id)}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setStatus(response.ok ? (response.data as any)?.error ?? "Could not load shop billing state." : `${response.status}: ${response.error}`);
      setLoading(false);
      return;
    }

      setSnapshot(response.data as BillingStatusSnapshot);
    setStatus("");
    setLoading(false);
  }

  React.useEffect(() => {
    if (!open || !row) return;
    void load();
  }, [open, row?.id]);

  async function runAccessAction(payload: Record<string, unknown>) {
    if (!row) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/shops/billing-access", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ shop_id: row.id, ...payload }),
      });
      const json = await parseJson<MutationResponse>(response);
      if (!response.ok || !json || !(json as any).ok) {
        setStatus((json as any)?.error ?? `Action failed (${response.status}).`);
        return;
      }
      setSnapshot(json as BillingStatusSnapshot);
      setStatus((json as any).changed === false ? "No billing/access changes were needed." : "Billing/access state updated.");
      await onChanged();
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function syncStripe() {
    if (!row) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/shops/billing-stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ shop_id: row.id, action: "sync" }),
      });
      const json = await parseJson<MutationResponse>(response);
      if (!response.ok || !json || !(json as any).ok) {
        setStatus((json as any)?.error ?? `Sync failed (${response.status}).`);
        return;
      }
      setSnapshot(json as BillingStatusSnapshot);
      setStatus("Stripe state synced into Control.");
      await onChanged();
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open || !row) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close billing drawer"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(6,10,16,0.58)",
          border: "none",
          padding: 0,
          margin: 0,
          zIndex: 70,
          cursor: "pointer",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: 420,
          maxWidth: "100vw",
          height: "100vh",
          zIndex: 71,
          background: t.color.surface,
          borderLeft: `1px solid ${t.color.border}`,
          display: "grid",
          gridTemplateRows: "auto 1fr",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", padding: "14px 14px 12px", borderBottom: `1px solid ${t.color.border}` }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ color: t.color.textQuiet, ...t.type.label }}>Billing & Access</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.color.text, lineHeight: 1.2 }}>{row.name}</div>
          </div>
          <ControlActionButtonV2 tone="ghost" onClick={onClose}>Close</ControlActionButtonV2>
        </div>

        <div style={{ overflowY: "auto", padding: 14, display: "grid", gap: 14 }}>
          {loading ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>Loading billing state...</div> : null}
          {status ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>{status}</div> : null}

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <ControlBadgeV2 label={snapshot?.access.display_status ?? "Loading"} tone={toneFromStatusV2(snapshot?.access.display_status ?? "Loading")} />
              <ControlBadgeV2 label={String(snapshot?.shop.billing_status ?? snapshot?.entitlement.status ?? "Unknown").replace(/_/g, " ")} tone={toneFromStatusV2(snapshot?.shop.billing_status ?? snapshot?.entitlement.status ?? "Unknown")} />
            </div>
            <div style={{ fontSize: 12.5, color: t.color.textMuted, lineHeight: 1.5 }}>{snapshot?.access.summary ?? "Loading current billing and access summary."}</div>
          </div>

          <div style={{ display: "grid", gap: 10, paddingTop: 12, borderTop: `1px solid ${t.color.border}` }}>
            {labelRow("Plan", snapshot?.shop.subscription_plan ?? "Not set")}
            {labelRow("Trial end", formatMaybeDate(snapshot?.shop.trial_ends_at))}
            {labelRow("Grace end", formatMaybeDate(snapshot?.shop.grace_ends_at))}
            {labelRow("Subscription", snapshot?.shop.stripe_subscription_id ?? "No subscription id")}
            {labelRow("Override", snapshot?.shop.entitlement_override ?? "None")}
          </div>

          <div style={{ display: "grid", gap: 8, paddingTop: 12, borderTop: `1px solid ${t.color.border}` }}>
            <div style={{ color: t.color.textQuiet, ...t.type.label }}>Operator note</div>
            <ControlInputV2 value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required for billing/access changes" />
          </div>

          <div style={{ display: "grid", gap: 8, paddingTop: 12, borderTop: `1px solid ${t.color.border}` }}>
            <div style={{ color: t.color.textQuiet, ...t.type.label }}>Access actions</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ControlActionButtonV2 disabled={busy || !!accessActionReason} onClick={() => void runAccessAction({ action: "extend_trial", days: 30, note })}>+30 days</ControlActionButtonV2>
              <ControlActionButtonV2 disabled={busy || !!accessActionReason} onClick={() => void runAccessAction({ action: "extend_trial", days: 60, note })}>+60 days</ControlActionButtonV2>
            </div>
            {reasonText(accessActionReason)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <ControlInputV2 value={graceDays} onChange={(event) => setGraceDays(event.target.value)} style={{ maxWidth: 110 }} />
              <ControlActionButtonV2
                disabled={busy || !!graceActionReason}
                onClick={() => void runAccessAction({ action: "extend_grace", days: Number(graceDays), note })}
              >
                Add grace
              </ControlActionButtonV2>
            </div>
            {reasonText(graceActionReason)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <ControlSelectV2 value={override} onChange={(event) => setOverride(event.target.value as "allow" | "restricted")} style={{ maxWidth: 160 }}>
                <option value="allow">Manual allow</option>
                <option value="restricted">Manual restrict</option>
              </ControlSelectV2>
              <ControlActionButtonV2 disabled={busy || !!overrideActionReason} onClick={() => void runAccessAction({ action: "set_entitlement_override", override, note })}>
                Apply override
              </ControlActionButtonV2>
              <ControlActionButtonV2 disabled={busy || !!clearActionReason} onClick={() => void runAccessAction({ action: "clear_overrides", note })}>
                Clear
              </ControlActionButtonV2>
            </div>
            {reasonText(overrideActionReason ?? clearActionReason)}
          </div>

          <div style={{ display: "grid", gap: 8, paddingTop: 12, borderTop: `1px solid ${t.color.border}` }}>
            <div style={{ color: t.color.textQuiet, ...t.type.label }}>Stripe actions</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ControlActionButtonV2 disabled={busy || !!syncActionReason} onClick={() => void syncStripe()}>Sync billing</ControlActionButtonV2>
              <ControlActionLinkV2 href={`/shops/${row.id}?tab=billing`}>
                Open full billing
              </ControlActionLinkV2>
            </div>
            {reasonText(syncActionReason)}
          </div>
        </div>
      </aside>
    </>
  );
}
