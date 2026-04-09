import React from "react";
import {
  ActionLink,
  Icon,
  EmptyState,
  MetricCard,
  PageHeader,
  SectionBlock,
  StatusBadge,
  toneFromStatus,
} from "@/components/control/ui";
import { getPlatformSnapshot, getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";
import { formatDateTime } from "@/lib/ui/dates";
import { theme } from "@/lib/ui/theme";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function priorityTone(priority: "high" | "medium" | "low") {
  return priority === "high" ? "critical" : priority === "medium" ? "warning" : "neutral";
}

export default async function DashboardPage() {
  const context = await getViewerContext();
  const primaryShop = selectPrimaryShop(context.shops);
  const shopSnapshot = primaryShop ? await getShopSnapshot(primaryShop) : null;
  const platformSnapshot = context.isPlatformAdmin ? await getPlatformSnapshot(context) : null;

  if (!primaryShop || !shopSnapshot) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <PageHeader
          eyebrow="Dashboard"
          title="RunBook Control"
          description="This command center becomes useful once a shop is connected. Start by creating or joining a shop."
          actions={<ActionLink href="/shops" tone="primary">Open Shop Setup</ActionLink>}
        />
        <EmptyState
          title="No shop connected yet"
          description="Create a shop first, then add people, register devices, and confirm billing access."
          action={<ActionLink href="/shops" tone="primary">Go to Shop</ActionLink>}
        />
      </div>
    );
  }

  const billingLabel =
    shopSnapshot.access.state === "active" || shopSnapshot.access.state === "trialing"
      ? "Billing Healthy"
      : shopSnapshot.access.state === "grace"
      ? "Billing Needs Review"
      : "Billing Restricted";

  const appLabel =
    shopSnapshot.access.workstation_mode !== "full"
      ? "Workstation Degraded"
      : shopSnapshot.access.mobile_mode !== "full"
      ? "Mobile Restricted"
      : shopSnapshot.access.desktop_mode !== "full"
      ? "Desktop Reduced"
      : "All Connected";

  const devicesLabel =
    shopSnapshot.health.offline_devices > 0
      ? "Devices Need Review"
      : shopSnapshot.health.stale_devices > 0
      ? "Devices Need Attention"
      : "Devices Healthy";

  const employeeAccessGap = Math.max(0, shopSnapshot.counts.employees_active - shopSnapshot.counts.employees_workstation_ready);
  const peopleLabel =
    shopSnapshot.counts.employees_total === 0
      ? "People Setup Pending"
      : employeeAccessGap > 0
      ? "People Need Access Review"
      : "People Ready";

  const actionItems = [
    shopSnapshot.health.offline_devices > 0
      ? {
          title: `${shopSnapshot.health.offline_devices} Device${shopSnapshot.health.offline_devices === 1 ? "" : "s"} Offline`,
          reason: "These devices have stopped checking in and need review now.",
          href: "/devices",
          cta: "Review Devices",
          priority: "high" as const,
        }
      : null,
    shopSnapshot.health.stale_devices > 0
      ? {
          title: `${shopSnapshot.health.stale_devices} Device${shopSnapshot.health.stale_devices === 1 ? "" : "s"} Need Review`,
          reason: "These devices are going stale and should be checked before they go offline.",
          href: "/devices",
          cta: "Check Device Health",
          priority: "medium" as const,
        }
      : null,
    employeeAccessGap > 0
      ? {
          title: `${employeeAccessGap} Employee${employeeAccessGap === 1 ? "" : "s"} Need${employeeAccessGap === 1 ? "s" : ""} Access Review`,
          reason: "Some active employees still need workstation access review before setup is complete.",
          href: "/people",
          cta: "Fix Employee Access",
          priority: "medium" as const,
        }
      : null,
    shopSnapshot.access.workstation_mode !== "full"
      ? {
          title: "Workstation Access Needs Attention",
          reason: "Workstation sign-in is not fully ready and should be reviewed before going live.",
          href: "/apps",
          cta: "Review App Access",
          priority: "high" as const,
        }
      : null,
    shopSnapshot.access.state === "grace" || shopSnapshot.access.state === "restricted" || shopSnapshot.access.state === "expired"
      ? {
          title: "Billing Needs Review",
          reason: "Billing is affecting app access and should be reviewed before troubleshooting anything else.",
          href: "/billing-access",
          cta: "Open Billing",
          priority: "high" as const,
        }
      : shopSnapshot.access.state === "trialing" && shopSnapshot.trial_ends_at
      ? {
          title: "Trial Ending Soon",
          reason: `Current trial access ends ${formatDate(shopSnapshot.trial_ends_at)}.`,
          href: "/billing-access",
          cta: "Review Billing",
          priority: "medium" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    reason: string;
    href: string;
    cta: string;
    priority: "high" | "medium" | "low";
  }>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <PageHeader
        eyebrow="Dashboard"
        title={context.isPlatformAdmin ? "RunBook Command Center" : `${shopSnapshot.name} Command Center`}
        description={`Understand what needs action first, what apps are healthy, and where to go next.${context.isPlatformAdmin ? ` You currently manage ${platformSnapshot?.manageableShopCount ?? 0} shops.` : ""}`}
        actions={
          <>
            <ActionLink href="/people" tone="primary" icon="people">Add Employee</ActionLink>
            <ActionLink href="/devices" icon="devices">Register Device</ActionLink>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <MetricCard
          title="Billing"
          value={billingLabel}
          summary={
            billingLabel === "Billing Healthy"
              ? "No billing action is needed right now."
              : "Billing is currently affecting access and needs review."
          }
          href="/billing-access"
          badge={<StatusBadge label={billingLabel} tone={toneFromStatus(billingLabel)} />}
          tone={billingLabel === "Billing Healthy" ? "healthy" : "critical"}
        />
        <MetricCard
          title="Apps"
          value={appLabel}
          summary={appLabel === "All Connected" ? "All core app paths are operating normally." : "At least one app flow needs review."}
          href="/apps"
          badge={<StatusBadge label={appLabel} tone={toneFromStatus(appLabel)} />}
          tone={appLabel === "All Connected" ? "subtle" : "critical"}
        />
        <MetricCard
          title="Devices"
          value={devicesLabel}
          summary={
            shopSnapshot.health.offline_devices > 0
              ? `${shopSnapshot.health.offline_devices} offline right now.`
              : shopSnapshot.health.stale_devices > 0
              ? `${shopSnapshot.health.stale_devices} stale and should be reviewed soon.`
              : `${shopSnapshot.counts.devices_active} active of ${shopSnapshot.counts.devices_total} total.`
          }
          href="/devices"
          badge={<StatusBadge label={devicesLabel} tone={toneFromStatus(devicesLabel)} />}
          tone={shopSnapshot.health.offline_devices > 0 ? "critical" : shopSnapshot.health.stale_devices > 0 ? "warning" : "healthy"}
        />
        <MetricCard
          title="People"
          value={peopleLabel}
          summary={
            shopSnapshot.counts.employees_total === 0
              ? "No employees have been added yet."
              : employeeAccessGap > 0
              ? `${employeeAccessGap} employee${employeeAccessGap === 1 ? "" : "s"} need${employeeAccessGap === 1 ? "s" : ""} workstation review.`
              : `${shopSnapshot.counts.employees_active} active and ready.`
          }
          href="/people"
          badge={<StatusBadge label={peopleLabel} tone={toneFromStatus(peopleLabel)} />}
          tone={employeeAccessGap > 0 ? "warning" : shopSnapshot.counts.employees_total === 0 ? "subtle" : "healthy"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14 }}>
        <SectionBlock
          title="Action Required"
          description="This is the operational heartbeat of the page."
          tone={actionItems.length > 0 ? "critical" : "healthy"}
        >
          <div style={{ display: "grid", gap: 10 }}>
            {actionItems.length === 0 ? (
              <div
                style={{
                  border: "1px solid rgba(86, 220, 154, 0.14)",
                  borderRadius: 14,
                  background: "linear-gradient(180deg, rgba(84,196,138,0.08), rgba(255,255,255,0.02))",
                  padding: "14px 14px 13px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <StatusBadge label="Healthy" tone="healthy" />
                <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.24 }}>No urgent action is needed right now</div>
                <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.5, fontSize: 13 }}>
                  Billing, apps, devices, and people all look ready. You can move on to routine review.
                </div>
              </div>
            ) : (
              actionItems.map((item) => (
                <div
                  key={item.title}
                  style={{
                    borderRadius: 16,
                    padding: "0 12px 0 0",
                    display: "grid",
                    gridTemplateColumns: "6px 1fr",
                    border: item.priority === "high" ? theme.border.critical : theme.border.warning,
                    background:
                      (item.priority === "high"
                        ? "radial-gradient(circle at top right, rgba(255,120,120,0.12), transparent 30%), linear-gradient(180deg, rgba(60,20,26,0.94), rgba(22,16,24,0.95))"
                        : "radial-gradient(circle at top right, rgba(255,196,107,0.10), transparent 30%), linear-gradient(180deg, rgba(43,31,17,0.88), rgba(18,15,22,0.95))"),
                    boxShadow: item.priority === "high" ? theme.shadow.critical : theme.shadow.warning,
                  }}
                >
                  <div
                    style={{
                      borderRadius: "16px 0 0 16px",
                      background: item.priority === "high" ? "linear-gradient(180deg, rgba(255,129,129,0.98), rgba(255,84,84,0.56))" : "linear-gradient(180deg, rgba(255,205,120,0.98), rgba(255,170,62,0.48))",
                      boxShadow: item.priority === "high" ? "0 0 18px rgba(255,120,120,0.24)" : "0 0 16px rgba(255,196,107,0.16)",
                    }}
                  />
                  <div style={{ display: "grid", gap: 12, padding: "14px 0 14px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <StatusBadge label={item.priority === "high" ? "Action Needed" : "Warning"} tone={priorityTone(item.priority)} />
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              color: item.priority === "high" ? "#ffd8d8" : "#ffe2b2",
                              fontSize: 10,
                              fontWeight: 900,
                              letterSpacing: 0.7,
                              textTransform: "uppercase",
                            }}
                          >
                            <Icon name={item.priority === "high" ? "warning" : "activity"} size={14} tone={item.priority === "high" ? "critical" : "warning"} />
                            <span>{item.priority === "high" ? "Immediate Review" : "Queue Next"}</span>
                          </div>
                        </div>
                        <div style={{ fontWeight: 950, fontSize: 17, lineHeight: 1.08, letterSpacing: -0.28, color: "#f7f9ff" }}>
                          {item.title}
                        </div>
                        <div style={{ color: item.priority === "high" ? "rgba(255,234,234,0.84)" : "rgba(255,238,209,0.80)", lineHeight: 1.48, fontSize: 13, maxWidth: 640 }}>
                          {item.reason}
                        </div>
                      </div>
                      <ActionLink href={item.href} icon="arrow" tone={item.priority === "high" ? "primary" : "secondary"}>
                        {item.cta}
                      </ActionLink>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 10,
                        alignItems: "center",
                        paddingTop: 10,
                        borderTop: item.priority === "high" ? "1px solid rgba(255,120,120,0.14)" : "1px solid rgba(255,196,107,0.14)",
                      }}
                    >
                      <div style={{ color: theme.text.quiet, fontSize: 11, fontWeight: 800, letterSpacing: 0.24 }}>
                        {item.priority === "high"
                          ? "Priority path: resolve this before deeper troubleshooting."
                          : "Next-up path: review this before it becomes blocking."}
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          color: item.priority === "high" ? "#ffd2d2" : "#ffe7be",
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: 0.28,
                        }}
                      >
                        <span>{item.priority === "high" ? "Priority High" : "Priority Medium"}</span>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: item.priority === "high" ? "#ff8e8e" : "#ffc968",
                            boxShadow: item.priority === "high" ? "0 0 16px rgba(255,120,120,0.36)" : "0 0 14px rgba(255,196,107,0.28)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionBlock>

        <SectionBlock
          title="Connected Apps"
          description="Answer the real question: is the system working?"
          tone="subtle"
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Desktop</div>
              <div style={{ opacity: 0.82, lineHeight: 1.5 }}>
                {shopSnapshot.access.desktop_mode === "full"
                  ? "Desktop is connected and ready."
                  : "Desktop is connected, but access is reduced right now."}
              </div>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Workstation</div>
              <div style={{ opacity: 0.82, lineHeight: 1.5 }}>
                {shopSnapshot.access.workstation_mode === "full"
                  ? "Workstation is ready for employee sign-in."
                  : "Workstation is not ready and needs review."}
              </div>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Mobile</div>
              <div style={{ opacity: 0.82, lineHeight: 1.5 }}>
                {shopSnapshot.access.mobile_mode === "full"
                  ? "Mobile is available to eligible employees."
                  : shopSnapshot.access.mobile_mode === "queue_only"
                  ? "Mobile is running in a restricted queue-only state."
                  : "Mobile access is blocked right now."}
              </div>
            </div>
            <div style={{ marginTop: 2 }}>
              <ActionLink href="/apps" icon="apps">Open App Status</ActionLink>
            </div>
          </div>
        </SectionBlock>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.1fr", gap: 18 }}>
        <SectionBlock
          title="Access Summary"
          description="Translate system state into meaning."
          tone="subtle"
        >
          <div style={{ display: "grid", gap: 10, color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>
            <div>Desktop: {shopSnapshot.access.desktop_mode === "full" ? "Ready" : "Reduced Access"}</div>
            <div>Workstation: {shopSnapshot.access.workstation_mode === "full" ? "Ready" : "Needs Attention"}</div>
            <div>Mobile: {shopSnapshot.access.mobile_mode === "full" ? "Ready" : shopSnapshot.access.mobile_mode === "queue_only" ? "Restricted" : "Blocked"}</div>
          </div>
        </SectionBlock>

        <SectionBlock
          title="Billing Summary"
          description="Keep only the billing facts that matter right now."
          tone="subtle"
        >
          <div style={{ display: "grid", gap: 10, color: "rgba(230,232,239,0.84)", lineHeight: 1.55 }}>
            <div>Status: {billingLabel}</div>
            <div>Next billing date: {formatDate(shopSnapshot.billing_current_period_end)}</div>
            {shopSnapshot.trial_ends_at ? <div>Trial ends: {formatDate(shopSnapshot.trial_ends_at)}</div> : null}
          </div>
        </SectionBlock>

        <SectionBlock
          title="Operational Next Steps"
          description="Keep the next steps direct and clickable."
          tone="default"
        >
          <div style={{ display: "grid", gap: 10 }}>
            <a
              href="/devices"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "grid",
                gap: 4,
                padding: "12px 12px 11px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "transform 140ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 14 }}>
                  <Icon name="devices" size={15} tone="neutral" />
                  <span>Review Devices</span>
                </div>
                <Icon name="arrow" size={14} tone="neutral" />
              </div>
              <div style={{ color: "rgba(230,232,239,0.78)", lineHeight: 1.45 }}>
                {shopSnapshot.health.offline_devices > 0
                  ? `${shopSnapshot.health.offline_devices} devices are offline.`
                  : shopSnapshot.health.stale_devices > 0
                  ? `${shopSnapshot.health.stale_devices} devices are stale.`
                  : "All devices are checking in normally."}
              </div>
            </a>
            <a
              href="/people"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "grid",
                gap: 4,
                padding: "12px 12px 11px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "transform 140ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 14 }}>
                  <Icon name="people" size={15} tone="neutral" />
                  <span>Open People</span>
                </div>
                <Icon name="arrow" size={14} tone="neutral" />
              </div>
              <div style={{ color: "rgba(230,232,239,0.78)", lineHeight: 1.45 }}>
                {employeeAccessGap > 0
                  ? `${employeeAccessGap} employee${employeeAccessGap === 1 ? "" : "s"} need${employeeAccessGap === 1 ? "s" : ""} workstation access review.`
                  : "People access is currently in good shape."}
              </div>
            </a>
            <a
              href="/billing-access"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "grid",
                gap: 4,
                padding: "12px 12px 11px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "transform 140ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 14 }}>
                  <Icon name="billing" size={15} tone="neutral" />
                  <span>Open Billing & Access</span>
                </div>
                <Icon name="arrow" size={14} tone="neutral" />
              </div>
              <div style={{ color: "rgba(230,232,239,0.78)", lineHeight: 1.45 }}>
                Confirm billing details before going live or before troubleshooting blocked access.
              </div>
            </a>
          </div>
        </SectionBlock>
      </div>

      {context.isPlatformAdmin && platformSnapshot ? (
        <SectionBlock
          title="Platform Snapshot"
          description="Secondary platform metrics for advanced admins."
          tone="subtle"
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, opacity: 0.84 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, opacity: 0.62, textTransform: "uppercase", fontWeight: 900, letterSpacing: 0.78 }}>Managed Shops</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{platformSnapshot.manageableShopCount}</div>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, opacity: 0.62, textTransform: "uppercase", fontWeight: 900, letterSpacing: 0.78 }}>All Shops</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{platformSnapshot.shopCount}</div>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, opacity: 0.62, textTransform: "uppercase", fontWeight: 900, letterSpacing: 0.78 }}>Employees</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{platformSnapshot.employeeCount}</div>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, opacity: 0.62, textTransform: "uppercase", fontWeight: 900, letterSpacing: 0.78 }}>Activity</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{platformSnapshot.auditCount}</div>
            </div>
          </div>
        </SectionBlock>
      ) : null}
    </div>
  );
}
