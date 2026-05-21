import React from "react";
import ControlActionButton, { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import ControlTabNav from "@/components/control/ControlTabNav";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";
import { activateSoftwareReleaseAction, retireSoftwareReleaseAction, saveSoftwareReleaseAction } from "@/app/(authed)/software-updates/actions";
import { buildDemoSoftwareUpdatesData, type SoftwareUpdatesWorkspaceData, type WorkspaceTabKey } from "@/lib/control/softwareUpdatesViews";

const tabItems = [
  { key: "overview", label: "Overview", href: "/software-updates?tab=overview" },
  { key: "releases", label: "Releases", href: "/software-updates?tab=releases" },
  { key: "devices", label: "Devices", href: "/software-updates?tab=devices" },
  { key: "rollouts", label: "Rollouts", href: "/software-updates?tab=rollouts" },
  { key: "upload-package", label: "Upload Package", href: "/software-updates?tab=upload-package" },
  { key: "settings", label: "Settings", href: "/software-updates?tab=settings" },
] as const;

const demoData = buildDemoSoftwareUpdatesData();

export type SoftwareReleaseEditorView = {
  mode: "new" | "edit" | null;
  flash: string;
  error: string;
  values: {
    release_id: string;
    app_name: string;
    version: string;
    channel: string;
    status: string;
    required: boolean;
    release_notes: string;
    minimum_supported_version: string;
    rollback_version: string;
  };
};

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

function inputStyle(multiline = false): React.CSSProperties {
  return {
    width: "100%",
    minHeight: multiline ? 104 : 36,
    padding: "9px 11px",
    borderRadius: 8,
    border: `1px solid ${t.color.softBorder}`,
    background: "rgba(7, 10, 15, 0.68)",
    color: t.color.text,
    fontSize: 12.5,
    outline: "none",
  };
}

function OverviewTab({ overviewStats, sourceKind }: { overviewStats: SoftwareUpdatesWorkspaceData["overviewStats"]; sourceKind: SoftwareUpdatesWorkspaceData["sourceKind"] }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {overviewStats.map((item) => (
          <ControlMetricCard key={item.label} label={item.label} value={item.value} meta={item.meta} tone={item.tone} />
        ))}
      </div>

      <ControlPanel
        title={sourceKind === "live" ? "Phase 2A foundation" : sourceKind === "mixed" ? "Phase 2A mixed source" : "Phase 1 scope"}
        description={sourceKind === "live"
          ? "This workspace is reading the new Control software update tables. Control remains the metadata and approval authority only; download and install behavior still belongs to future Service-owned execution paths."
          : sourceKind === "mixed"
            ? "Some sections are now reading the new Control software update tables, while empty sections continue to show local demo fallback data until records are available."
            : "Control is only surfacing release metadata, rollout approval posture, and device-reported update status in this pass. Download, verification, staging, and installation remain future Service-owned behaviors."}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ControlStatusChip label={sourceKind === "live" ? "Database-backed" : sourceKind === "mixed" ? "Mixed live + demo" : "Local demo data"} tone={sourceKind === "live" ? "success" : "warning"} />
          <ControlStatusChip label="No install logic" tone="neutral" />
          <ControlStatusChip label="No package upload wiring" tone="neutral" />
        </div>
      </ControlPanel>
    </div>
  );
}

function ReleasesTab({
  releaseRows,
  releaseRecords,
  sourceKind,
  releaseCrudEnabled,
  editor,
}: {
  releaseRows: SoftwareUpdatesWorkspaceData["releaseRows"];
  releaseRecords: SoftwareUpdatesWorkspaceData["releaseRecords"];
  sourceKind: SoftwareUpdatesWorkspaceData["sourceKind"];
  releaseCrudEnabled: boolean;
  editor: SoftwareReleaseEditorView;
}) {
  const showEditor = editor.mode === "new" || editor.mode === "edit";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ControlPanel
        title="Release catalog"
        description={sourceKind === "demo"
          ? "Local demo rows still appear when the schema is unavailable or no real release rows exist yet. If the schema is available, you can start creating real release metadata below."
          : "Release rows are reading from rb_software_releases and rb_software_packages when records are available."}
        actions={
          releaseCrudEnabled
            ? <ControlActionLink href="/software-updates?tab=releases&mode=new" tone="primary">New Release</ControlActionLink>
            : <ControlStatusChip label="Schema unavailable" tone="warning" />
        }
      >
        {editor.flash ? <div style={{ fontSize: 12.5, color: t.color.success }}>{editor.flash}</div> : null}
        {editor.error ? <div style={{ fontSize: 12.5, color: t.color.danger }}>{editor.error}</div> : null}

        {showEditor && releaseCrudEnabled ? (
          <div
            style={{
              display: "grid",
              gap: 12,
              padding: 12,
              borderRadius: t.radius.md,
              border: `1px solid ${t.color.softBorder}`,
              background: "rgba(7, 10, 15, 0.34)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ color: t.color.text, fontSize: 14, fontWeight: 800 }}>{editor.mode === "edit" ? "Edit Release" : "Create Release"}</div>
                <div style={{ color: t.color.textMuted, fontSize: 12.5 }}>
                  Release metadata stays in Control. No package upload or installation behavior is being added here.
                </div>
              </div>
              <ControlActionLink href="/software-updates?tab=releases">Cancel</ControlActionLink>
            </div>

            <form action={saveSoftwareReleaseAction} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="release_id" value={editor.values.release_id} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {plannedField(
                  <>
                    {fieldLabel("App")}
                    <select name="app_name" defaultValue={editor.values.app_name} style={inputStyle()}>
                      <option value="desktop">desktop</option>
                      <option value="service">service</option>
                      <option value="workstation">workstation</option>
                      <option value="mobile">mobile</option>
                      <option value="control">control</option>
                    </select>
                  </>
                )}
                {plannedField(
                  <>
                    {fieldLabel("Version")}
                    <input name="version" defaultValue={editor.values.version} style={inputStyle()} />
                  </>
                )}
                {plannedField(
                  <>
                    {fieldLabel("Channel")}
                    <select name="channel" defaultValue={editor.values.channel} style={inputStyle()}>
                      <option value="dev">dev</option>
                      <option value="beta">beta</option>
                      <option value="stable">stable</option>
                    </select>
                  </>
                )}
                {plannedField(
                  <>
                    {fieldLabel("Status")}
                    <select name="status" defaultValue={editor.values.status} style={inputStyle()}>
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="retired">retired</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </>
                )}
                {plannedField(
                  <>
                    {fieldLabel("Minimum Supported Version")}
                    <input name="minimum_supported_version" defaultValue={editor.values.minimum_supported_version} style={inputStyle()} />
                  </>
                )}
                {plannedField(
                  <>
                    {fieldLabel("Rollback Version")}
                    <input name="rollback_version" defaultValue={editor.values.rollback_version} style={inputStyle()} />
                  </>
                )}
              </div>

              {plannedField(
                <>
                  {fieldLabel("Release Notes")}
                  <textarea name="release_notes" defaultValue={editor.values.release_notes} style={inputStyle(true)} />
                </>
              )}

              <label style={{ display: "flex", gap: 10, alignItems: "center", color: t.color.textSecondary, fontSize: 12.5 }}>
                <input type="checkbox" name="required" value="true" defaultChecked={editor.values.required} />
                Mark as required update
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ControlActionButton type="submit" tone="primary">
                  {editor.mode === "edit" ? "Save Release" : "Create Release"}
                </ControlActionButton>
                <ControlActionLink href="/software-updates?tab=releases">Close</ControlActionLink>
              </div>
            </form>
          </div>
        ) : null}

        <ControlTableWrap>
          <ControlTable minWidth={1120}>
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
              {releaseRows.map((row) => {
                const record = releaseRecords.find((item) => item.id === row.id) ?? null;
                return (
                  <tr key={row.id ?? `${row.app}-${row.version}-${row.channel}`}>
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
                      {record && releaseCrudEnabled ? (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                          <ControlActionLink href={`/software-updates?tab=releases&mode=edit&release_id=${encodeURIComponent(record.id)}`}>Edit</ControlActionLink>
                          {record.status !== "active" ? (
                            <form action={activateSoftwareReleaseAction}>
                              <input type="hidden" name="release_id" value={record.id} />
                              <ControlActionButton type="submit" tone="secondary">Activate</ControlActionButton>
                            </form>
                          ) : null}
                          {record.status !== "retired" ? (
                            <form action={retireSoftwareReleaseAction}>
                              <input type="hidden" name="release_id" value={record.id} />
                              <ControlActionButton type="submit" tone="danger">Retire</ControlActionButton>
                            </form>
                          ) : null}
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ color: t.color.textMuted, fontSize: 12 }}>
                            {releaseCrudEnabled ? "No real row yet" : "Demo fallback only"}
                          </span>
                        </div>
                      )}
                    </ControlTableCell>
                  </tr>
                );
              })}
            </tbody>
          </ControlTable>
        </ControlTableWrap>
      </ControlPanel>
    </div>
  );
}

function DevicesTab({ deviceRows, sourceKind }: { deviceRows: SoftwareUpdatesWorkspaceData["deviceRows"]; sourceKind: SoftwareUpdatesWorkspaceData["sourceKind"] }) {
  return (
    <ControlPanel
      title="Device update status"
      description={sourceKind === "demo"
        ? "Sample rows show how Control can become the remote visibility layer for reported desktop, service, workstation, and mobile versions without taking on local installation authority."
        : "Device status rows are reading from rb_device_software_status when records are available, without giving Control local installation authority."}
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

function RolloutsTab({ rolloutRows, sourceKind }: { rolloutRows: SoftwareUpdatesWorkspaceData["rolloutRows"]; sourceKind: SoftwareUpdatesWorkspaceData["sourceKind"] }) {
  return (
    <ControlPanel
      title="Rollout approvals"
      description={sourceKind === "demo"
        ? "This Phase 1 table is a structural placeholder for release targeting, required-policy review, and approval state before any service-side install implementation exists."
        : "Rollout rows are reading from rb_software_rollouts when records are available. Approval metadata lives in Control; execution remains out of scope."}
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
  data = demoData,
  releaseEditor,
}: {
  activeTab: WorkspaceTabKey;
  data?: SoftwareUpdatesWorkspaceData;
  releaseEditor: SoftwareReleaseEditorView;
}) {
  let content: React.ReactNode = <OverviewTab overviewStats={data.overviewStats} sourceKind={data.sourceKind} />;

  if (activeTab === "releases") {
    content = (
      <ReleasesTab
        releaseRows={data.releaseRows}
        releaseRecords={data.releaseRecords}
        sourceKind={data.sourceKind}
        releaseCrudEnabled={data.releaseCrudEnabled}
        editor={releaseEditor}
      />
    );
  }
  if (activeTab === "devices") content = <DevicesTab deviceRows={data.deviceRows} sourceKind={data.sourceKind} />;
  if (activeTab === "rollouts") content = <RolloutsTab rolloutRows={data.rolloutRows} sourceKind={data.sourceKind} />;
  if (activeTab === "upload-package") content = <UploadPackageTab />;
  if (activeTab === "settings") content = <SettingsTab />;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ControlPageHeader
        eyebrow="Software Updates"
        title="Software Updates"
        description="Remote authority for RunBook release tracking, package metadata visibility, rollout approval, and device update status. Control metadata CRUD is enabled here, but package upload and software installation remain out of scope."
        actions={<ControlActionLink href="/updates">Open legacy updates</ControlActionLink>}
      />

      <ControlPanel
        padding={12}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ControlStatusChip label={data.sourceKind === "live" ? "Database-backed" : data.sourceKind === "mixed" ? "Mixed source" : "Local demo data"} tone={data.sourceKind === "live" ? "success" : data.sourceKind === "mixed" ? "warning" : "warning"} />
            <ControlStatusChip label="Phase 2B workspace" tone="info" />
          </div>
        }
      >
        <ControlTabNav activeKey={activeTab} items={tabItems.map((item) => ({ ...item }))} />
      </ControlPanel>

      {content}
    </div>
  );
}
