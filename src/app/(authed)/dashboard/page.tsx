import React from "react";
import { ActionLink, EmptyState, Icon, MetricCard, NoteList, PageHeader, SectionBlock, StatusBadge, SurfaceLink, toneFromStatus } from "@/components/control/ui";
import { getPlatformSnapshot, getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";
import { formatDateTime } from "@/lib/ui/dates";

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
      <div className="rb-page">
        <PageHeader eyebrow="Dashboard" title="RunBook Control" description="This command center becomes useful once a shop is connected. Start by creating or joining a shop." actions={<ActionLink href="/shops" tone="primary">Open Shop Setup</ActionLink>} />
        <EmptyState title="No shop connected yet" description="Create a shop first, then add people, register devices, and confirm billing access." action={<ActionLink href="/shops" tone="primary">Go to Shop</ActionLink>} />
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

  return (
    <div className="rb-page">
      <PageHeader
        eyebrow="Dashboard"
        title={context.isPlatformAdmin ? "RunBook Command Center" : `${shopSnapshot.name} Command Center`}
        description={`See what needs action first, where billing or devices are affecting access, and which admin workflow should happen next.${context.isPlatformAdmin ? ` You currently manage ${platformSnapshot?.manageableShopCount ?? 0} shops.` : ""}`}
        actions={<><ActionLink href="/people" tone="primary" icon="people">Add Employee</ActionLink><ActionLink href="/devices" icon="devices">Register Device</ActionLink></>}
      />

      <div className="rb-quadGrid">
        <MetricCard title="Billing" value={billingLabel} summary={billingLabel === "Billing Healthy" ? "No billing action is needed right now." : "Billing is currently affecting access and needs review."} href="/billing-access" badge={<StatusBadge label={billingLabel} tone={toneFromStatus(billingLabel)} />} tone={billingLabel === "Billing Healthy" ? "healthy" : "critical"} icon="billing" />
        <MetricCard title="Apps" value={appLabel} summary={appLabel === "All Connected" ? "All core app paths are operating normally." : "At least one app flow needs review."} href="/apps" badge={<StatusBadge label={appLabel} tone={toneFromStatus(appLabel)} />} tone={appLabel === "All Connected" ? "subtle" : "critical"} icon="apps" />
        <MetricCard title="Devices" value={devicesLabel} summary={shopSnapshot.health.offline_devices > 0 ? `${shopSnapshot.health.offline_devices} offline right now.` : shopSnapshot.health.stale_devices > 0 ? `${shopSnapshot.health.stale_devices} stale and should be reviewed soon.` : `${shopSnapshot.counts.devices_active} active of ${shopSnapshot.counts.devices_total} total.`} href="/devices" badge={<StatusBadge label={devicesLabel} tone={toneFromStatus(devicesLabel)} />} tone={shopSnapshot.health.offline_devices > 0 ? "critical" : shopSnapshot.health.stale_devices > 0 ? "warning" : "healthy"} icon="devices" />
        <MetricCard title="People" value={peopleLabel} summary={shopSnapshot.counts.employees_total === 0 ? "No employees have been added yet." : employeeAccessGap > 0 ? `${employeeAccessGap} employee${employeeAccessGap === 1 ? "" : "s"} need${employeeAccessGap === 1 ? "s" : ""} workstation review.` : `${shopSnapshot.counts.employees_active} active and ready.`} href="/people" badge={<StatusBadge label={peopleLabel} tone={toneFromStatus(peopleLabel)} />} tone={employeeAccessGap > 0 ? "warning" : shopSnapshot.counts.employees_total === 0 ? "subtle" : "healthy"} icon="people" />
      </div>

      <div className="rb-splitGrid">
        <SectionBlock title="Immediate Attention" description="High-risk states are surfaced first and visually separated from routine review." tone={actionItems.length > 0 ? "critical" : "healthy"}>
          <div className="rb-stack">
            {actionItems.length === 0 ? (
              <div className="rb-panel rb-panel--healthy">
                <div className="rb-panel__inner">
                  <div className="rb-chipRow"><StatusBadge label="Healthy" tone="healthy" /></div>
                  <div className="rb-pageCopy">Billing, apps, devices, and people all look ready. You can move on to routine review.</div>
                </div>
              </div>
            ) : (
              actionItems.map((item) => (
                <a key={item.title} href={item.href} className="rb-actionCard">
                  <div className={item.priority === "high" ? "rb-actionCard__rail--critical" : "rb-actionCard__rail--warning"} />
                  <div className="rb-actionCard__body">
                    <div className="rb-rowBetween">
                      <div className="rb-chipRow">
                        <StatusBadge label={item.priority === "high" ? "Action Needed" : "Warning"} tone={priorityTone(item.priority)} />
                        <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.02em" }}>{item.title}</div>
                      </div>
                      <div className="rb-inlineRow" style={{ fontWeight: 900 }}><span>{item.cta}</span><Icon name="arrow" size={15} tone={item.priority === "high" ? "critical" : "warning"} /></div>
                    </div>
                    <div className="rb-pageCopy">{item.reason}</div>
                  </div>
                </a>
              ))
            )}
          </div>
        </SectionBlock>

        <SectionBlock title="Connected System" description="Control should answer whether the system is truly ready, not just list features.">
          <NoteList
            items={[
              shopSnapshot.access.desktop_mode === "full" ? "Desktop is connected and ready." : "Desktop is connected, but access is reduced right now.",
              shopSnapshot.access.workstation_mode === "full" ? "Workstation is ready for employee sign-in." : "Workstation is not ready and needs review.",
              shopSnapshot.access.mobile_mode === "full" ? "Mobile is available to eligible employees." : shopSnapshot.access.mobile_mode === "queue_only" ? "Mobile is running in a restricted queue-only state." : "Mobile access is blocked right now.",
            ]}
          />
          <div className="rb-inlineRow"><ActionLink href="/apps" icon="apps">Open App Status</ActionLink></div>
        </SectionBlock>
      </div>

      <div className="rb-tripleGrid">
        <SectionBlock title="Access Summary" description="Translate system state into plain operational meaning.">
          <NoteList items={["Desktop: " + (shopSnapshot.access.desktop_mode === "full" ? "Ready" : "Reduced Access"), "Workstation: " + (shopSnapshot.access.workstation_mode === "full" ? "Ready" : "Needs Attention"), "Mobile: " + (shopSnapshot.access.mobile_mode === "full" ? "Ready" : shopSnapshot.access.mobile_mode === "queue_only" ? "Restricted" : "Blocked")]} />
        </SectionBlock>

        <SectionBlock title="Billing Window" description="Keep only the billing facts that matter right now.">
          <NoteList items={[`Status: ${billingLabel}`, `Next billing date: ${formatDate(shopSnapshot.billing_current_period_end)}`, ...(shopSnapshot.trial_ends_at ? [`Trial ends: ${formatDate(shopSnapshot.trial_ends_at)}`] : [])]} />
        </SectionBlock>

        <SectionBlock title="Next Moves" description="Direct, intention-rich admin actions with less clutter.">
          <div className="rb-stack">
            <SurfaceLink href="/devices" title="Review Devices" description={shopSnapshot.health.offline_devices > 0 ? `${shopSnapshot.health.offline_devices} devices are offline.` : shopSnapshot.health.stale_devices > 0 ? `${shopSnapshot.health.stale_devices} devices are stale.` : "All devices are checking in normally."} icon="devices" />
            <SurfaceLink href="/people" title="Open People" description={employeeAccessGap > 0 ? `${employeeAccessGap} employee${employeeAccessGap === 1 ? "" : "s"} need${employeeAccessGap === 1 ? "s" : ""} workstation access review.` : "People access is currently in good shape."} icon="people" />
            <SurfaceLink href="/billing-access" title="Open Billing & Access" description="Confirm billing details before going live or before troubleshooting blocked access." icon="billing" />
          </div>
        </SectionBlock>
      </div>

      {context.isPlatformAdmin && platformSnapshot ? (
        <SectionBlock title="Platform Snapshot" description="Secondary platform metrics for advanced admins.">
          <div className="rb-statStrip">
            <div className="rb-statCell"><div className="rb-statCell__label">Managed Shops</div><div className="rb-statCell__value">{platformSnapshot.manageableShopCount}</div></div>
            <div className="rb-statCell"><div className="rb-statCell__label">All Shops</div><div className="rb-statCell__value">{platformSnapshot.shopCount}</div></div>
            <div className="rb-statCell"><div className="rb-statCell__label">Employees</div><div className="rb-statCell__value">{platformSnapshot.employeeCount}</div></div>
            <div className="rb-statCell"><div className="rb-statCell__label">Activity</div><div className="rb-statCell__value">{platformSnapshot.auditCount}</div></div>
          </div>
        </SectionBlock>
      ) : null}
    </div>
  );
}
