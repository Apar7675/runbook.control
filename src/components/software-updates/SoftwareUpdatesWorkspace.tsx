import React from "react";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import ControlTabNav from "@/components/control/ControlTabNav";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";

type WorkspaceTabKey = "overview" | "releases" | "devices" | "rollouts" | "upload-package" | "settings";

type ReleaseRow = {
  app: string;
  version: string;
  channel: string;
  status: string;
  required: string;
  released: string;
  packageName: string;
};

type DeviceRow = {
  device: string;
  shop: string;
  desktop: string;
  service: string;
  workstation: string;
  mobile: string;
  status: string;
  lastCheck: string;
};

type RolloutRow = {
  release: string;
  target: string;
  channel: string;
  required: string;
  status: string;
  starts: string;
  progress: string;
};

const tabItems = [
  { key: "overview", label: "Overview", href: "/software-updates?tab=overview" },
  { key: "releases", label: "Releases", href: "/software-updates?tab=releases" },
  { key: "devices", label: "Devices", href: "/software-updates?tab=devices" },
  { key: "rollouts", label: "Rollouts", href: "/software-updates?tab=rollouts" },
  { key: "upload-package", label: "Upload Package", href: "/software-updates?tab=upload-package" },
  { key: "settings", label: "Settings", href: "/software-updates?tab=settings" },
] as const;

const overviewStats = [
  { label: "Latest Desktop Version", value: "1.4.2", meta: "Stable channel package currently surfaced in local demo data.", tone: "success" },
  { label: "Latest Service Version", value: "1.4.2", meta: "Control-only release metadata placeholder for future service rollout approval.", tone: "success" },
  { label: "Latest Workstation Version", value: "1.4.2", meta: "Demo release visibility only. No local install behavior is wired.", tone: "success" },
  { label: "Mobile Minimum Version", value: "1.2.0", meta: "Control tracks current/minimum supported store versions, not app-store installs.", tone: "info" },
  { label: "Devices Current", value: "42", meta: "Sample count from local demo data until device update status is backed by the database.", tone: "success" },
  { label: "Devices Pending Update", value: "9", meta: "Devices behind an approved release in this Phase 1 mock workspace.", tone: "warning" },
  { label: "Failed Installs", value: "2", meta: "Placeholder operational visibility for future service-reported update outcomes.", tone: "danger" },
  { label: "Required Updates", value: "5", meta: "Demo count for releases flagged as required by rollout policy.", tone: "warning" },
] satisfies Array<{ label: string; value: string; meta: string; tone: ControlStatusTone }>;

const releaseRows: ReleaseRow[] = [
  { app: "Desktop", version: "1.4.2", channel: "stable", status: "active", required: "optional", released: "2026-05-18 09:10 ET", packageName: "RunBook.Desktop-1.4.2.zip" },
  { app: "Service", version: "1.4.2", channel: "stable", status: "active", required: "optional", released: "2026-05-18 09:10 ET", packageName: "RunBook.Service-1.4.2.zip" },
  { app: "Workstation", version: "1.4.2", channel: "stable", status: "active", required: "optional", released: "2026-05-18 09:10 ET", packageName: "RunBook.Workstation-1.4.2.zip" },
  { app: "Mobile", version: "1.2.0", channel: "stable", status: "minimum supported", required: "minimum", released: "2026-05-12 08:30 ET", packageName: "App store tracked" },
];

const deviceRows: DeviceRow[] = [
  { device: "RB-WS-014", shop: "Ten MFG East", desktop: "1.4.2", service: "1.4.2", workstation: "1.4.2", mobile: "1.2.0", status: "current", lastCheck: "2026-05-21 08:04 ET" },
  { device: "RB-WS-019", shop: "Ten MFG East", desktop: "1.4.1", service: "1.4.2", workstation: "1.4.1", mobile: "1.2.0", status: "pending update", lastCheck: "2026-05-21 07:42 ET" },
  { device: "RB-SVC-003", shop: "North River Fab", desktop: "n/a", service: "1.4.0", workstation: "n/a", mobile: "n/a", status: "required update", lastCheck: "2026-05-21 07:15 ET" },
  { device: "RB-MOB-221", shop: "North River Fab", desktop: "n/a", service: "n/a", workstation: "n/a", mobile: "1.1.8", status: "below minimum", lastCheck: "2026-05-20 18:11 ET" },
  { device: "RB-WS-030", shop: "Summit Tool", desktop: "1.4.2", service: "1.4.2", workstation: "1.4.2", mobile: "1.2.0", status: "install failed", lastCheck: "2026-05-21 06:58 ET" },
];

const rolloutRows: RolloutRow[] = [
  { release: "Desktop 1.4.2", target: "Pilot shops", channel: "stable", required: "optional", status: "approved", starts: "2026-05-22 21:00 ET", progress: "6/12 devices current" },
  { release: "Service 1.4.2", target: "All enrolled services", channel: "stable", required: "required", status: "awaiting start", starts: "2026-05-24 02:00 ET", progress: "0/18 started" },
  { release: "Workstation 1.4.2", target: "East region", channel: "stable", required: "optional", status: "in review", starts: "Not scheduled", progress: "Approval pending" },
  { release: "Mobile 1.2.0", target: "All mobile users", channel: "stable", required: "minimum", status: "published policy", starts: "2026-05-12 08:30 ET", progress: "Store version floor only" },
];

function toneForStatus(value: string): ControlStatusTone {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("failed") || normalized.includes("below minimum")) return "danger";
  if (normalized.includes("required") || normalized.includes("pending") || normalized.includes("review")) return "warning";
  if (normalized.includes("approved") || normalized.includes("active") || normalized.includes("current")) return "success";
  if (normalized.includes("minimum")) return "info";
  return "neutral";
}

function fieldLabel(label: string) {
  return (
    <div style={{ color: t.color.textMuted, fontSize: 11, fontWeight: 800, letterSpacing: 0.45, textTransform: "uppercase" }}>
      {label}
    </div>
  );
}

function plannedField(children: React.ReactNode) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: 10,
        borderRadius: t.radius.sm,
        border: `1px solid ${t.color.softBorder}`,
        background: "rgba(7, 10, 15, 0.34)",
      }}
    >
      {children}
    </div>
  );
}

function disabledInputStyle(multiline = false): React.CSSProperties {
  return {
    width: "100%",
    minHeight: multiline ? 104 : 36,
    padding: "9px 11px",
    borderRadius: 8,
    border: `1px solid ${t.color.softBorder}`,
    background: "rgba(15, 23, 36, 0.88)",
    color: t.color.textSecondary,
    fontSize: 12.5,
    opacity: 0.7,
  };
}

function OverviewTab() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {overviewStats.map((item) => (
          <ControlMetricCard key={item.label} label={item.label} value={item.value} meta={item.meta} tone={item.tone} />
        ))}
      </div>

      <ControlPanel
        title="Phase 1 scope"
        description="Control is only surfacing release metadata, rollout approval posture, and device-reported update status in this pass. Download, verification, staging, and installation remain future Service-owned behaviors."
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ControlStatusChip label="Local demo data" tone="warning" />
          <ControlStatusChip label="No install logic" tone="neutral" />
          <ControlStatusChip label="No package upload wiring" tone="neutral" />
        </div>
      </ControlPanel>
    </div>
  );
}

function ReleasesTab() {
  return (
    <ControlPanel
      title="Release catalog"
      description="Local demo rows show how Control will present release tracking, package metadata visibility, and rollout approvals once database-backed data is connected."
    >
      <ControlTableWrap>
        <ControlTable minWidth={980}>
          <thead>
            <tr>
              <ControlTableHeadCell>Version</ControlTableHeadCell>
              <ControlTableHeadCell>App</ControlTableHeadCell>
              <ControlTableHeadCell>Channel</ControlTableHeadCell>
              <ControlTableHeadCell>Status</ControlTableHeadCell>
              <ControlTableHeadCell>Required</ControlTableHeadCell>
              <ControlTableHeadCell>Released</ControlTableHeadCell>
              <ControlTableHeadCell>Package</ControlTableHeadCell>
              <ControlTableHeadCell align="right">Actions</ControlTableHeadCell>
            </tr>
          </thead>
          <tbody>
            {releaseRows.map((row) => (
              <tr key={`${row.app}-${row.version}`}>
                <ControlTableCell>{row.version}</ControlTableCell>
                <ControlTableCell>{row.app}</ControlTableCell>
                <ControlTableCell>{row.channel}</ControlTableCell>
                <ControlTableCell>
                  <ControlStatusChip label={row.status} tone={toneForStatus(row.status)} />
                </ControlTableCell>
                <ControlTableCell>
                  <ControlStatusChip label={row.required} tone={toneForStatus(row.required)} />
                </ControlTableCell>
                <ControlTableCell>{row.released}</ControlTableCell>
                <ControlTableCell>{row.packageName}</ControlTableCell>
                <ControlTableCell align="right">
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ color: t.color.textMuted, fontSize: 12 }}>Phase 1 view only</span>
                  </div>
                </ControlTableCell>
              </tr>
            ))}
          </tbody>
        </ControlTable>
      </ControlTableWrap>
    </ControlPanel>
  );
}

function DevicesTab() {
  return (
    <ControlPanel
      title="Device update status"
      description="Sample rows show how Control can become the remote visibility layer for reported desktop, service, workstation, and mobile versions without taking on local installation authority."
    >
      <ControlTableWrap>
        <ControlTable minWidth={1120}>
          <thead>
            <tr>
              <ControlTableHeadCell>Device</ControlTableHeadCell>
              <ControlTableHeadCell>Shop</ControlTableHeadCell>
              <ControlTableHeadCell>Desktop</ControlTableHeadCell>
              <ControlTableHeadCell>Service</ControlTableHeadCell>
              <ControlTableHeadCell>Workstation</ControlTableHeadCell>
              <ControlTableHeadCell>Mobile</ControlTableHeadCell>
              <ControlTableHeadCell>Status</ControlTableHeadCell>
              <ControlTableHeadCell>Last Check</ControlTableHeadCell>
            </tr>
          </thead>
          <tbody>
            {deviceRows.map((row) => (
              <tr key={row.device}>
                <ControlTableCell>{row.device}</ControlTableCell>
                <ControlTableCell>{row.shop}</ControlTableCell>
                <ControlTableCell>{row.desktop}</ControlTableCell>
                <ControlTableCell>{row.service}</ControlTableCell>
                <ControlTableCell>{row.workstation}</ControlTableCell>
                <ControlTableCell>{row.mobile}</ControlTableCell>
                <ControlTableCell>
                  <ControlStatusChip label={row.status} tone={toneForStatus(row.status)} />
                </ControlTableCell>
                <ControlTableCell>{row.lastCheck}</ControlTableCell>
              </tr>
            ))}
          </tbody>
        </ControlTable>
      </ControlTableWrap>
    </ControlPanel>
  );
}

function RolloutsTab() {
  return (
    <ControlPanel
      title="Rollout approvals"
      description="This Phase 1 table is a structural placeholder for release targeting, required-policy review, and approval state before any service-side install implementation exists."
    >
      <ControlTableWrap>
        <ControlTable minWidth={980}>
          <thead>
            <tr>
              <ControlTableHeadCell>Release</ControlTableHeadCell>
              <ControlTableHeadCell>Target</ControlTableHeadCell>
              <ControlTableHeadCell>Channel</ControlTableHeadCell>
              <ControlTableHeadCell>Required</ControlTableHeadCell>
              <ControlTableHeadCell>Status</ControlTableHeadCell>
              <ControlTableHeadCell>Starts</ControlTableHeadCell>
              <ControlTableHeadCell>Progress</ControlTableHeadCell>
            </tr>
          </thead>
          <tbody>
            {rolloutRows.map((row) => (
              <tr key={`${row.release}-${row.target}`}>
                <ControlTableCell>{row.release}</ControlTableCell>
                <ControlTableCell>{row.target}</ControlTableCell>
                <ControlTableCell>{row.channel}</ControlTableCell>
                <ControlTableCell>
                  <ControlStatusChip label={row.required} tone={toneForStatus(row.required)} />
                </ControlTableCell>
                <ControlTableCell>
                  <ControlStatusChip label={row.status} tone={toneForStatus(row.status)} />
                </ControlTableCell>
                <ControlTableCell>{row.starts}</ControlTableCell>
                <ControlTableCell>{row.progress}</ControlTableCell>
              </tr>
            ))}
          </tbody>
        </ControlTable>
      </ControlTableWrap>
    </ControlPanel>
  );
}

function UploadPackageTab() {
  return (
    <ControlPanel
      title="Upload package"
      description="Planned for Phase 2. The intended package metadata form is shown here so database and storage wiring can be attached later without redesigning this workspace."
      actions={<ControlStatusChip label="Phase 2 planned" tone="warning" />}
    >
      <fieldset disabled style={{ margin: 0, padding: 0, border: 0, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {plannedField(
            <>
              {fieldLabel("App")}
              <select defaultValue="Desktop" style={disabledInputStyle()}>
                <option>Desktop</option>
                <option>Service</option>
                <option>Workstation</option>
                <option>Mobile</option>
              </select>
            </>
          )}
          {plannedField(
            <>
              {fieldLabel("Version")}
              <input defaultValue="1.4.3" style={disabledInputStyle()} />
            </>
          )}
          {plannedField(
            <>
              {fieldLabel("Channel")}
              <select defaultValue="stable" style={disabledInputStyle()}>
                <option>stable</option>
                <option>beta</option>
                <option>pilot</option>
              </select>
            </>
          )}
          {plannedField(
            <>
              {fieldLabel("Package File")}
              <input defaultValue="Package upload not enabled yet" style={disabledInputStyle()} />
            </>
          )}
          {plannedField(
            <>
              {fieldLabel("SHA256 Checksum")}
              <input defaultValue="Pending real validation wiring" style={disabledInputStyle()} />
            </>
          )}
          {plannedField(
            <>
              {fieldLabel("Rollback Version")}
              <input defaultValue="1.4.2" style={disabledInputStyle()} />
            </>
          )}
        </div>

        {plannedField(
          <>
            {fieldLabel("Release Notes")}
            <textarea defaultValue="Planned textarea for release notes and operator-facing deployment context." style={disabledInputStyle(true)} />
          </>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center", color: t.color.textSecondary, fontSize: 12.5 }}>
            <input type="checkbox" checked readOnly />
            Publish as required update
          </label>
        </div>

        <div style={{ color: t.color.textMuted, fontSize: 12.5 }}>
          Package upload, storage persistence, checksum verification, and publish actions are intentionally disabled in this phase.
        </div>
      </fieldset>
    </ControlPanel>
  );
}

function SettingsTab() {
  return (
    <ControlPanel
      title="Update policy settings"
      description="These controls are nonfunctional placeholders for planned Control-managed configuration. They show the intended policy surface without claiming current enforcement."
      actions={<ControlStatusChip label="Planned configuration" tone="info" />}
    >
      <fieldset disabled style={{ margin: 0, padding: 0, border: 0, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {plannedField(
            <>
              {fieldLabel("Default Channel")}
              <select defaultValue="stable" style={disabledInputStyle()}>
                <option>stable</option>
                <option>beta</option>
                <option>pilot</option>
              </select>
            </>
          )}
          {plannedField(
            <>
              {fieldLabel("Auto-Check Interval")}
              <select defaultValue="Every 6 hours" style={disabledInputStyle()}>
                <option>Every hour</option>
                <option>Every 6 hours</option>
                <option>Every 12 hours</option>
                <option>Daily</option>
              </select>
            </>
          )}
          {plannedField(
            <>
              {fieldLabel("Maintenance Window")}
              <input defaultValue="02:00-04:00 local device time" style={disabledInputStyle()} />
            </>
          )}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center", color: t.color.textSecondary, fontSize: 12.5 }}>
            <input type="checkbox" checked readOnly />
            Require admin approval before install
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center", color: t.color.textSecondary, fontSize: 12.5 }}>
            <input type="checkbox" checked readOnly />
            Prevent updates while work is active
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center", color: t.color.textSecondary, fontSize: 12.5 }}>
            <input type="checkbox" checked readOnly />
            Require checksum validation
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center", color: t.color.textSecondary, fontSize: 12.5 }}>
            <input type="checkbox" checked readOnly />
            Require rollback package
          </label>
        </div>
      </fieldset>
    </ControlPanel>
  );
}

export default function SoftwareUpdatesWorkspace({
  activeTab,
}: {
  activeTab: WorkspaceTabKey;
}) {
  let content: React.ReactNode = <OverviewTab />;

  if (activeTab === "releases") content = <ReleasesTab />;
  if (activeTab === "devices") content = <DevicesTab />;
  if (activeTab === "rollouts") content = <RolloutsTab />;
  if (activeTab === "upload-package") content = <UploadPackageTab />;
  if (activeTab === "settings") content = <SettingsTab />;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ControlPageHeader
        eyebrow="Software Updates"
        title="Software Updates"
        description="Remote authority for RunBook release tracking, package metadata visibility, rollout approval, and device update status. This page is intentionally Phase 1 only and does not perform package upload or software installation."
        actions={<ControlActionLink href="/updates">Open legacy updates</ControlActionLink>}
      />

      <ControlPanel
        padding={12}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ControlStatusChip label="Local demo data" tone="warning" />
            <ControlStatusChip label="Phase 1 workspace" tone="info" />
          </div>
        }
      >
        <ControlTabNav activeKey={activeTab} items={tabItems.map((item) => ({ ...item }))} />
      </ControlPanel>

      {content}
    </div>
  );
}
