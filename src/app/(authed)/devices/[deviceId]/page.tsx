import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import DeviceAdminActionsPanel from "@/components/devices/DeviceAdminActionsPanel";
import { capabilityMessages, capabilityStatusLabel, formatBytes, loadDeviceDetail } from "@/lib/control/deviceViews";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ deviceId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DeviceTabKey = "overview" | "token" | "capability" | "updates" | "audit" | "support";

const tabs: Array<{ key: DeviceTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "token", label: "Token & Enrollment" },
  { key: "capability", label: "Capability Snapshot" },
  { key: "updates", label: "Updates" },
  { key: "audit", label: "Audit" },
  { key: "support", label: "Support" },
];

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function normalizeTab(value: string | string[] | undefined): DeviceTabKey {
  const candidate = firstParam(value).trim().toLowerCase();
  return tabs.some((tab) => tab.key === candidate) ? (candidate as DeviceTabKey) : "overview";
}

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return "Not surfaced";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function humanize(value: string | null | undefined, fallback: string) {
  const text = String(value ?? "").trim();
  return text ? text.replaceAll("_", " ") : fallback;
}

function KeyValueGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "grid",
            gap: 6,
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(148, 163, 184, 0.16)",
            background: "rgba(7, 10, 15, 0.34)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.72, textTransform: "uppercase", color: "#64748B" }}>{item.label}</div>
          <div style={{ color: "#CBD5E1", fontSize: 13, lineHeight: 1.55 }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function DeviceTabNav({
  deviceId,
  activeTab,
}: {
  deviceId: string;
  activeTab: DeviceTabKey;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        padding: 8,
        borderRadius: 18,
        border: "1px solid rgba(148, 163, 184, 0.16)",
        background: "linear-gradient(180deg, rgba(16, 23, 34, 0.92), rgba(11, 16, 24, 0.92))",
      }}
    >
      {tabs.map((tab) => (
        <ControlActionLink
          key={tab.key}
          href={tab.key === "overview" ? `/devices/${deviceId}` : `/devices/${deviceId}?tab=${tab.key}`}
          tone={tab.key === activeTab ? "primary" : "ghost"}
        >
          {tab.label}
        </ControlActionLink>
      ))}
    </div>
  );
}

function updateTone(label: string): ControlStatusTone {
  const value = label.toLowerCase();
  if (value.includes("current")) return "success";
  if (value.includes("pinned") || value.includes("below")) return "danger";
  if (value.includes("unknown") || value.includes("format")) return "warning";
  return "neutral";
}

export default async function DeviceDetailPage({ params, searchParams }: Props) {
  const { deviceId } = await params;
  const query = (await searchParams) ?? {};
  const activeTab = normalizeTab(query.tab);
  const { context, device, tokens, auditRows, supportRows } = await loadDeviceDetail(deviceId);

  if (!context.isPlatformAdmin) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Devices"
          title="Device Detail"
          description="This page stays restricted to platform-admin sessions because it exposes device token and cross-shop authority details."
          actions={<ControlActionLink href="/devices">Back to devices</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="Platform admin access required"
            description="Sign in with a platform-admin AAL2 session to review device enrollment and token details."
          />
        </ControlPanel>
      </div>
    );
  }

  if (!device) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Devices"
          title="Device Not Found"
          description="The requested device record is not available inside the current Control scope."
          actions={<ControlActionLink href="/devices">Back to devices</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="Choose a different device"
            description="Return to the Devices directory and open a device that still exists in Control."
          />
        </ControlPanel>
      </div>
    );
  }

  const activeToken = tokens.find((token) => !token.revoked_at) ?? null;
  const capability = device.capability;
  const capabilityDetails = capabilityMessages(capability);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Device Profile"
        title={device.name}
        description="Cloud authority profile for enrollment, token lifecycle, update posture, and capability telemetry."
        actions={[
          <ControlActionLink key="back" href="/devices">Back to devices</ControlActionLink>,
          device.device_type?.toLowerCase() === "workstation"
            ? <ControlActionLink key="workstations" href="/workstations" tone="secondary">Open workstations</ControlActionLink>
            : <ControlActionLink key="shop" href={device.shop_id ? `/shops/${device.shop_id}` : "/shops"} tone="secondary">Open shop</ControlActionLink>,
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="Status" value={humanize(device.status, "Unknown")} meta={device.access_reason} tone={String(device.status ?? "").toLowerCase() === "active" ? "success" : "danger"} />
        <ControlMetricCard label="Last Check-In" value={device.merged_last_seen_at ? formatMaybeDate(device.merged_last_seen_at) : "Not surfaced"} meta="Merged from device and active-token heartbeat data." tone={device.merged_last_seen_at ? "success" : "warning"} />
        <ControlMetricCard label="Version" value={device.reported_version ?? "Not surfaced"} meta={device.update_detail} tone={updateTone(device.update_label)} />
        <ControlMetricCard label="Access Mode" value={device.access_mode} meta={device.shop_snapshot ? `${device.shop_name ?? device.shop_id ?? "Shop"} access decision.` : "Shop access snapshot not available."} tone={device.access_mode.toLowerCase() === "full" ? "success" : device.access_mode.toLowerCase() === "blocked" ? "danger" : "warning"} />
      </div>

      <DeviceTabNav deviceId={device.id} activeTab={activeTab} />

      {activeTab === "overview" ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)", gap: 18 }}>
            <ControlPanel
              title="Device Identity"
              description="Core Control-side identity and authority context for this enrolled device."
            >
              <KeyValueGrid
                items={[
                  { label: "Display Name", value: device.name },
                  { label: "Device Type", value: humanize(device.device_type, "Not surfaced") },
                  { label: "Shop", value: device.shop_name ?? device.shop_id ?? "Not surfaced" },
                  { label: "Status", value: <ControlStatusChip label={humanize(device.status, "Unknown")} tone={String(device.status ?? "").toLowerCase() === "active" ? "success" : "danger"} /> },
                  { label: "Last Seen", value: formatMaybeDate(device.merged_last_seen_at) },
                  { label: "App Version", value: device.reported_version ?? "Not surfaced" },
                ]}
              />
            </ControlPanel>

            <ControlPanel
              title="Access and Entitlement"
              description="Effective device access posture based on the shop-level Control access decision."
            >
              <KeyValueGrid
                items={[
                  { label: "Access Mode", value: device.access_mode },
                  { label: "Entitlement Status", value: device.shop_snapshot?.access.display_status ?? "Not surfaced" },
                  { label: "Billing Status", value: humanize(device.shop_snapshot?.billing_status, "Not surfaced") },
                  { label: "Access Summary", value: device.access_reason },
                  { label: "Update Status", value: <ControlStatusChip label={device.update_label} tone={updateTone(device.update_label)} /> },
                  { label: "Capability Status", value: <ControlStatusChip label={capabilityStatusLabel(capability)} tone={capability ? (String(capability.requirements_status ?? "").toLowerCase() === "warning" ? "warning" : String(capability.requirements_status ?? "").toLowerCase().startsWith("fail") ? "danger" : "success") : "neutral"} /> },
                ]}
              />
            </ControlPanel>
          </div>

          <ControlPanel
            title="Current Actions"
            description="Use the existing safe device-admin routes to issue tokens, change status, or remove the device."
          >
            <DeviceAdminActionsPanel
              deviceId={device.id}
              deviceName={device.name}
              deviceStatus={device.status}
              activeTokenId={activeToken?.id ?? null}
            />
          </ControlPanel>
        </div>
      ) : null}

      {activeTab === "token" ? (
        <div style={{ display: "grid", gap: 18 }}>
          <DeviceAdminActionsPanel
            deviceId={device.id}
            deviceName={device.name}
            deviceStatus={device.status}
            activeTokenId={activeToken?.id ?? null}
          />

          <ControlPanel
            title="Token and Enrollment"
            description="Issued token records and the current enrollment state recorded in Control."
          >
            <KeyValueGrid
              items={[
                { label: "Enrollment Status", value: humanize(device.status, "Unknown") },
                { label: "Active Token", value: activeToken ? "Present" : "No active token" },
                { label: "Active Token Seen", value: formatMaybeDate(device.latest_token_seen_at) },
                { label: "Latest Token Issued", value: formatMaybeDate(device.latest_token_issued_at) },
              ]}
            />

            {tokens.length === 0 ? (
              <ControlEmptyState
                title="No token records"
                description="This device does not have any token rows recorded in Control yet."
              />
            ) : (
              <ControlTableWrap>
                <ControlTable minWidth={920}>
                  <thead>
                    <tr>
                      <ControlTableHeadCell>Token</ControlTableHeadCell>
                      <ControlTableHeadCell>Label</ControlTableHeadCell>
                      <ControlTableHeadCell>Issued</ControlTableHeadCell>
                      <ControlTableHeadCell>Last Seen</ControlTableHeadCell>
                      <ControlTableHeadCell>Status</ControlTableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((token) => (
                      <tr key={token.id}>
                        <ControlTableCell>{token.id}</ControlTableCell>
                        <ControlTableCell>{token.label ?? "Not surfaced"}</ControlTableCell>
                        <ControlTableCell>{formatMaybeDate(token.issued_at ?? token.created_at)}</ControlTableCell>
                        <ControlTableCell>{formatMaybeDate(token.last_seen_at)}</ControlTableCell>
                        <ControlTableCell>
                          <ControlStatusChip label={token.revoked_at ? "Revoked" : "Active"} tone={token.revoked_at ? "danger" : "success"} />
                        </ControlTableCell>
                      </tr>
                    ))}
                  </tbody>
                </ControlTable>
              </ControlTableWrap>
            )}
          </ControlPanel>
        </div>
      ) : null}

      {activeTab === "capability" ? (
        <ControlPanel
          title="Capability Snapshot"
          description="Latest machine capability report recorded for this device. If nothing is shown here, Control is not currently receiving capability snapshots."
        >
          {!capability ? (
            <ControlEmptyState
              title="Capability snapshot not surfaced"
              description="No capability snapshot is currently available for this device in the active schema."
            />
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              <KeyValueGrid
                items={[
                  { label: "Reported At", value: formatMaybeDate(capability.reported_at) },
                  { label: "OS", value: [capability.os_name, capability.os_version].filter(Boolean).join(" ") || "Not surfaced" },
                  { label: "CPU Model", value: capability.cpu_model ?? "Not surfaced" },
                  { label: "Logical Cores", value: capability.logical_cores !== null ? String(capability.logical_cores) : "Not surfaced" },
                  { label: "RAM", value: formatBytes(capability.total_ram_bytes) },
                  { label: "Disk Total", value: formatBytes(capability.system_drive_total_bytes) },
                  { label: "Disk Free", value: formatBytes(capability.system_drive_free_bytes) },
                  { label: "GPU", value: capability.gpu_name ?? "Not surfaced" },
                  { label: "Requirement Status", value: <ControlStatusChip label={capabilityStatusLabel(capability)} tone={String(capability.requirements_status ?? "").toLowerCase() === "warning" ? "warning" : String(capability.requirements_status ?? "").toLowerCase().startsWith("fail") ? "danger" : "success"} /> },
                ]}
              />

              {capabilityDetails.length === 0 ? (
                <ControlEmptyState
                  title="No requirement messages"
                  description="The capability snapshot did not include explicit requirement warnings or failure messages."
                />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {capabilityDetails.map((message) => (
                    <div
                      key={message}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        border: "1px solid rgba(148, 163, 184, 0.16)",
                        background: "rgba(7, 10, 15, 0.34)",
                        color: "#CBD5E1",
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      {message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ControlPanel>
      ) : null}

      {activeTab === "updates" ? (
        <ControlPanel
          title="Updates"
          description="Current reported version and the shop-level update policy that affects this device."
        >
          <KeyValueGrid
            items={[
              { label: "Current Version", value: device.reported_version ?? "Not surfaced" },
              { label: "Minimum Required", value: device.update_policy?.min_version ?? "Not surfaced" },
              { label: "Pinned Version", value: device.update_policy?.pinned_version ?? "Not surfaced" },
              { label: "Update Channel", value: device.update_policy?.channel ?? "Not surfaced" },
              { label: "Update Status", value: <ControlStatusChip label={device.update_label} tone={updateTone(device.update_label)} /> },
              { label: "Blocked Reason", value: device.update_detail },
            ]}
          />
        </ControlPanel>
      ) : null}

      {activeTab === "audit" ? (
        <ControlPanel
          title="Audit"
          description="Recent audit rows related to this device when available."
          actions={<ControlActionLink href={`/audit?target_id=${encodeURIComponent(device.id)}`}>Open full audit log</ControlActionLink>}
        >
          {auditRows.length === 0 ? (
            <ControlEmptyState
              title="No recent device audit rows"
              description="Control does not currently show device-targeted audit rows for this device."
            />
          ) : (
            <ControlTableWrap>
              <ControlTable minWidth={920}>
                <thead>
                  <tr>
                    <ControlTableHeadCell>Action</ControlTableHeadCell>
                    <ControlTableHeadCell>Actor</ControlTableHeadCell>
                    <ControlTableHeadCell>Target</ControlTableHeadCell>
                    <ControlTableHeadCell>Recorded</ControlTableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <ControlTableCell>{humanize(row.action, "event")}</ControlTableCell>
                      <ControlTableCell>{row.actor_email ?? "System"}</ControlTableCell>
                      <ControlTableCell>{[row.target_type, row.target_id].filter(Boolean).join(" ") || "event"}</ControlTableCell>
                      <ControlTableCell>{formatMaybeDate(row.created_at)}</ControlTableCell>
                    </tr>
                  ))}
                </tbody>
              </ControlTable>
            </ControlTableWrap>
          )}
        </ControlPanel>
      ) : null}

      {activeTab === "support" ? (
        <ControlPanel
          title="Support"
          description="Shop-scoped support bundle metadata that may help troubleshoot this device."
          actions={<ControlActionLink href={device.shop_id ? `/support?shop=${encodeURIComponent(device.shop_id)}` : "/support"}>Open support area</ControlActionLink>}
        >
          {supportRows.length === 0 ? (
            <ControlEmptyState
              title="No related support bundles"
              description="Control does not currently have shop-scoped support bundle metadata recorded for this device's shop."
            />
          ) : (
            <ControlTableWrap>
              <ControlTable minWidth={900}>
                <thead>
                  <tr>
                    <ControlTableHeadCell>Bundle</ControlTableHeadCell>
                    <ControlTableHeadCell>Path</ControlTableHeadCell>
                    <ControlTableHeadCell>Uploaded By</ControlTableHeadCell>
                    <ControlTableHeadCell>Created</ControlTableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {supportRows.map((row) => (
                    <tr key={row.id}>
                      <ControlTableCell>{row.file_path ? row.file_path.split("/").filter(Boolean).pop() ?? row.file_path : "No stored path"}</ControlTableCell>
                      <ControlTableCell>{row.file_path ?? "Not surfaced"}</ControlTableCell>
                      <ControlTableCell>{row.uploaded_by ?? "Unknown"}</ControlTableCell>
                      <ControlTableCell>{formatMaybeDate(row.created_at)}</ControlTableCell>
                    </tr>
                  ))}
                </tbody>
              </ControlTable>
            </ControlTableWrap>
          )}
        </ControlPanel>
      ) : null}
    </div>
  );
}
