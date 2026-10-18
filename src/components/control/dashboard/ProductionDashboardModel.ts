import type { ViewerContext, ShopSnapshot, getPlatformSnapshot } from "@/lib/control/summary";
import type { ControlStatusTone } from "@/components/control/ControlStatusChip";

type PlatformSnapshot = Awaited<ReturnType<typeof getPlatformSnapshot>>;
export type ProductionActionItem = { title: string; reason: string; href: string; cta: string; priority: "high" | "medium" | "low" };
type Item = { label: string; value: string; href: string };
export type ProductionDashboardModel = {
  shopName: string;
  isPlatformAdmin: boolean;
  metrics: Array<Item & { meta: string; tone: ControlStatusTone }>;
  summary: Item[];
  alerts: Array<ProductionActionItem & { key: string; scope: string; tone: ControlStatusTone }>;
  health: Array<{ service: string; status: string; detail: string; tone: ControlStatusTone }>;
  activityCount: number;
  shortcuts: Array<{ title: string; href: string; detail: string }>;
  billingDateLabel: string;
  trialDateLabel: string | null;
  platform: PlatformSnapshot | null;
};

export type ProductionDashboardInput = {
  context: ViewerContext;
  shopSnapshot: ShopSnapshot;
  platformSnapshot: PlatformSnapshot | null;
  employeeAccessGap: number;
  billingLabel: string;
  appLabel: string;
  devicesLabel: string;
  peopleLabel: string;
  actionItems: ProductionActionItem[];
  actionTones: Array<"critical" | "warning" | "neutral">;
  billingDateLabel: string;
  trialDateLabel: string | null;
};

/** Pure presentation mapping. It performs no loading, authorization, persistence or provider checks. */
export function buildProductionDashboardModel(input: ProductionDashboardInput): ProductionDashboardModel {
  const s = input.shopSnapshot;
  const blocked = s.access.workstation_mode === "full" ? 0 : s.counts.workstations_active;
  const accessTone = (mode: string): ControlStatusTone => mode === "full" ? "info" : "warning";
  const accessLabel = (mode: string) => mode === "full" ? "Full access" : mode === "queue_only" ? "Queue only" : mode === "read_only" ? "Read only" : "Restricted";
  return {
    shopName: s.name,
    isPlatformAdmin: input.context.isPlatformAdmin,
    metrics: [
      { label: "Devices offline", value: String(s.health.offline_devices), meta: input.devicesLabel, tone: s.health.offline_devices > 0 ? "danger" : "info", href: "/devices" },
      { label: "Workstations blocked", value: String(blocked), meta: input.appLabel, tone: blocked > 0 ? "warning" : "info", href: "/apps" },
      { label: "People needing access", value: String(input.employeeAccessGap), meta: input.peopleLabel, tone: input.employeeAccessGap > 0 ? "warning" : "info", href: "/people" },
      { label: "Timeclock review", value: "—", meta: "Review count unavailable", tone: "neutral", href: "" },
    ],
    summary: [
      ...(input.context.isPlatformAdmin && input.platformSnapshot ? [{ label: "managed shops", value: String(input.platformSnapshot.manageableShopCount), href: "/shops" }] : []),
      { label: "active devices", value: String(s.counts.devices_active), href: "/devices" },
      { label: "workstations", value: String(s.counts.workstations_active), href: "/apps" },
      { label: "mobile-ready employees", value: String(s.counts.employees_mobile_ready), href: "/people" },
      { label: "recent audit events (snapshot)", value: String(s.health.recent_audit_events), href: "/audit" },
    ],
    alerts: input.actionItems.map((item, index) => ({ ...item, key: `${s.id}:${index}`, scope: s.name, tone: input.actionTones[index] === "critical" ? "danger" : input.actionTones[index] === "warning" ? "warning" : "neutral" })),
    health: [
      { service: "Desktop access", status: accessLabel(s.access.desktop_mode), detail: "Entitlement snapshot; not a live connection test", tone: accessTone(s.access.desktop_mode) },
      { service: "Workstation access", status: accessLabel(s.access.workstation_mode), detail: "Entitlement snapshot; not employee sign-in verification", tone: accessTone(s.access.workstation_mode) },
      { service: "Mobile access", status: accessLabel(s.access.mobile_mode), detail: "Entitlement snapshot for eligible employees", tone: accessTone(s.access.mobile_mode) },
      { service: "Billing", status: input.billingLabel, detail: `Next billing date: ${input.billingDateLabel}`, tone: input.billingLabel === "Billing Healthy" ? "info" : "warning" },
      { service: "Device check-in", status: input.devicesLabel, detail: s.health.last_device_activity_at || "No activity time in snapshot", tone: s.health.offline_devices > 0 ? "danger" : s.health.stale_devices > 0 ? "warning" : "info" },
    ],
    activityCount: s.health.recent_audit_events,
    shortcuts: [
      { title: "Review Devices", href: "/devices", detail: `${s.health.offline_devices} offline; ${s.health.stale_devices} stale in this shop snapshot` },
      { title: "Open People", href: "/people", detail: `${input.employeeAccessGap} need workstation access review` },
      { title: "Billing & Access", href: "/billing-access", detail: input.billingLabel },
    ],
    billingDateLabel: input.billingDateLabel,
    trialDateLabel: input.trialDateLabel,
    platform: input.context.isPlatformAdmin ? input.platformSnapshot : null,
  };
}

export function orderProductionAlerts<T extends { priority: "high" | "medium" | "low" }>(items: T[]): T[] {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...items].sort((a, b) => rank[a.priority] - rank[b.priority]);
}
