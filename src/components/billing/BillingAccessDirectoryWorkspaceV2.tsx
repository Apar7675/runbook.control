"use client";

import React from "react";
import { ControlActionButtonV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import ControlMetricStripV2 from "@/components/control/v2/ControlMetricStripV2";
import { ControlTableCellV2, ControlTableHeadCellV2, ControlTableV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";
import BillingAccessDrawerV2 from "@/components/billing/BillingAccessDrawerV2";

type BillingDirectoryRow = {
  id: string;
  name: string;
  subscription_plan: string | null;
  billing_status: string | null;
  manual_billing_status: string | null;
  manual_billing_override: boolean | null;
  entitlement_override: string | null;
  trial_ends_at: string | null;
  grace_ends_at: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  effective_billing_status: string | null;
  access_display_status: string;
  access_summary: string;
  entitlement_allowed: boolean;
  entitlement_restricted: boolean;
  grace_active: boolean;
};

type BillingDirectoryResponse = {
  ok: true;
  rows: BillingDirectoryRow[];
} | {
  ok?: false;
  error?: string;
};

type SortKey = "name" | "trial_end" | "grace_end" | "billing_status";

function formatMaybeDate(value: string | null) {
  if (!value) return "Not set";
  return formatDateTime(value);
}

function parseTime(value: string | null) {
  const ms = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

export default function BillingAccessDirectoryWorkspaceV2() {
  const [rows, setRows] = React.useState<BillingDirectoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [billingFilter, setBillingFilter] = React.useState("all");
  const [entitlementFilter, setEntitlementFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("name");
  const [selected, setSelected] = React.useState<{ id: string; name: string } | null>(null);

  async function loadDirectory() {
    setLoading(true);
    setStatus("");

    const response = await safeFetch<BillingDirectoryResponse>("/api/admin/shops/billing-directory", {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setStatus(response.ok ? (response.data as any)?.error ?? "Could not load billing directory." : `${response.status}: ${response.error}`);
      setLoading(false);
      return;
    }

    setRows((response.data as any).rows ?? []);
    setLoading(false);
  }

  React.useEffect(() => {
    void loadDirectory();
  }, []);

  const summary = React.useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) => row.access_display_status === "Active" || row.access_display_status === "Free Trial").length,
      paymentNeeded: rows.filter((row) => row.access_display_status === "Payment Needed").length,
      overrides: rows.filter((row) => row.entitlement_override || row.manual_billing_override).length,
    };
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...rows]
      .filter((row) => {
        if (billingFilter !== "all" && String(row.effective_billing_status ?? "").toLowerCase() !== billingFilter) return false;
        if (entitlementFilter !== "all" && String(row.access_display_status ?? "").toLowerCase() !== entitlementFilter) return false;
        return true;
      })
      .filter((row) => {
        if (!needle) return true;
        return [
          row.name,
          row.subscription_plan,
          row.billing_status,
          row.manual_billing_status,
          row.access_display_status,
          row.stripe_subscription_id,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sort === "trial_end") return parseTime(a.trial_ends_at) - parseTime(b.trial_ends_at);
        if (sort === "grace_end") return parseTime(a.grace_ends_at) - parseTime(b.grace_ends_at);
        if (sort === "billing_status") return String(a.effective_billing_status ?? "").localeCompare(String(b.effective_billing_status ?? ""));
        return a.name.localeCompare(b.name);
      });
  }, [billingFilter, entitlementFilter, query, rows, sort]);

  return (
    <>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Billing & Access</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Billing access directory</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>
            The billing/access table is the operator surface for shop entitlement review, billing triage, and focused admin action.
          </div>
        </div>

        <ControlMetricStripV2
          items={[
            { label: "Shops", value: String(summary.total) },
            { label: "Active access", value: String(summary.active) },
            { label: "Payment needed", value: String(summary.paymentNeeded) },
            { label: "Overrides", value: String(summary.overrides) },
          ]}
        />

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ControlInputV2 value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shops, plan, subscription" style={{ minWidth: 260 }} />
            <ControlSelectV2 value={billingFilter} onChange={(event) => setBillingFilter(event.target.value)} style={{ minWidth: 160 }}>
              <option value="all">All billing</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past due</option>
              <option value="canceled">Canceled</option>
              <option value="expired">Expired</option>
              <option value="trial_active">Manual trial</option>
              <option value="trial_extended">Trial extended</option>
              <option value="payment_required">Payment required</option>
              <option value="paid_active">Paid active</option>
              <option value="suspended">Suspended</option>
            </ControlSelectV2>
            <ControlSelectV2 value={entitlementFilter} onChange={(event) => setEntitlementFilter(event.target.value)} style={{ minWidth: 160 }}>
              <option value="all">All entitlement</option>
              <option value="active">Active</option>
              <option value="free trial">Free Trial</option>
              <option value="payment needed">Payment Needed</option>
              <option value="restricted">Restricted</option>
              <option value="expired">Expired</option>
            </ControlSelectV2>
            <ControlSelectV2 value={sort} onChange={(event) => setSort(event.target.value as SortKey)} style={{ minWidth: 150 }}>
              <option value="name">Sort: name</option>
              <option value="billing_status">Sort: billing status</option>
              <option value="trial_end">Sort: trial end</option>
              <option value="grace_end">Sort: grace end</option>
            </ControlSelectV2>
          </div>

          <ControlActionButtonV2 onClick={loadDirectory} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </ControlActionButtonV2>
        </div>

        {status ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>{status}</div> : null}

        <ControlTableWrapV2>
          <ControlTableV2 minWidth={1140}>
            <thead>
              <tr>
                <ControlTableHeadCellV2>Shop</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Plan</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Billing Status</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Entitlement</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Trial End</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Grace End</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Subscription</ControlTableHeadCellV2>
                <ControlTableHeadCellV2 align="right">Actions</ControlTableHeadCellV2>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 16, color: t.color.textMuted }}>Loading billing directory...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 16, color: t.color.textMuted }}>No shops matched the current billing filters.</td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <ControlTableCellV2>
                      <div style={{ display: "grid", gap: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.color.text }}>{row.name}</div>
                        <div style={{ color: t.color.textQuiet, fontSize: 11.5 }}>{row.access_summary}</div>
                      </div>
                    </ControlTableCellV2>
                    <ControlTableCellV2>{row.subscription_plan ?? "Not set"}</ControlTableCellV2>
                    <ControlTableCellV2>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <ControlBadgeV2 label={String(row.effective_billing_status ?? "Unavailable").replace(/_/g, " ")} tone={toneFromStatusV2(row.effective_billing_status ?? "Unavailable")} />
                        {row.manual_billing_override ? <ControlBadgeV2 label="Manual" tone="warning" /> : null}
                      </div>
                    </ControlTableCellV2>
                    <ControlTableCellV2>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <ControlBadgeV2 label={row.access_display_status} tone={toneFromStatusV2(row.access_display_status)} />
                        {row.entitlement_override ? <ControlBadgeV2 label={row.entitlement_override} tone="warning" /> : null}
                      </div>
                    </ControlTableCellV2>
                    <ControlTableCellV2>{formatMaybeDate(row.trial_ends_at)}</ControlTableCellV2>
                    <ControlTableCellV2>{formatMaybeDate(row.grace_ends_at)}</ControlTableCellV2>
                    <ControlTableCellV2>{row.stripe_subscription_id ?? "No subscription id"}</ControlTableCellV2>
                    <ControlTableCellV2 align="right">
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <ControlActionButtonV2 onClick={() => setSelected({ id: row.id, name: row.name })}>Manage</ControlActionButtonV2>
                      </div>
                    </ControlTableCellV2>
                  </tr>
                ))
              )}
            </tbody>
          </ControlTableV2>
        </ControlTableWrapV2>
      </div>

      <BillingAccessDrawerV2
        row={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onChanged={loadDirectory}
      />
    </>
  );
}
