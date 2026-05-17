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

export default async function MobileAccessPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const shopFilter = firstParam(params.shop).trim();
  const data = await loadPeopleViews();
  const rows = data.mobileRows.filter((row) => (shopFilter ? row.shop_id === shopFilter : true));

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Mobile"
        title="Mobile Access"
        description="Cloud authority view of mobile-enabled employees, shop-level mobile access modes, timeclock review requirements, and recent mobile activity."
        actions={<ControlActionLink href="/timeclock-review">Open review queue</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Mobile Enabled" value={String(data.summary.mobileEnabled)} meta="Employee rows currently marked as mobile-enabled in Control." tone={data.summary.mobileEnabled > 0 ? "info" : "neutral"} />
        <ControlMetricCard label="Queue-Only" value={String(data.summary.mobileQueueOnly)} meta="Employees in shops where mobile is limited to review-first punch flow." tone={data.summary.mobileQueueOnly > 0 ? "warning" : "neutral"} />
        <ControlMetricCard label="Blocked" value={String(data.summary.mobileBlocked)} meta="Blocked by shop-level access mode or employee-level mobile flag." tone={data.summary.mobileBlocked > 0 ? "danger" : "success"} />
        <ControlMetricCard label="Review Required" value={String(data.summary.mobileReviewRequired)} meta="Employee rows that require mobile timeclock punches to enter review." tone={data.summary.mobileReviewRequired > 0 ? "warning" : "neutral"} />
        <ControlMetricCard label="Recent Mobile Events" value={String(data.summary.recentMobileEvents)} meta="Mobile-source time events seen within the last 7 days from the current authorized scope." tone={data.summary.recentMobileEvents > 0 ? "success" : "neutral"} />
      </div>

      <ControlPanel
        title="Mobile Access Directory"
        description="Shop-level mobile entitlement stays visible alongside employee-level mobile and timeclock flags. This page does not invent user-specific access modes beyond the fields Control already stores."
      >
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
          <ControlActionLink href="/mobile-access">Clear</ControlActionLink>
        </form>

        {rows.length === 0 ? (
          <ControlEmptyState
            title="No mobile access rows found"
            description="No employee records with surfaced mobile access or mobile timeclock state matched the current scope."
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1220}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Name</ControlTableHeadCell>
                  <ControlTableHeadCell>Email</ControlTableHeadCell>
                  <ControlTableHeadCell>Shop</ControlTableHeadCell>
                  <ControlTableHeadCell>Access Mode</ControlTableHeadCell>
                  <ControlTableHeadCell>Mobile Timeclock</ControlTableHeadCell>
                  <ControlTableHeadCell>Review Required</ControlTableHeadCell>
                  <ControlTableHeadCell>Status</ControlTableHeadCell>
                  <ControlTableHeadCell>Last Mobile Activity</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Action</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ color: t.color.text, fontWeight: 800 }}>{row.name}</div>
                        <div style={{ fontSize: 12, color: t.color.textMuted }}>{row.employee_id}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{row.email ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>{row.shop_name}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip
                        label={row.access_mode.replaceAll("_", " ")}
                        tone={row.access_mode === "full" ? "success" : row.access_mode === "queue_only" ? "warning" : "danger"}
                      />
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip
                        label={row.mobile_timeclock_enabled === true ? "Enabled" : row.mobile_timeclock_enabled === false ? "Disabled" : "Not surfaced"}
                        tone={row.mobile_timeclock_enabled === true ? "success" : row.mobile_timeclock_enabled === false ? "danger" : "neutral"}
                      />
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip
                        label={row.review_required === true ? "Required" : row.review_required === false ? "No" : "Not surfaced"}
                        tone={row.review_required === true ? "warning" : row.review_required === false ? "success" : "neutral"}
                      />
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.status_label} tone={row.status_tone} />
                    </ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.last_mobile_activity_at)}</ControlTableCell>
                    <ControlTableCell align="right">
                      {row.action_href ? (
                        <ControlActionLink href={row.action_href} tone="secondary">Open shop</ControlActionLink>
                      ) : (
                        <span style={{ color: t.color.textMuted, fontSize: 12 }}>Not surfaced</span>
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
