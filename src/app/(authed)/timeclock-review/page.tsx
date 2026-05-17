import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";
import { loadPeopleViews } from "@/lib/control/peopleViews";
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

export default async function TimeclockReviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const shopFilter = firstParam(params.shop).trim();
  const data = await loadPeopleViews();
  const rows = data.timeclockRows.filter((row) => (shopFilter ? row.shop_id === shopFilter : true));

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Timeclock"
        title="Timeclock Review"
        description="Read-only review queue for mobile punches that Control has flagged for approval. Approval actions are not surfaced in the current repo, so this page stays focused on visibility and routing."
        actions={<ControlActionLink href="/mobile-access">Open mobile access</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Needs Review" value={String(data.summary.reviewNeedsAttention)} meta="Time events currently marked with needs_review = true in the authorized scope." tone={data.summary.reviewNeedsAttention > 0 ? "warning" : "success"} />
        <ControlMetricCard label="Pending Today" value={String(data.summary.reviewPendingToday)} meta="Review queue rows whose latest recorded server-side timestamp falls on the current UTC day." tone={data.summary.reviewPendingToday > 0 ? "info" : "neutral"} />
        <ControlMetricCard label="Offline Punches" value={String(data.summary.reviewOfflinePunches)} meta="Review queue rows that surfaced an offline punch indicator." tone={data.summary.reviewOfflinePunches > 0 ? "warning" : "neutral"} />
        <ControlMetricCard label="Mobile Source Events" value={String(data.summary.reviewMobileSourceEvents)} meta="Pending review rows coming from a mobile source value." tone={data.summary.reviewMobileSourceEvents > 0 ? "success" : "neutral"} />
        <ControlMetricCard label="Blocked / Rejected" value={String(data.summary.reviewBlockedOrRejected)} meta="Count based on recent surfaced policy_result values where present." tone={data.summary.reviewBlockedOrRejected > 0 ? "danger" : "neutral"} />
      </div>

      <ControlPanel
        title="Review Queue"
        description="Control can see the queue state, timestamps, and policy reasons. The repo does not currently surface approve/reject mutations here, so rows stay read-only."
      >
        <div
          style={{
            padding: 14,
            borderRadius: t.radius.md,
            border: `1px solid ${t.color.softBorder}`,
            background: "rgba(7, 10, 15, 0.34)",
            color: t.color.textSecondary,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          Approval action not surfaced yet. Use this queue to identify which employee and shop need follow-up, then continue into the relevant shop mobile tab or the existing audit/support flows.
        </div>

        <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            name="shop"
            defaultValue={shopFilter}
            style={{ minHeight: 38, minWidth: 240, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(18, 27, 40, 0.95)", color: t.color.text, padding: "0 12px" }}
          >
            <option value="">All shops</option>
            {data.context.shops.map((shop) => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </select>
          <button
            type="submit"
            style={{ minHeight: 38, padding: "0 14px", borderRadius: 12, border: "1px solid rgba(37, 99, 235, 0.36)", background: "rgba(37, 99, 235, 0.18)", color: "#F8FAFC", fontWeight: 700, cursor: "pointer" }}
          >
            Apply
          </button>
          <ControlActionLink href="/timeclock-review">Clear</ControlActionLink>
        </form>

        {rows.length === 0 ? (
          <ControlEmptyState
            title="No review items are pending"
            description="Control does not currently see any timeclock events flagged for review in the selected scope."
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1340}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Employee</ControlTableHeadCell>
                  <ControlTableHeadCell>Shop</ControlTableHeadCell>
                  <ControlTableHeadCell>Event Type</ControlTableHeadCell>
                  <ControlTableHeadCell>Client Time</ControlTableHeadCell>
                  <ControlTableHeadCell>Server Time</ControlTableHeadCell>
                  <ControlTableHeadCell>Source</ControlTableHeadCell>
                  <ControlTableHeadCell>Offline?</ControlTableHeadCell>
                  <ControlTableHeadCell>Issue / Reason</ControlTableHeadCell>
                  <ControlTableHeadCell>Status</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Action</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ color: t.color.text, fontWeight: 800 }}>{row.employee_name}</div>
                        <div style={{ fontSize: 12, color: t.color.textMuted }}>{row.id}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{row.shop_name ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>{row.event_type ? row.event_type.replaceAll("_", " ") : "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.client_time)}</ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.server_time)}</ControlTableCell>
                    <ControlTableCell>{row.source ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip
                        label={row.offline === true ? "Yes" : row.offline === false ? "No" : "Not surfaced"}
                        tone={row.offline === true ? "warning" : row.offline === false ? "success" : "neutral"}
                      />
                    </ControlTableCell>
                    <ControlTableCell>{row.reason ?? "Pending review"}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.status_label} tone="warning" />
                    </ControlTableCell>
                    <ControlTableCell align="right">
                      {row.action_href ? (
                        <ControlActionLink href={row.action_href} tone="secondary">Open shop</ControlActionLink>
                      ) : (
                        <span style={{ color: t.color.textMuted, fontSize: 12 }}>Read only</span>
                      )}
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
