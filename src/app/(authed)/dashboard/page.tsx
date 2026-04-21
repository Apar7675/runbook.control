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

function statusLabel(value: string) {
  return <StatusBadge label={value} tone={toneFromStatus(value)} />;
}

function summaryRow(label: string, value: string) {
  return (
    <div
      key={label}
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "baseline",
        padding: "11px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span
        style={{
          color: theme.text.quiet,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 0.82,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: theme.text.primary,
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1.45,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function nextStep(
  href: string,
  icon: React.ComponentProps<typeof Icon>["name"],
  title: string,
  description: string,
) {
  return (
    <a
      href={href}
      key={title}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "grid",
        gap: 8,
        padding: 14,
        borderRadius: theme.radius.lg,
        border: theme.border.muted,
        background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span
            style={{
              width: 34,
              height: 34,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              flexShrink: 0,
            }}
          >
            <Icon name={icon} size={15} tone="neutral" />
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.14 }}>{title}</span>
        </div>
        <Icon name="arrow" size={14} tone="neutral" />
      </div>
      <div style={{ color: theme.text.secondary, lineHeight: 1.6, fontSize: 12.5 }}>
        {description}
      </div>
    </a>
  );
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
    shopSnapshot.health.offline_devices > 0 ? { title: `${shopSnapshot.health.offline_devices} Device${shopSnapshot.health.offline_devices === 1 ? "" : "s"} Offline`, reason: "These devices have stopped checking in and need review now.", href: "/devices", cta: "Review Devices", priority: "high" as const } : null,
    shopSnapshot.health.stale_devices > 0 ? { title: `${shopSnapshot.health.stale_devices} Device${shopSnapshot.health.stale_devices === 1 ? "" : "s"} Need Review`, reason: "These devices are going stale and should be checked before they go offline.", href: "/devices", cta: "Check Device Health", priority: "medium" as const } : null,
    employeeAccessGap > 0 ? { title: `${employeeAccessGap} Employee${employeeAccessGap === 1 ? "" : "s"} Need${employeeAccessGap === 1 ? "s" : ""} Access Review`, reason: "Some active employees still need workstation access review before setup is complete.", href: "/people", cta: "Fix Employee Access", priority: "medium" as const } : null,
    shopSnapshot.access.workstation_mode !== "full" ? { title: "Workstation Access Needs Attention", reason: "Workstation sign-in is not fully ready and should be reviewed before going live.", href: "/apps", cta: "Review App Access", priority: "high" as const } : null,
    shopSnapshot.access.state === "grace" || shopSnapshot.access.state === "restricted" || shopSnapshot.access.state === "expired"
      ? { title: "Billing Needs Review", reason: "Billing is affecting app access and should be reviewed before troubleshooting anything else.", href: "/billing-access", cta: "Open Billing", priority: "high" as const }
      : shopSnapshot.access.state === "trialing" && shopSnapshot.trial_ends_at
        ? { title: "Trial Ending Soon", reason: `Current trial access ends ${formatDate(shopSnapshot.trial_ends_at)}.`, href: "/billing-access", cta: "Review Billing", priority: "medium" as const }
        : null,
  ].filter(Boolean) as Array<{ title: string; reason: string; href: string; cta: string; priority: "high" | "medium" | "low" }>;

  const desktopStatus = shopSnapshot.access.desktop_mode === "full" ? "Healthy" : "Desktop Reduced";
  const workstationStatus = shopSnapshot.access.workstation_mode === "full" ? "Healthy" : "Workstation Degraded";
  const mobileStatus = shopSnapshot.access.mobile_mode === "full" ? "Healthy" : shopSnapshot.access.mobile_mode === "queue_only" ? "Queue-Only" : "Mobile Restricted";

  return (
    <div suppressHydrationWarning style={{ display: "grid", gap: 22 }}>
      <PageHeader
        eyebrow="Dashboard"
        title={context.isPlatformAdmin ? "RunBook Command Center" : `${shopSnapshot.name} Command Center`}
        description={`Understand what needs action first, what apps are healthy, and where to go next.${context.isPlatformAdmin ? ` You currently manage ${platformSnapshot?.manageableShopCount ?? 0} shops.` : ""}`}
        actions={<><ActionLink href="/people" tone="primary" icon="people">Add Employee</ActionLink><ActionLink href="/devices" icon="devices">Register Device</ActionLink></>}
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <MetricCard title="Billing" value={billingLabel} summary={billingLabel === "Billing Healthy" ? "No billing action is needed right now." : "Billing is currently affecting access and needs review."} href="/billing-access" badge={statusLabel(billingLabel)} tone={billingLabel === "Billing Healthy" ? "healthy" : "critical"} icon="billing" />
        <MetricCard title="Apps" value={appLabel} summary={appLabel === "All Connected" ? "All core app paths are operating normally." : "At least one app flow needs review."} href="/apps" badge={statusLabel(appLabel)} tone={appLabel === "All Connected" ? "subtle" : "critical"} icon="apps" />
        <MetricCard title="Devices" value={devicesLabel} summary={shopSnapshot.health.offline_devices > 0 ? `${shopSnapshot.health.offline_devices} offline right now.` : shopSnapshot.health.stale_devices > 0 ? `${shopSnapshot.health.stale_devices} stale and should be reviewed soon.` : `${shopSnapshot.counts.devices_active} active of ${shopSnapshot.counts.devices_total} total.`} href="/devices" badge={statusLabel(devicesLabel)} tone={shopSnapshot.health.offline_devices > 0 ? "critical" : shopSnapshot.health.stale_devices > 0 ? "warning" : "healthy"} icon="devices" />
        <MetricCard title="People" value={peopleLabel} summary={shopSnapshot.counts.employees_total === 0 ? "No employees have been added yet." : employeeAccessGap > 0 ? `${employeeAccessGap} employee${employeeAccessGap === 1 ? "" : "s"} need${employeeAccessGap === 1 ? "s" : ""} workstation review.` : `${shopSnapshot.counts.employees_active} active and ready.`} href="/people" badge={statusLabel(peopleLabel)} tone={employeeAccessGap > 0 ? "warning" : shopSnapshot.counts.employees_total === 0 ? "subtle" : "healthy"} icon="people" />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.45fr) minmax(320px, 0.92fr)",
          gap: 16,
        }}
      >
        <SectionBlock title="Action Required" description="Priority work, framed so the next move is obvious." tone={actionItems.length > 0 ? "critical" : "healthy"}>
          <div style={{ display: "grid", gap: 12 }}>
            {actionItems.length === 0 ? (
              <div
                style={{
                  border: "1px solid rgba(86,220,154,.16)",
                  borderRadius: theme.radius.lg,
                  background:
                    "radial-gradient(circle at top right, rgba(84,196,138,.12), transparent 34%), linear-gradient(180deg, rgba(84,196,138,.08), rgba(255,255,255,.02))",
                  padding: 18,
                  display: "grid",
                  gap: 10,
                }}
              >
                {statusLabel("Healthy")}
                <div style={{ fontWeight: 900, fontSize: 19, letterSpacing: -0.32 }}>
                  No urgent action is needed right now
                </div>
                <div style={{ color: theme.text.secondary, lineHeight: 1.6, fontSize: 12.5 }}>
                  Billing, apps, devices, and people all look ready. You can move on to routine review.
                </div>
              </div>
            ) : actionItems.map((item) => (
              <div
                key={item.title}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  display: "grid",
                  gridTemplateColumns: "6px minmax(0,1fr)",
                  borderRadius: theme.radius.lg,
                  border: item.priority === "high" ? theme.border.critical : theme.border.warning,
                  background:
                    item.priority === "high"
                      ? "radial-gradient(circle at top right, rgba(255,120,120,.14), transparent 30%),linear-gradient(180deg, rgba(60,20,26,.96), rgba(22,16,24,.97))"
                      : "radial-gradient(circle at top right, rgba(255,196,107,.12), transparent 30%),linear-gradient(180deg, rgba(43,31,17,.92), rgba(18,15,22,.97))",
                  boxShadow: item.priority === "high" ? theme.shadow.critical : theme.shadow.warning,
                }}
              >
                <div
                  style={{
                    background:
                      item.priority === "high"
                        ? "linear-gradient(180deg, rgba(255,129,129,.98), rgba(255,84,84,.56))"
                        : "linear-gradient(180deg, rgba(255,205,120,.98), rgba(255,170,62,.48))",
                    boxShadow:
                      item.priority === "high"
                        ? "0 0 18px rgba(255,120,120,.24)"
                        : "0 0 16px rgba(255,196,107,.16)",
                  }}
                />
                <div style={{ display: "grid", gap: 14, padding: "16px 16px 14px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 10, flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <StatusBadge label={item.priority === "high" ? "Action Needed" : "Warning"} tone={priorityTone(item.priority)} />
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            color: item.priority === "high" ? "#ffd8d8" : "#ffe2b2",
                            fontSize: 10,
                            fontWeight: 900,
                            letterSpacing: 0.74,
                            textTransform: "uppercase",
                          }}
                        >
                          <Icon name={item.priority === "high" ? "warning" : "activity"} size={14} tone={item.priority === "high" ? "critical" : "warning"} />
                          {item.priority === "high" ? "Immediate Review" : "Queue Next"}
                        </span>
                      </div>
                      <div style={{ fontWeight: 950, fontSize: 19, lineHeight: 1.08, letterSpacing: -0.34, color: "#f7f9ff" }}>
                        {item.title}
                      </div>
                      <div style={{ color: item.priority === "high" ? "rgba(255,234,234,.84)" : "rgba(255,238,209,.8)", lineHeight: 1.58, fontSize: 13, maxWidth: 640 }}>
                        {item.reason}
                      </div>
                    </div>
                    <ActionLink href={item.href} icon="arrow" tone={item.priority === "high" ? "primary" : "secondary"}>{item.cta}</ActionLink>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                      paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,.09)",
                    }}
                  >
                    <div style={{ color: theme.text.quiet, fontSize: 11, fontWeight: 800 }}>
                      {item.priority === "high" ? "Priority path: resolve this before deeper troubleshooting." : "Next-up path: review this before it becomes blocking."}
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        fontWeight: 900,
                        color: item.priority === "high" ? "#ffd2d2" : "#ffe7be",
                      }}
                    >
                      <span>{item.priority === "high" ? "Priority High" : "Priority Medium"}</span>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: theme.radius.pill,
                          background: item.priority === "high" ? "#ff8e8e" : "#ffc968",
                          boxShadow:
                            item.priority === "high"
                              ? "0 0 16px rgba(255,120,120,.36)"
                              : "0 0 14px rgba(255,196,107,.28)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock title="Connected Apps" description="Clean status language for the paths users actually feel." tone="subtle">
          <div style={{ display: "grid", gap: 12 }}>
            {[
              {
                title: "Desktop",
                icon: "apps" as const,
                status: desktopStatus,
                text:
                  shopSnapshot.access.desktop_mode === "full"
                    ? "Desktop is connected and ready."
                    : "Desktop is connected, but access is reduced right now.",
              },
              {
                title: "Workstation",
                icon: "devices" as const,
                status: workstationStatus,
                text:
                  shopSnapshot.access.workstation_mode === "full"
                    ? "Workstation is ready for employee sign-in."
                    : "Workstation is not ready and needs review.",
              },
              {
                title: "Mobile",
                icon: "people" as const,
                status: mobileStatus,
                text:
                  shopSnapshot.access.mobile_mode === "full"
                    ? "Mobile is available to eligible employees."
                    : shopSnapshot.access.mobile_mode === "queue_only"
                      ? "Mobile is running in a restricted queue-only state."
                      : "Mobile access is blocked right now.",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  padding: 14,
                  borderRadius: theme.radius.lg,
                  border: theme.border.muted,
                  background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={item.icon} size={16} tone={toneFromStatus(item.status)} />
                  </span>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.14 }}>{item.title}</div>
                    <div style={{ color: theme.text.secondary, lineHeight: 1.6, fontSize: 12.5 }}>{item.text}</div>
                  </div>
                </div>
                {statusLabel(item.status)}
              </div>
            ))}
            <ActionLink href="/apps" icon="apps">Open App Status</ActionLink>
          </div>
        </SectionBlock>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <SectionBlock title="Access Summary" description="Translate system state into meaning." tone="subtle">
          <div style={{ display: "grid", gap: 0 }}>
            {summaryRow("Desktop", shopSnapshot.access.desktop_mode === "full" ? "Ready" : "Reduced Access")}
            {summaryRow("Workstation", shopSnapshot.access.workstation_mode === "full" ? "Ready" : "Needs Attention")}
            {summaryRow("Mobile", shopSnapshot.access.mobile_mode === "full" ? "Ready" : shopSnapshot.access.mobile_mode === "queue_only" ? "Restricted" : "Blocked")}
          </div>
        </SectionBlock>

        <SectionBlock title="Billing Summary" description="Keep only the billing facts that matter right now." tone="subtle">
          <div style={{ display: "grid", gap: 0 }}>
            {summaryRow("Status", billingLabel)}
            {summaryRow("Next billing date", formatDate(shopSnapshot.billing_current_period_end))}
            {shopSnapshot.trial_ends_at ? summaryRow("Trial ends", formatDate(shopSnapshot.trial_ends_at)) : null}
          </div>
        </SectionBlock>

        <SectionBlock title="Operational Next Steps" description="Keep the next steps direct and clickable." tone="default">
          <div style={{ display: "grid", gap: 12 }}>
            {nextStep("/devices", "devices", "Review Devices", shopSnapshot.health.offline_devices > 0 ? `${shopSnapshot.health.offline_devices} devices are offline.` : shopSnapshot.health.stale_devices > 0 ? `${shopSnapshot.health.stale_devices} devices are stale.` : "All devices are checking in normally.")}
            {nextStep("/people", "people", "Open People", employeeAccessGap > 0 ? `${employeeAccessGap} employee${employeeAccessGap === 1 ? "" : "s"} need${employeeAccessGap === 1 ? "s" : ""} workstation access review.` : "People access is currently in good shape.")}
            {nextStep("/billing-access", "billing", "Open Billing & Access", "Confirm billing details before going live or before troubleshooting blocked access.")}
          </div>
        </SectionBlock>
      </section>

      {context.isPlatformAdmin && platformSnapshot ? (
        <SectionBlock title="Platform Snapshot" description="Secondary platform metrics for advanced admins." tone="subtle">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {[
              ["Managed Shops", String(platformSnapshot.manageableShopCount)],
              ["All Shops", String(platformSnapshot.shopCount)],
              ["Employees", String(platformSnapshot.employeeCount)],
              ["Activity", String(platformSnapshot.auditCount)],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: theme.radius.lg,
                  border: theme.border.muted,
                  background: "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015))",
                }}
              >
                <div
                  style={{
                    color: theme.text.quiet,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.82,
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.34 }}>{value}</div>
              </div>
            ))}
          </div>
        </SectionBlock>
      ) : null}
    </div>
  );
}
