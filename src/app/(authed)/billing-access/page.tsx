import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";
import { humanizeBillingValue, loadBillingViews, type BillingDirectoryViewRow } from "@/lib/control/billingViews";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return "Not surfaced";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function planLabel(row: BillingDirectoryViewRow) {
  return humanizeBillingValue(row.subscription_plan, "Not set");
}

function toneFromBillingStatus(value: string | null | undefined): ControlStatusTone {
  const status = String(value ?? "").trim().toLowerCase();
  if (!status) return "neutral";
  if (status === "trialing") return "info";
  if (status === "active" || status === "paid_active") return "success";
  if (status === "past_due" || status === "payment_required") return "warning";
  if (status === "expired" || status === "suspended" || status === "trial_ended") return "danger";
  return "neutral";
}

function toneFromAccess(value: string) {
  if (value === "full") return "success" as const;
  if (value === "read_only" || value === "queue_only") return "warning" as const;
  if (value === "blocked") return "danger" as const;
  return "neutral" as const;
}

function toneFromTrialState(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("trial")) return "info" as const;
  if (normalized.includes("grace") || normalized.includes("payment")) return "warning" as const;
  if (normalized.includes("restricted")) return "danger" as const;
  return "neutral" as const;
}

function stripeLabel(row: BillingDirectoryViewRow) {
  if (row.stripe_customer_id && row.stripe_subscription_id) return "Customer + subscription";
  if (row.stripe_customer_id) return "Customer only";
  if (row.stripe_subscription_id) return "Subscription only";
  return "Not connected";
}

export default async function BillingAccessPage() {
  const data = await loadBillingViews();

  if (!data.context.isPlatformAdmin) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Billing"
          title="Billing & Plans"
          description="This area stays restricted to platform-admin sessions because it controls billing state and resulting RunBook access across shops."
          actions={<ControlActionLink href="/shops">Open shops</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="Platform admin access required"
            description="Open a specific shop billing tab if you only need one shop. Cross-shop billing and entitlement review remains platform-admin only."
          />
        </ControlPanel>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Billing"
        title="Billing & Plans"
        description="Cloud authority view of billing state, entitlement outcomes, and the actual RunBook product behavior each shop receives as a result."
        actions={<ControlActionLink href="/shops">Open shops</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Total Shops" value={String(data.summary.totalShops)} meta="All shop billing rows currently visible to this platform-admin session." tone="neutral" />
        <ControlMetricCard label="Active / Full Access" value={String(data.summary.fullAccess)} meta="Desktop, Mobile, and Workstation are all fully open." tone={data.summary.fullAccess > 0 ? "success" : "warning"} />
        <ControlMetricCard label="Trial / Ending Soon" value={String(data.summary.trialing)} meta={data.summary.trialEndingSoon > 0 ? `${data.summary.trialEndingSoon} trial${data.summary.trialEndingSoon === 1 ? "" : "s"} end within 7 days.` : "No trial windows are ending within 7 days."} tone={data.summary.trialing > 0 ? "info" : "neutral"} />
        <ControlMetricCard label="Past Due / Payment Required" value={String(data.summary.paymentRequired)} meta="These shops need billing attention before access stabilizes." tone={data.summary.paymentRequired > 0 ? "warning" : "success"} />
        <ControlMetricCard label="Blocked / Suspended" value={String(data.summary.blockedOrSuspended)} meta="These shops currently have restricted product behavior in RunBook." tone={data.summary.blockedOrSuspended > 0 ? "danger" : "success"} />
      </div>

      <ControlPanel
        title="Billing Directory"
        description="Each row shows the resulting RunBook access behavior, not just Stripe state. Shop-level mutation controls remain on the existing shop billing page."
      >
        {data.rows.length === 0 ? (
          <ControlEmptyState
            title="No billing rows available"
            description="Control does not currently have any shop billing rows to display."
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1600}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Shop</ControlTableHeadCell>
                  <ControlTableHeadCell>Billing Status</ControlTableHeadCell>
                  <ControlTableHeadCell>Plan</ControlTableHeadCell>
                  <ControlTableHeadCell>Subscription Status</ControlTableHeadCell>
                  <ControlTableHeadCell>Desktop Access</ControlTableHeadCell>
                  <ControlTableHeadCell>Mobile Access</ControlTableHeadCell>
                  <ControlTableHeadCell>Workstation Access</ControlTableHeadCell>
                  <ControlTableHeadCell>Trial / Grace / Restricted</ControlTableHeadCell>
                  <ControlTableHeadCell>Stripe</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Action</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ color: t.color.text, fontWeight: 800 }}>{row.name}</div>
                        <div style={{ fontSize: 12, color: t.color.textMuted }}>{formatMaybeDate(row.created_at)}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={humanizeBillingValue(row.billing_status, "Unknown")} tone={toneFromBillingStatus(row.billing_status)} />
                    </ControlTableCell>
                    <ControlTableCell>{planLabel(row)}</ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 8 }}>
                        <ControlStatusChip label={humanizeBillingValue(row.effective_billing_status, "Unknown")} tone={toneFromBillingStatus(row.effective_billing_status)} />
                        <div style={{ fontSize: 12, color: t.color.textMuted, lineHeight: 1.5 }}>{row.access_summary}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={humanizeBillingValue(row.desktop_access, "Unknown")} tone={toneFromAccess(row.desktop_access)} />
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={humanizeBillingValue(row.mobile_access, "Unknown")} tone={toneFromAccess(row.mobile_access)} />
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={humanizeBillingValue(row.workstation_access, "Unknown")} tone={toneFromAccess(row.workstation_access)} />
                    </ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 8 }}>
                        <ControlStatusChip label={row.trial_state_label} tone={toneFromTrialState(row.trial_state_label)} />
                        <div style={{ fontSize: 12, color: t.color.textMuted, lineHeight: 1.5 }}>
                          Trial: {formatMaybeDate(row.trial_ends_at)}
                          <br />
                          Grace: {formatMaybeDate(row.grace_ends_at)}
                        </div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 8 }}>
                        <ControlStatusChip label={stripeLabel(row)} tone={row.stripe_customer_id || row.stripe_subscription_id ? "info" : "neutral"} />
                        <div style={{ fontSize: 12, color: t.color.textMuted, lineHeight: 1.5 }}>
                          Customer: {row.stripe_customer_id ?? "Not surfaced"}
                          <br />
                          Subscription: {row.stripe_subscription_id ?? "Not surfaced"}
                        </div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell align="right">
                      <ControlActionLink href={`/shops/${row.id}?tab=billing`} tone="secondary">Open shop billing</ControlActionLink>
                    </ControlTableCell>
                  </tr>
                ))}
              </tbody>
            </ControlTable>
          </ControlTableWrap>
        )}
      </ControlPanel>
    </div>
  );
}
