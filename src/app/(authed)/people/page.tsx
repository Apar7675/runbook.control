import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";
import { loadPeopleViews, type PeopleDirectoryRow } from "@/lib/control/peopleViews";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;
type PeopleTab = "all" | "control" | "members" | "employees" | "mobile";

const PEOPLE_TABS: Array<{ key: PeopleTab; label: string }> = [
  { key: "all", label: "All People" },
  { key: "control", label: "Control Users" },
  { key: "members", label: "Shop Members" },
  { key: "employees", label: "Employees" },
  { key: "mobile", label: "Mobile Access" },
];

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function normalizeTab(value: string): PeopleTab {
  if (value === "control" || value === "members" || value === "employees" || value === "mobile") return value;
  return "all";
}

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return "Not surfaced";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function typeTone(type: PeopleDirectoryRow["type"]): ControlStatusTone {
  if (type === "Control User") return "info";
  if (type === "Shop Member") return "neutral";
  return "success";
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const activeTab = normalizeTab(firstParam(params.tab).trim().toLowerCase());
  const shopFilter = firstParam(params.shop).trim();

  const data = await loadPeopleViews();
  const shopOptions = data.context.shops;

  const filteredRows = data.peopleRows.filter((row) => {
    if (shopFilter && row.shop_id !== shopFilter) return false;
    if (activeTab === "control") return row.type === "Control User";
    if (activeTab === "members") return row.type === "Shop Member";
    if (activeTab === "employees") return row.type === "Employee";
    if (activeTab === "mobile") return row.mobile_access_label !== "Not surfaced";
    return true;
  });

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="People"
        title="People & Access"
        description="Cloud authority view of Control users, shop members, and employee records. Shop Member means account-to-shop access, while Employee means the shop-floor record that drives workstation readiness."
        actions={<ControlActionLink href="/mobile-access">Open mobile access</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Total People" value={String(data.summary.totalPeople)} meta="Deduplicated people known to this Control session across admin, member, and employee records." tone="neutral" />
        <ControlMetricCard label="Shop Members" value={String(data.summary.shopMembers)} meta="Membership rows from Control's shop authority." tone={data.summary.shopMembers > 0 ? "info" : "neutral"} />
        <ControlMetricCard label="Employees" value={String(data.summary.employees)} meta="Employee directory rows tied to authorized shops." tone={data.summary.employees > 0 ? "success" : "neutral"} />
        <ControlMetricCard label="Mobile Enabled" value={String(data.summary.mobileEnabled)} meta={`${data.summary.mobileQueueOnly} queue-only and ${data.summary.mobileBlocked} blocked by policy or employee state.`} tone={data.summary.mobileEnabled > 0 ? "info" : "neutral"} />
        <ControlMetricCard label="Workstation Ready" value={String(data.summary.workstationEnabled)} meta={`${data.summary.workstationBlocked} employee rows are blocked or not enabled.`} tone={data.summary.workstationEnabled > 0 ? "success" : "warning"} />
      </div>

      <ControlPanel
        title="People Directory"
        description="Table-first authority view. Employee mobile and workstation access applies to Employee rows unless a linked employee record exists, while Shop Member rows represent account/shop role membership."
      >
        <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              padding: 8,
              borderRadius: t.radius.lg,
              border: `1px solid ${t.color.softBorder}`,
              background: "rgba(7, 10, 15, 0.34)",
            }}
          >
            {PEOPLE_TABS.map((tab) => {
              const active = tab.key === activeTab;
              const href = tab.key === "all" ? `/people${shopFilter ? `?shop=${encodeURIComponent(shopFilter)}` : ""}` : `/people?tab=${tab.key}${shopFilter ? `&shop=${encodeURIComponent(shopFilter)}` : ""}`;
              return (
                <ControlActionLink key={tab.key} href={href} tone={active ? "primary" : "ghost"}>
                  {tab.label}
                </ControlActionLink>
              );
            })}
          </div>

          <select
            name="shop"
            defaultValue={shopFilter}
            style={{ minHeight: 38, minWidth: 220, borderRadius: 12, border: `1px solid ${t.color.softBorder}`, background: "rgba(18, 27, 40, 0.95)", color: t.color.text, padding: "0 12px" }}
          >
            <option value="">All shops</option>
            {shopOptions.map((shop) => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </select>
          <input type="hidden" name="tab" value={activeTab === "all" ? "" : activeTab} />
          <button
            type="submit"
            style={{ minHeight: 38, padding: "0 14px", borderRadius: 12, border: "1px solid rgba(37, 99, 235, 0.36)", background: "rgba(37, 99, 235, 0.18)", color: "#F8FAFC", fontWeight: 700, cursor: "pointer" }}
          >
            Apply
          </button>
          <ControlActionLink href="/people">Clear</ControlActionLink>
        </form>

        {filteredRows.length === 0 ? (
          <ControlEmptyState
            title="No people matched the current view"
            description="Control does not currently surface any people rows for the selected tab and shop scope."
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1320}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Name</ControlTableHeadCell>
                  <ControlTableHeadCell>Email</ControlTableHeadCell>
                  <ControlTableHeadCell>Type</ControlTableHeadCell>
                  <ControlTableHeadCell>Shop</ControlTableHeadCell>
                  <ControlTableHeadCell>Role</ControlTableHeadCell>
                  <ControlTableHeadCell>MFA</ControlTableHeadCell>
                  <ControlTableHeadCell>Status</ControlTableHeadCell>
                  <ControlTableHeadCell>Mobile Access</ControlTableHeadCell>
                  <ControlTableHeadCell>Workstation Access</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Action</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.key}>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ color: t.color.text, fontWeight: 800 }}>{row.name}</div>
                        <div style={{ fontSize: 12, color: t.color.textMuted }}>{formatMaybeDate(row.created_at)}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{row.email ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.type} tone={typeTone(row.type)} />
                    </ControlTableCell>
                    <ControlTableCell>{row.shop_name ?? "Platform"}</ControlTableCell>
                    <ControlTableCell>{row.role ? row.role.replaceAll("_", " ") : "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.mfa_label} tone="neutral" />
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.status_label} tone={row.status_tone} />
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.mobile_access_label} tone={row.mobile_access_tone} />
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.workstation_access_label} tone={row.workstation_access_tone} />
                    </ControlTableCell>
                    <ControlTableCell align="right">
                      {row.action_href && row.action_label ? (
                        <ControlActionLink href={row.action_href} tone="secondary">{row.action_label}</ControlActionLink>
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
