import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";
import { loadSupportViews, type CapabilitySupportRow, type DeleteOperationViewRow, type SupportBundleViewRow } from "@/lib/control/supportViews";
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

function fileName(path: string | null | undefined) {
  const text = String(path ?? "").trim();
  if (!text) return "No stored path";
  const parts = text.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? text;
}

function capabilityTone(row: CapabilitySupportRow): ControlStatusTone {
  const value = String(row.requirements_status ?? "").trim().toLowerCase();
  if (value === "fail" || value === "failed") return "danger";
  if (value === "warning") return "warning";
  if (value === "pass" || value === "passed") return "success";
  return "neutral";
}

function deleteTone(row: DeleteOperationViewRow): ControlStatusTone {
  const value = String(row.status ?? "").trim().toLowerCase();
  if (value === "completed") return "success";
  if (value === "running" || value === "pending") return "warning";
  if (value === "failed" || value === "partial_failed") return "danger";
  return "neutral";
}

export default async function SupportPage() {
  const data = await loadSupportViews();

  if (!data.context.isPlatformAdmin) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Support"
          title="Support"
          description="This area stays restricted to platform-admin sessions because it exposes cross-shop support metadata, delete-operation state, and schema visibility."
          actions={<ControlActionLink href="/shops">Open shops</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="Platform admin access required"
            description="Open a specific shop support tab if you only need one shop. Cross-shop support and cleanup visibility remains platform-admin only."
          />
        </ControlPanel>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Support"
        title="Support"
        description="Admin and support surface for bundle metadata, capability diagnostics, schema visibility, and cleanup or delete-operation tracking across Control."
        actions={<ControlActionLink href="/support/bundle" tone="primary">Upload bundle</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Support Bundles" value={String(data.summary.supportBundles)} meta="Support-bundle metadata rows recorded in Control." tone={data.summary.supportBundles > 0 ? "info" : "neutral"} />
        <ControlMetricCard label="Shops With Issues" value={String(data.summary.shopsWithIssues)} meta="Billing restrictions, stale/offline device health, capability warnings, or delete-operation attention." tone={data.summary.shopsWithIssues > 0 ? "warning" : "success"} />
        <ControlMetricCard label="Capability Warnings" value={String(data.summary.devicesWithCapabilityWarnings)} meta="Latest surfaced capability snapshots reporting warning or fail status." tone={data.summary.devicesWithCapabilityWarnings > 0 ? "warning" : "success"} />
        <ControlMetricCard label="Cleanup / Delete Operations" value={String(data.summary.cleanupOperations)} meta="Pending, running, failed, or partially failed cleanup workflows." tone={data.summary.cleanupOperations > 0 ? "danger" : "success"} />
        <ControlMetricCard label="Recent Support Activity" value={String(data.summary.recentSupportActivity)} meta="Bundles, capability snapshots, and delete-operation timestamps seen within the last 7 days." tone={data.summary.recentSupportActivity > 0 ? "info" : "neutral"} />
      </div>

      <ControlPanel
        title="Support Bundles"
        description="Control stores support-bundle metadata and routing context here. This does not make Control the owner of Desktop company files."
        actions={<ControlActionLink href="/support/bundle">Open uploader</ControlActionLink>}
      >
        {data.bundles.length === 0 ? (
          <ControlEmptyState
            title="No support bundles recorded"
            description="Control does not currently have any support-bundle metadata rows to display."
            action={<ControlActionLink href="/support/bundle" tone="primary">Upload support bundle</ControlActionLink>}
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1380}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Bundle</ControlTableHeadCell>
                  <ControlTableHeadCell>Shop</ControlTableHeadCell>
                  <ControlTableHeadCell>Device</ControlTableHeadCell>
                  <ControlTableHeadCell>Created</ControlTableHeadCell>
                  <ControlTableHeadCell>Size</ControlTableHeadCell>
                  <ControlTableHeadCell>Status</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Action</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {data.bundles.map((row: SupportBundleViewRow) => (
                  <tr key={row.id}>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ color: t.color.text, fontWeight: 800 }}>{fileName(row.file_path)}</div>
                        <div style={{ fontSize: 12, color: t.color.textMuted }}>{row.file_path ?? "No stored path"}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{row.shop_name ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>{row.device_label}</ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.created_at)}</ControlTableCell>
                    <ControlTableCell>{row.size_label}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.status_label} tone="info" />
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

      <ControlPanel
        title="Device Capability / Diagnostics"
        description="Latest surfaced capability snapshots from enrolled devices. Empty means the repo does not currently have capability rows to show."
        actions={<ControlActionLink href="/devices">Open devices</ControlActionLink>}
      >
        {data.capabilityRows.length === 0 ? (
          <ControlEmptyState
            title="No capability snapshots surfaced"
            description="Control does not currently have any capability snapshot rows to display."
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1260}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Device</ControlTableHeadCell>
                  <ControlTableHeadCell>Shop</ControlTableHeadCell>
                  <ControlTableHeadCell>Requirement Status</ControlTableHeadCell>
                  <ControlTableHeadCell>OS</ControlTableHeadCell>
                  <ControlTableHeadCell>RAM</ControlTableHeadCell>
                  <ControlTableHeadCell>Disk Free</ControlTableHeadCell>
                  <ControlTableHeadCell>Last Captured</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {data.capabilityRows.map((row: CapabilitySupportRow) => (
                  <tr key={row.device_id}>
                    <ControlTableCell>{row.device_name}</ControlTableCell>
                    <ControlTableCell>{row.shop_name ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={row.requirements_status ? row.requirements_status.replaceAll("_", " ") : "Not surfaced"} tone={capabilityTone(row)} />
                    </ControlTableCell>
                    <ControlTableCell>{row.os_label}</ControlTableCell>
                    <ControlTableCell>{row.ram_label}</ControlTableCell>
                    <ControlTableCell>{row.disk_free_label}</ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.reported_at)}</ControlTableCell>
                  </tr>
                ))}
              </tbody>
            </ControlTable>
          </ControlTableWrap>
        )}
      </ControlPanel>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)", gap: 18 }}>
        <ControlPanel
          title="Schema / Shop Summary"
          description="Server-side summary using the same admin data patterns that already exist in Control. This is a visibility panel, not a mutation surface."
          actions={<ControlActionLink href="/status">Open status page</ControlActionLink>}
        >
          {data.schemaSummary.available ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {[
                ["Checked", formatMaybeDate(data.schemaSummary.checked_at)],
                ["Shops", String(data.schemaSummary.shops)],
                ["Members", String(data.schemaSummary.members)],
                ["Employees", String(data.schemaSummary.employees)],
                ["Devices", String(data.schemaSummary.devices)],
                ["Time Events", String(data.schemaSummary.timeEvents)],
                ["Support Bundles", String(data.schemaSummary.supportBundles)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: 14,
                    borderRadius: t.radius.md,
                    border: `1px solid ${t.color.softBorder}`,
                    background: "rgba(7, 10, 15, 0.34)",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.72, textTransform: "uppercase", color: t.color.textMuted }}>{label}</div>
                  <div style={{ color: t.color.textSecondary, fontSize: 13, lineHeight: 1.55 }}>{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <ControlEmptyState
              title="Schema summary not available"
              description="Use the existing status page if you need deeper platform diagnostics."
            />
          )}
        </ControlPanel>

        <ControlPanel
          title="Cleanup / Delete Operations"
          description="Danger-zone visibility only. Destructive workflows stay server-side and protected; this panel surfaces real operation state without adding new mutation paths."
        >
          {data.deleteOperations.length === 0 ? (
            <ControlEmptyState
              title="No delete operations recorded"
              description="Control does not currently have cleanup or delete-operation rows to display."
            />
          ) : (
            <ControlTableWrap>
              <ControlTable minWidth={1040}>
                <thead>
                  <tr>
                    <ControlTableHeadCell>Shop</ControlTableHeadCell>
                    <ControlTableHeadCell>Operation Phase</ControlTableHeadCell>
                    <ControlTableHeadCell>Status</ControlTableHeadCell>
                    <ControlTableHeadCell>Started</ControlTableHeadCell>
                    <ControlTableHeadCell>Finished</ControlTableHeadCell>
                    <ControlTableHeadCell>Recent Log Summary</ControlTableHeadCell>
                    <ControlTableHeadCell align="right">Action</ControlTableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {data.deleteOperations.map((row: DeleteOperationViewRow) => (
                    <tr key={row.id}>
                      <ControlTableCell>{row.shop_name ?? "Not surfaced"}</ControlTableCell>
                      <ControlTableCell>{row.phase ? row.phase.replaceAll("_", " ") : "Not surfaced"}</ControlTableCell>
                      <ControlTableCell>
                        <ControlStatusChip label={row.status ? row.status.replaceAll("_", " ") : "Unknown"} tone={deleteTone(row)} />
                      </ControlTableCell>
                      <ControlTableCell>{formatMaybeDate(row.started_at)}</ControlTableCell>
                      <ControlTableCell>{formatMaybeDate(row.finished_at)}</ControlTableCell>
                      <ControlTableCell>{row.recent_log_summary ?? "Not surfaced"}</ControlTableCell>
                      <ControlTableCell align="right">
                        {row.action_href ? (
                          <ControlActionLink href={row.action_href} tone="danger">Open shop</ControlActionLink>
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
    </div>
  );
}
