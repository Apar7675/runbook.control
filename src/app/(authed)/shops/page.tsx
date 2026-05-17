import React from "react";
import { redirect } from "next/navigation";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { getPlatformSnapshot, getShopSnapshot, getViewerContext, type ShopSnapshot } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ShopPlanRow = {
  id: string | null;
  subscription_plan: string | null;
};

type DirectoryRow = {
  id: string;
  name: string;
  billing_status: string | null;
  plan: string | null;
  access_display_status: string;
  access_summary: string;
  devices_total: number;
  workstations_total: number;
  members_total: number;
  created_at: string | null;
  last_activity_at: string | null;
  member_role: string;
  snapshot: ShopSnapshot;
};

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return "Not available";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function formatPlan(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text ? text.replaceAll("_", " ") : "Not set";
}

function safeDateMs(value: string | null | undefined) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function daysUntil(value: string | null | undefined) {
  const ms = safeDateMs(value);
  if (ms === null) return null;
  return Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
}

function accessTone(snapshot: ShopSnapshot): ControlStatusTone {
  if (snapshot.access.state === "restricted" || snapshot.access.state === "expired") return "danger";
  if (snapshot.access.state === "grace") return "warning";
  if (snapshot.access.state === "trialing") return "info";
  return "success";
}

function billingTone(status: string | null | undefined): ControlStatusTone {
  const value = String(status ?? "").trim().toLowerCase();
  if (!value) return "neutral";
  if (value.includes("active") || value.includes("paid")) return "success";
  if (value.includes("trial")) return "info";
  if (value.includes("grace") || value.includes("required")) return "warning";
  if (value.includes("expired") || value.includes("restricted") || value.includes("suspended")) return "danger";
  return "neutral";
}

async function loadPlanByShop(shopIds: string[]) {
  if (shopIds.length === 0) return new Map<string, string | null>();

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_shops")
    .select("id,subscription_plan")
    .in("id", shopIds);

  if (error) return new Map<string, string | null>();

  const rows = (data ?? []) as ShopPlanRow[];
  const planByShop = new Map<string, string | null>();
  for (const row of rows) {
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    planByShop.set(id, row.subscription_plan ?? null);
  }
  return planByShop;
}

export default async function ShopsPage() {
  const context = await getViewerContext();

  if (!context.isPlatformAdmin && context.shops.length === 1) {
    redirect(`/shops/${context.shops[0].id}`);
  }

  if (context.shops.length === 0) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Shops"
          title="Shops Directory"
          description="Cloud authority view of shop identity, billing outcomes, access posture, and enrollment scope."
          actions={<ControlActionLink href="/create-shop" tone="primary">Add shop</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="No shops are available yet"
            description="Create the first shop before managing people, devices, billing, or access outcomes in Control."
            action={<ControlActionLink href="/create-shop" tone="primary">Create shop</ControlActionLink>}
          />
        </ControlPanel>
      </div>
    );
  }

  const [platformSnapshot, snapshots] = await Promise.all([
    getPlatformSnapshot(context),
    Promise.all(context.shops.map((shop) => getShopSnapshot(shop))),
  ]);
  const planByShop = await loadPlanByShop(snapshots.map((shop) => shop.id));

  const rows: DirectoryRow[] = snapshots
    .map((shop) => ({
      id: shop.id,
      name: shop.name,
      billing_status: shop.billing_status,
      plan: planByShop.get(shop.id) ?? null,
      access_display_status: shop.access.display_status,
      access_summary: shop.access.summary,
      devices_total: shop.counts.devices_total,
      workstations_total: shop.counts.workstations_total,
      members_total: shop.counts.employees_total,
      created_at: context.shops.find((candidate) => candidate.id === shop.id)?.created_at ?? null,
      last_activity_at: shop.health.last_device_activity_at ?? shop.billing_current_period_end ?? shop.trial_ends_at ?? null,
      member_role: shop.member_role,
      snapshot: shop,
    }))
    .sort((left, right) => {
      const leftAttention = Number(left.snapshot.access.state === "restricted" || left.snapshot.access.state === "expired" || left.snapshot.access.state === "grace" || left.snapshot.health.offline_devices > 0 || left.snapshot.health.stale_devices > 0);
      const rightAttention = Number(right.snapshot.access.state === "restricted" || right.snapshot.access.state === "expired" || right.snapshot.access.state === "grace" || right.snapshot.health.offline_devices > 0 || right.snapshot.health.stale_devices > 0);
      if (leftAttention !== rightAttention) return rightAttention - leftAttention;
      return left.name.localeCompare(right.name);
    });

  const fullAccessCount = rows.filter((row) => row.snapshot.access.desktop_mode === "full" && row.snapshot.access.mobile_mode === "full" && row.snapshot.access.workstation_mode === "full").length;
  const trialCount = rows.filter((row) => row.snapshot.access.state === "trialing").length;
  const trialEndingSoonCount = rows.filter((row) => {
    const remaining = daysUntil(row.snapshot.trial_ends_at);
    return row.snapshot.access.state === "trialing" && remaining !== null && remaining >= 0 && remaining <= 7;
  }).length;
  const blockedCount = rows.filter((row) => row.snapshot.access.state === "restricted" || row.snapshot.access.state === "expired" || row.snapshot.access.state === "grace").length;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Shops"
        title="Shops Directory"
        description="Cloud authority view of shop identity, membership, billing outcomes, and access posture across the Control scope."
        actions={<ControlActionLink href="/create-shop" tone="primary">Add shop</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard
          label="Total Shops"
          value={String(context.shops.length)}
          meta={`${platformSnapshot.manageableShopCount} shop scopes visible in this session.`}
          tone="neutral"
        />
        <ControlMetricCard
          label="Active / Full Access"
          value={String(fullAccessCount)}
          meta={fullAccessCount === 0 ? "No shops are fully open right now." : `${fullAccessCount} shops currently allow full Desktop, Mobile, and Workstation access.`}
          tone={fullAccessCount === rows.length ? "success" : fullAccessCount > 0 ? "info" : "warning"}
        />
        <ControlMetricCard
          label="Trial / Ending Soon"
          value={String(trialCount)}
          meta={trialEndingSoonCount > 0 ? `${trialEndingSoonCount} trial${trialEndingSoonCount === 1 ? "" : "s"} end within 7 days.` : "No trial windows are ending in the next 7 days."}
          tone={trialCount > 0 ? "info" : "neutral"}
        />
        <ControlMetricCard
          label="Past Due / Blocked"
          value={String(blockedCount)}
          meta={blockedCount > 0 ? "These shops need billing or access attention." : "No shops are blocked or in grace right now."}
          tone={blockedCount > 0 ? "danger" : "success"}
        />
      </div>

      <ControlPanel
        title="Authorized Shops"
        description="Table-first view of shop identity, billing posture, effective access mode, and operational footprint."
      >
        {rows.length === 0 ? (
          <ControlEmptyState
            title="No shops to display"
            description="There are no shop records within the current authorized scope."
            action={<ControlActionLink href="/create-shop" tone="primary">Create shop</ControlActionLink>}
          />
        ) : (
          <ControlTableWrap>
            <ControlTable minWidth={1180}>
              <thead>
                <tr>
                  <ControlTableHeadCell>Shop Name</ControlTableHeadCell>
                  <ControlTableHeadCell>Billing Status</ControlTableHeadCell>
                  <ControlTableHeadCell>Access Mode</ControlTableHeadCell>
                  <ControlTableHeadCell>Plan</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Devices</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Workstations</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Members</ControlTableHeadCell>
                  <ControlTableHeadCell>Created</ControlTableHeadCell>
                  <ControlTableHeadCell>Last Activity</ControlTableHeadCell>
                  <ControlTableHeadCell align="right">Action</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#F8FAFC" }}>{row.name}</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>
                          Role: {row.member_role.replaceAll("_", " ")}
                          {row.snapshot.health.offline_devices > 0 ? ` | ${row.snapshot.health.offline_devices} offline device${row.snapshot.health.offline_devices === 1 ? "" : "s"}` : ""}
                        </div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip
                        label={(row.billing_status ?? "Unknown").replaceAll("_", " ")}
                        tone={billingTone(row.billing_status)}
                      />
                    </ControlTableCell>
                    <ControlTableCell>
                      <div style={{ display: "grid", gap: 8 }}>
                        <ControlStatusChip label={row.access_display_status} tone={accessTone(row.snapshot)} />
                        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>{row.access_summary}</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{formatPlan(row.plan)}</ControlTableCell>
                    <ControlTableCell align="right">
                      <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
                        <div style={{ color: "#F8FAFC", fontWeight: 700 }}>{row.devices_total}</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>{row.snapshot.counts.devices_active} active</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell align="right">
                      <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
                        <div style={{ color: "#F8FAFC", fontWeight: 700 }}>{row.workstations_total}</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>{row.snapshot.counts.workstations_active} active</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell align="right">
                      <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
                        <div style={{ color: "#F8FAFC", fontWeight: 700 }}>{row.members_total}</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>{row.snapshot.counts.employees_active} active</div>
                      </div>
                    </ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.created_at)}</ControlTableCell>
                    <ControlTableCell>{formatMaybeDate(row.last_activity_at)}</ControlTableCell>
                    <ControlTableCell align="right">
                      <ControlActionLink href={`/shops/${row.id}`} tone="secondary">Open shop</ControlActionLink>
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
