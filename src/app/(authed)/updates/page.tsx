import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";
import { humanizeUpdateValue, loadUpdateViews, updateStatusTone, type UpdatePackageViewRow } from "@/lib/control/updateViews";
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

function packageName(row: UpdatePackageViewRow) {
  const path = String(row.file_path ?? "").trim();
  if (!path) return "Unnamed package";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export default async function UpdatesPage() {
  const data = await loadUpdateViews();

  if (!data.context.isPlatformAdmin) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Updates"
          title="Updates"
          description="This area stays restricted to platform-admin sessions because it exposes package inventory and validation policy across shops."
          actions={<ControlActionLink href="/shops">Open shops</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="Platform admin access required"
            description="Cross-shop update package and validation policy visibility remains platform-admin only."
          />
        </ControlPanel>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Updates"
        title="Updates"
        description="Control is the authority for update package metadata and device validation policy. Shop-specific minimum and pinned versions stay visible as policy outcomes, not guessed deployment state."
        actions={<ControlActionLink href="/updates/packages" tone="primary">Upload package</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Total Packages" value={String(data.summary.totalPackages)} meta="Recorded package inventory in Control." tone="neutral" />
        <ControlMetricCard label="Current / Stable" value={String(data.summary.stablePackages)} meta="Packages currently marked with the stable channel." tone={data.summary.stablePackages > 0 ? "success" : "neutral"} />
        <ControlMetricCard label="Required Minimum Version" value={data.summary.minimumVersionLabel} meta="Shown as a single version only when policy is uniform; otherwise kept explicitly shop-specific." tone={data.summary.minimumVersionLabel === "Not surfaced" ? "neutral" : "warning"} />
        <ControlMetricCard label="Pinned Version" value={data.summary.pinnedVersionLabel} meta="Shown as a single version only when policy is uniform; otherwise kept explicitly shop-specific." tone={data.summary.pinnedVersionLabel === "Not surfaced" ? "neutral" : "info"} />
        <ControlMetricCard label="Devices Behind" value={String(data.summary.devicesBehind)} meta="Derived from current reported device versions against surfaced minimum and pinned policy rules." tone={data.summary.devicesBehind > 0 ? "warning" : "success"} />
      </div>

      <ControlPanel
        title="Update Inventory"
        description="Package metadata and policy references. This page does not invent a latest deployed version when Control only stores package inventory and shop-specific validation rules."
      >
        {data.rows.length === 0 ? (
          <ControlEmptyState
            title="No update packages recorded"
            description="Upload the first package before using Control as an update inventory surface."
            action={<ControlActionLink href="/updates/packages" tone="primary">Upload package</ControlActionLink>}
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1380}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Version</ControlTableHeadCell>
                  <ControlTableHeadCell>Channel</ControlTableHeadCell>
                  <ControlTableHeadCell>Minimum Required Version</ControlTableHeadCell>
                  <ControlTableHeadCell>Pinned Version</ControlTableHeadCell>
                  <ControlTableHeadCell>Released</ControlTableHeadCell>
                  <ControlTableHeadCell>Devices Behind / Affected</ControlTableHeadCell>
                  <ControlTableHeadCell>Status</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Action</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ color: t.color.text, fontWeight: 800 }}>{row.version ?? "Not surfaced"}</div>
                        <div style={{ fontSize: 12, color: t.color.textMuted }}>{packageName(row)}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{humanizeUpdateValue(row.channel, "Not surfaced")}</ControlTableCell>
                    <ControlTableCell>{row.min_required_label}</ControlTableCell>
                    <ControlTableCell>{row.pinned_label}</ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.created_at)}</ControlTableCell>
                    <ControlTableCell>{row.affected_devices === null ? "Not surfaced" : String(row.affected_devices)}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.status_label} tone={updateStatusTone(row.status_label)} />
                    </ControlTableCell>
                    <ControlTableCell align="right">
                      <ControlActionLink href="/updates/packages" tone="secondary">Open uploads</ControlActionLink>
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
