import React from "react";
import ProductionDashboardOverview, { ProductionDashboardEmpty } from "@/components/control/dashboard/ProductionDashboardOverview";
import { buildProductionDashboardModel } from "@/components/control/dashboard/ProductionDashboardModel";
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
    return <ProductionDashboardEmpty />;
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

  const model = buildProductionDashboardModel({
    context,
    shopSnapshot,
    platformSnapshot,
    employeeAccessGap,
    billingLabel,
    appLabel,
    devicesLabel,
    peopleLabel,
    actionItems,
    actionTones: actionItems.map((item) => priorityTone(item.priority)),
    billingDateLabel: formatDate(shopSnapshot.billing_current_period_end),
    trialDateLabel: shopSnapshot.trial_ends_at ? formatDate(shopSnapshot.trial_ends_at) : null,
  });
  return <ProductionDashboardOverview model={model} />;
}
