import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";
import { auditSeverityTone, loadAuditViews, type AuditFilterValues } from "@/lib/control/auditViews";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return "Not surfaced";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function buildFilters(params: SearchParams): AuditFilterValues {
  return {
    action: firstParam(params.action),
    actor_email: firstParam(params.actor_email),
    shop_id: firstParam(params.shop_id),
    target_id: firstParam(params.target_id),
    before: firstParam(params.before),
    limit: firstParam(params.limit) || "200",
  };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = buildFilters(params);
  const data = await loadAuditViews(filters);

  if (!data.context.isPlatformAdmin) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Audit"
          title="Audit Log"
          description="This area stays restricted to platform-admin sessions because it exposes the cloud and admin audit record across shops."
          actions={<ControlActionLink href="/shops">Open shops</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="Platform admin access required"
            description="Cross-shop audit visibility remains platform-admin only."
          />
        </ControlPanel>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Audit"
        title="Audit Log"
        description="Cloud and admin audit record for Control. Filters stay grounded in the existing server-side audit API and export path."
        actions={<ControlActionLink href={`/api/audit/export?limit=${encodeURIComponent(filters.limit || "200")}${filters.action ? `&action=${encodeURIComponent(filters.action)}` : ""}${filters.actor_email ? `&actor_email=${encodeURIComponent(filters.actor_email)}` : ""}${filters.shop_id ? `&shop_id=${encodeURIComponent(filters.shop_id)}` : ""}${filters.target_id ? `&target_id=${encodeURIComponent(filters.target_id)}` : ""}${filters.before ? `&before=${encodeURIComponent(filters.before)}` : ""}`} tone="primary">Export audit</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Total Visible Events" value={String(data.counts.totalVisible)} meta="Exact count from the current filtered audit scope." tone="neutral" />
        <ControlMetricCard label="Events Today" value={String(data.counts.eventsToday)} meta="Exact count since the current UTC day boundary under the active filters." tone={data.counts.eventsToday > 0 ? "info" : "neutral"} />
        <ControlMetricCard label="Billing / Device / Security / Support" value={String(data.counts.categoryEvents)} meta="Derived from the current filtered slice of loaded audit rows." tone={data.counts.categoryEvents > 0 ? "warning" : "neutral"} />
        <ControlMetricCard label="High-Risk / Destructive" value={String(data.counts.highRiskEvents)} meta="Derived from delete, revoke, grant, and failure-oriented actions in the current filtered slice." tone={data.counts.highRiskEvents > 0 ? "danger" : "success"} />
      </div>

      <ControlPanel
        title="Audit Record"
        description="Dense audit table with real server-side filters only. No client-only fake filter controls are introduced here."
      >
        <form method="get" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
            <input name="action" defaultValue={filters.action} placeholder="Action contains" style={{ minHeight: 38, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(18, 27, 40, 0.95)", color: t.color.text, padding: "0 12px" }} />
            <input name="actor_email" defaultValue={filters.actor_email} placeholder="Actor email" style={{ minHeight: 38, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(18, 27, 40, 0.95)", color: t.color.text, padding: "0 12px" }} />
            <select name="shop_id" defaultValue={filters.shop_id} style={{ minHeight: 38, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(18, 27, 40, 0.95)", color: t.color.text, padding: "0 12px" }}>
              <option value="">All shops</option>
              {data.context.shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
            <input name="target_id" defaultValue={filters.target_id} placeholder="Target id" style={{ minHeight: 38, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(18, 27, 40, 0.95)", color: t.color.text, padding: "0 12px" }} />
            <input name="before" defaultValue={filters.before} placeholder="Before (ISO)" style={{ minHeight: 38, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(18, 27, 40, 0.95)", color: t.color.text, padding: "0 12px" }} />
            <input name="limit" defaultValue={filters.limit} placeholder="Limit" style={{ minHeight: 38, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(18, 27, 40, 0.95)", color: t.color.text, padding: "0 12px" }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="submit" style={{ minHeight: 38, padding: "0 14px", borderRadius: 12, border: "1px solid rgba(37, 99, 235, 0.36)", background: "rgba(37, 99, 235, 0.18)", color: "#F8FAFC", fontWeight: 700, cursor: "pointer" }}>Apply</button>
            <ControlActionLink href="/audit">Clear</ControlActionLink>
            <div style={{ fontSize: 12, color: t.color.textMuted }}>{data.rows.length} row{data.rows.length === 1 ? "" : "s"} loaded</div>
          </div>
        </form>

        {data.rows.length === 0 ? (
          <ControlEmptyState
            title="No audit rows matched the current filters"
            description="Widen the current filters or wait for new Control activity to be recorded."
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1460}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Date / Time</ControlTableHeadCell>
                  <ControlTableHeadCell>Actor</ControlTableHeadCell>
                  <ControlTableHeadCell>Action</ControlTableHeadCell>
                  <ControlTableHeadCell>Target</ControlTableHeadCell>
                  <ControlTableHeadCell>Shop</ControlTableHeadCell>
                  <ControlTableHeadCell>Details</ControlTableHeadCell>
                  <ControlTableHeadCell>Severity / Status</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <ControlTableCell>{formatMaybeDate(row.created_at)}</ControlTableCell>
                    <ControlTableCell>{row.actor_email ?? row.actor_user_id ?? "System"}</ControlTableCell>
                    <ControlTableCell>
                      <div style={{ color: t.color.text, fontWeight: 700 }}>{row.action}</div>
                    </ControlTableCell>
                    <ControlTableCell>{row.target_label || "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>{row.shop_name ?? row.shop_id ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>{row.details_label}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.severity_label} tone={auditSeverityTone(row.severity_label)} />
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
