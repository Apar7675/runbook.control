import React from "react";
import BillingControlPanel from "@/components/shops/billing/BillingControlPanel";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import { controlTheme as t } from "@/components/control/controlTheme";
import { getShopSnapshot, getViewerContext, selectPrimaryShop, type ShopSnapshot } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ShopTabKey =
  | "overview"
  | "billing"
  | "members"
  | "devices"
  | "workstations"
  | "mobile"
  | "audit"
  | "support"
  | "settings";

type ShopDeviceRow = {
  id: string;
  name: string | null;
  status: string | null;
  device_type: string | null;
  created_at: string | null;
  last_seen_at: string | null;
};

type ShopMemberRow = {
  key: string;
  employee_id: string | null;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  role: string | null;
  status: string;
  membership_role: string | null;
  membership_is_active: boolean;
  employee_is_active: boolean | null;
  mobile_access_enabled: boolean | null;
  workstation_access_enabled: boolean | null;
  trusted_device_count: number;
  mfa_state: "unknown";
  created_at: string | null;
};

type EmployeeRow = {
  id: string | null;
  auth_user_id: string | null;
  employee_code: string | null;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  is_active: boolean | null;
  mobile_access_enabled: boolean | null;
  workstation_access_enabled: boolean | null;
  created_at: string | null;
};

type MemberProfileRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type MembershipRow = {
  user_id: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type TrustedDeviceRow = {
  user_id: string | null;
  created_at: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  actor_email: string | null;
  created_at: string | null;
};

type SupportBundleRow = {
  id: string;
  file_path: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

type TimeclockReviewRow = {
  id: string | null;
  employee_id: string | null;
  updated_at: string | null;
};

type BillingSummaryRow = {
  id: string | null;
  created_at: string | null;
  billing_status: string | null;
  trial_ends_at: string | null;
  billing_current_period_end: string | null;
  grace_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan: string | null;
  manual_billing_status: string | null;
  manual_billing_override: boolean | null;
  entitlement_override: string | null;
};

type OverviewCounts = {
  mobileReviewCount: number;
  trustedDeviceCount: number;
};

const SHOP_TABS: Array<{ key: ShopTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "billing", label: "Billing & Access" },
  { key: "members", label: "Members" },
  { key: "devices", label: "Devices" },
  { key: "workstations", label: "Workstations" },
  { key: "mobile", label: "Mobile" },
  { key: "audit", label: "Audit" },
  { key: "support", label: "Support" },
  { key: "settings", label: "Settings" },
];

function normalizeTab(input: string | string[] | undefined): ShopTabKey {
  const value = typeof input === "string" ? input : "";
  if (value === "users") return "members";
  if (value === "activity") return "audit";
  if (SHOP_TABS.some((tab) => tab.key === value)) return value as ShopTabKey;
  return "overview";
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function isoOrNull(value: unknown) {
  const text = asText(value);
  return text || null;
}

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return "Not available";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function billingTone(status: string | null | undefined): ControlStatusTone {
  const value = asText(status).toLowerCase();
  if (!value) return "neutral";
  if (value.includes("active") || value.includes("paid")) return "success";
  if (value.includes("trial")) return "info";
  if (value.includes("grace") || value.includes("required")) return "warning";
  if (value.includes("expired") || value.includes("restricted") || value.includes("suspended")) return "danger";
  return "neutral";
}

function accessTone(snapshot: ShopSnapshot): ControlStatusTone {
  if (snapshot.access.state === "restricted" || snapshot.access.state === "expired") return "danger";
  if (snapshot.access.state === "grace") return "warning";
  if (snapshot.access.state === "trialing") return "info";
  return "success";
}

function deviceStatusTone(status: string | null | undefined): ControlStatusTone {
  const value = asText(status).toLowerCase();
  if (!value) return "neutral";
  if (value === "active") return "success";
  if (value === "pending" || value === "stale") return "warning";
  if (value === "blocked" || value === "revoked" || value === "offline") return "danger";
  return "neutral";
}

function memberStatusTone(status: string): ControlStatusTone {
  const value = status.toLowerCase();
  if (value.includes("active")) return "success";
  if (value.includes("review")) return "warning";
  if (value.includes("inactive") || value.includes("blocked") || value.includes("disabled")) return "danger";
  return "neutral";
}

function renderAccessModeLabel(mode: string) {
  return mode.replaceAll("_", " ");
}

function humanizeLabel(value: string | null | undefined, fallback: string) {
  const text = asText(value);
  return text ? text.replaceAll("_", " ") : fallback;
}

function fileName(path: string | null | undefined) {
  const text = asText(path);
  if (!text) return "No stored path";
  const parts = text.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? text;
}

function tryExtractMissingColumn(message: string): string | null {
  const relationMatch = message.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedMatch = message.match(/column\s+[a-zA-Z0-9_]+\.(\w+)\s+does\s+not\s+exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  return null;
}

async function loadShopDeviceRows(shopId: string): Promise<ShopDeviceRow[]> {
  const admin = supabaseAdmin();
  const { data: devices, error } = await admin
    .from("rb_devices")
    .select("id,name,status,created_at,last_seen_at,device_type")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const deviceRows = (devices ?? []) as Array<{
    id: string | null;
    name: string | null;
    status: string | null;
    created_at: string | null;
    last_seen_at: string | null;
    device_type: string | null;
  }>;

  const ids = deviceRows.map((device) => asText(device.id)).filter(Boolean);
  const tokenLastSeen = new Map<string, string>();

  if (ids.length > 0) {
    const { data: tokenRows } = await admin
      .from("rb_device_tokens")
      .select("device_id,last_seen_at,revoked_at")
      .in("device_id", ids);

    for (const token of (tokenRows ?? []) as Array<{ device_id: string | null; last_seen_at: string | null; revoked_at: string | null }>) {
      if (token.revoked_at) continue;
      const deviceId = asText(token.device_id);
      const ts = asText(token.last_seen_at);
      if (!deviceId || !ts) continue;
      const existing = tokenLastSeen.get(deviceId);
      if (!existing || ts > existing) tokenLastSeen.set(deviceId, ts);
    }
  }

  return deviceRows.map((device) => {
    const directSeen = isoOrNull(device.last_seen_at);
    const tokenSeen = tokenLastSeen.get(asText(device.id)) ?? null;
    const mergedSeen = tokenSeen && directSeen ? (tokenSeen > directSeen ? tokenSeen : directSeen) : tokenSeen ?? directSeen;
    return {
      id: asText(device.id),
      name: asText(device.name) || null,
      status: isoOrNull(device.status),
      device_type: isoOrNull(device.device_type),
      created_at: isoOrNull(device.created_at),
      last_seen_at: mergedSeen,
    };
  });
}

async function loadBillingSummary(shopId: string): Promise<BillingSummaryRow | null> {
  const admin = supabaseAdmin();
  const columns = [
    "id",
    "created_at",
    "billing_status",
    "trial_ends_at",
    "billing_current_period_end",
    "grace_ends_at",
    "stripe_customer_id",
    "stripe_subscription_id",
    "subscription_plan",
    "manual_billing_status",
    "manual_billing_override",
    "entitlement_override",
  ];

  let working = [...columns];
  for (let attempt = 0; attempt < columns.length; attempt += 1) {
    const { data, error } = await admin.from("rb_shops").select(working.join(",")).eq("id", shopId).maybeSingle();
    if (!error) {
      const row = (data ?? {}) as Partial<BillingSummaryRow>;
      return {
        id: row.id ?? null,
        created_at: row.created_at ?? null,
        billing_status: row.billing_status ?? null,
        trial_ends_at: row.trial_ends_at ?? null,
        billing_current_period_end: row.billing_current_period_end ?? null,
        grace_ends_at: row.grace_ends_at ?? null,
        stripe_customer_id: row.stripe_customer_id ?? null,
        stripe_subscription_id: row.stripe_subscription_id ?? null,
        subscription_plan: row.subscription_plan ?? null,
        manual_billing_status: row.manual_billing_status ?? null,
        manual_billing_override: row.manual_billing_override ?? null,
        entitlement_override: row.entitlement_override ?? null,
      };
    }

    const missingColumn = tryExtractMissingColumn(String(error.message ?? ""));
    if (missingColumn && working.includes(missingColumn)) {
      working = working.filter((column) => column !== missingColumn);
      continue;
    }
    throw new Error(error.message);
  }

  return null;
}

async function loadShopMembers(shopId: string): Promise<{ rows: ShopMemberRow[]; counts: OverviewCounts }> {
  const admin = supabaseAdmin();
  const [{ data: employeesRaw, error: employeeError }, { data: membersRaw, error: memberError }] = await Promise.all([
    admin
      .from("employees")
      .select("id,auth_user_id,employee_code,display_name,full_name,email,role,status,is_active,mobile_access_enabled,workstation_access_enabled,created_at")
      .eq("shop_id", shopId)
      .order("display_name", { ascending: true }),
    admin
      .from("rb_shop_members")
      .select("user_id,role,is_active,created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true }),
  ]);

  if (employeeError) throw new Error(employeeError.message);
  if (memberError) throw new Error(memberError.message);

  const employees = (employeesRaw ?? []) as EmployeeRow[];
  const members = (membersRaw ?? []) as MembershipRow[];
  const memberUserIds = members.map((member) => asText(member.user_id)).filter(Boolean);

  const profilesByUserId = new Map<string, MemberProfileRow>();
  if (memberUserIds.length > 0) {
    const { data: profilesRaw, error: profileError } = await admin
      .from("rb_profiles")
      .select("id,first_name,last_name,email,phone")
      .in("id", memberUserIds);

    if (!profileError) {
      for (const row of (profilesRaw ?? []) as Array<MemberProfileRow & { id: string | null }>) {
        const userId = asText(row.id);
        if (!userId) continue;
        profilesByUserId.set(userId, {
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          email: row.email ?? null,
          phone: row.phone ?? null,
        });
      }
    }
  }

  const memberByUserId = new Map<string, MembershipRow>();
  for (const member of members) {
    const userId = asText(member.user_id);
    if (!userId) continue;
    memberByUserId.set(userId, member);
  }

  const authUserIds = employees.map((employee) => asText(employee.auth_user_id)).filter(Boolean);
  const { data: trustedRows } = authUserIds.length > 0
    ? await admin.from("rb_trusted_devices").select("user_id,created_at").in("user_id", authUserIds)
    : { data: [] as TrustedDeviceRow[] };

  const trustedByUser = new Map<string, number>();
  for (const row of (trustedRows ?? []) as TrustedDeviceRow[]) {
    const userId = asText(row.user_id);
    if (!userId) continue;
    trustedByUser.set(userId, (trustedByUser.get(userId) ?? 0) + 1);
  }

  const rows: ShopMemberRow[] = [];
  const seenUserIds = new Set<string>();

  for (const employee of employees) {
    const authUserId = asText(employee.auth_user_id);
    const membership = authUserId ? memberByUserId.get(authUserId) ?? null : null;
    const displayName =
      asText(employee.display_name) ||
      asText(employee.full_name) ||
      asText(employee.email) ||
      "Unnamed user";

    rows.push({
      key: `employee:${asText(employee.id) || authUserId || displayName}`,
      employee_id: asText(employee.id) || null,
      auth_user_id: authUserId || null,
      name: displayName,
      email: asText(employee.email) || null,
      role: asText(employee.role) || asText(membership?.role) || null,
      status: membership?.is_active === false || employee.is_active === false
        ? "Inactive"
        : asText(employee.status) || "Active",
      membership_role: asText(membership?.role) || null,
      membership_is_active: membership?.is_active !== false,
      employee_is_active: employee.is_active !== false,
      mobile_access_enabled: employee.mobile_access_enabled === null ? null : Boolean(employee.mobile_access_enabled),
      workstation_access_enabled: employee.workstation_access_enabled === null ? null : Boolean(employee.workstation_access_enabled),
      trusted_device_count: authUserId ? trustedByUser.get(authUserId) ?? 0 : 0,
      mfa_state: "unknown",
      created_at: employee.created_at ?? membership?.created_at ?? null,
    });

    if (authUserId) seenUserIds.add(authUserId);
  }

  for (const member of members) {
    const userId = asText(member.user_id);
    if (!userId || seenUserIds.has(userId)) continue;

    const profile = profilesByUserId.get(userId) ?? null;
    const profileName = [asText(profile?.first_name), asText(profile?.last_name)].filter(Boolean).join(" ").trim();
    const email = asText(profile?.email) || null;

    rows.push({
      key: `member:${userId}`,
      employee_id: null,
      auth_user_id: userId,
      name: profileName || email || "Not surfaced",
      email: email || null,
      role: asText(member.role) || null,
      status: member.is_active === false ? "Inactive" : "Membership only",
      membership_role: asText(member.role) || null,
      membership_is_active: member.is_active !== false,
      employee_is_active: null,
      mobile_access_enabled: null,
      workstation_access_enabled: null,
      trusted_device_count: trustedByUser.get(userId) ?? 0,
      mfa_state: "unknown",
      created_at: member.created_at ?? null,
    });
  }

  rows.sort((left, right) => left.name.localeCompare(right.name));

  const mobileReviewResult = await admin
    .from("time_events")
    .select("id,employee_id,updated_at")
    .eq("shop_id", shopId)
    .eq("needs_review", true)
    .order("updated_at", { ascending: false })
    .limit(50);

  const mobileReviewRows = (mobileReviewResult.data ?? []) as TimeclockReviewRow[];

  return {
    rows,
    counts: {
      mobileReviewCount: mobileReviewRows.length,
      trustedDeviceCount: rows.reduce((sum, row) => sum + row.trusted_device_count, 0),
    },
  };
}

async function loadAuditRows(shopId: string): Promise<AuditRow[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_audit_log")
    .select("id,action,actor_email,created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) return [];

  return ((data ?? []) as Array<{ id: string | null; action: string | null; actor_email: string | null; created_at: string | null }>).map((row) => ({
    id: asText(row.id),
    action: asText(row.action) || "event",
    actor_email: asText(row.actor_email) || null,
    created_at: row.created_at ?? null,
  }));
}

async function loadSupportRows(shopId: string): Promise<SupportBundleRow[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_support_bundles")
    .select("id,file_path,notes,uploaded_by,created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return [];

  return ((data ?? []) as Array<{ id: string | null; file_path: string | null; notes: string | null; uploaded_by: string | null; created_at: string | null }>).map((row) => ({
    id: asText(row.id),
    file_path: row.file_path ?? null,
    notes: row.notes ?? null,
    uploaded_by: row.uploaded_by ?? null,
    created_at: row.created_at ?? null,
  }));
}

function ShopTabNav({
  shopId,
  activeTab,
}: {
  shopId: string;
  activeTab: ShopTabKey;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        padding: 8,
        borderRadius: t.radius.lg,
        border: `1px solid ${t.color.softBorder}`,
        background: "linear-gradient(180deg, rgba(16, 23, 34, 0.92), rgba(11, 16, 24, 0.92))",
      }}
    >
      {SHOP_TABS.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <ControlActionLink
            key={tab.key}
            href={tab.key === "overview" ? `/shops/${shopId}` : `/shops/${shopId}?tab=${tab.key}`}
            tone={active ? "primary" : "ghost"}
          >
            {tab.label}
          </ControlActionLink>
        );
      })}
    </div>
  );
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
            borderRadius: t.radius.md,
            border: `1px solid ${t.color.softBorder}`,
            background: "rgba(7, 10, 15, 0.34)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.72, textTransform: "uppercase", color: t.color.textMuted }}>
            {item.label}
          </div>
          <div style={{ color: t.color.textSecondary, fontSize: 13, lineHeight: 1.55 }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function IssueList({
  issues,
}: {
  issues: Array<{ title: string; detail: string; tone: ControlStatusTone }>;
}) {
  if (issues.length === 0) {
    return (
      <ControlEmptyState
        title="No current issues"
        description="Control does not see any billing restrictions, offline devices, or review queues that need immediate shop-level attention."
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {issues.map((issue) => (
        <div
          key={`${issue.title}:${issue.detail}`}
          style={{
            display: "grid",
            gap: 8,
            padding: 14,
            borderRadius: t.radius.md,
            border: `1px solid ${t.color.softBorder}`,
            background: "rgba(7, 10, 15, 0.32)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: t.color.text, fontWeight: 800, fontSize: 14 }}>{issue.title}</div>
            <ControlStatusChip label={issue.tone === "danger" ? "Critical" : issue.tone === "warning" ? "Watch" : "Info"} tone={issue.tone} />
          </div>
          <div style={{ color: t.color.textMuted, fontSize: 13, lineHeight: 1.55 }}>{issue.detail}</div>
        </div>
      ))}
    </div>
  );
}

function ActivityTable({
  rows,
}: {
  rows: AuditRow[];
}) {
  if (rows.length === 0) {
    return (
      <ControlEmptyState
        title="No recent audit activity"
        description="No recent shop-scoped audit rows are available for this workspace right now."
      />
    );
  }

  return (
    <ControlTableWrap>
      <ControlTable minWidth={720}>
        <thead>
          <tr>
            <ControlTableHeadCell>Action</ControlTableHeadCell>
            <ControlTableHeadCell>Actor</ControlTableHeadCell>
            <ControlTableHeadCell>Recorded</ControlTableHeadCell>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <ControlTableCell>{humanizeLabel(row.action, "event")}</ControlTableCell>
              <ControlTableCell>{row.actor_email ?? "System"}</ControlTableCell>
              <ControlTableCell>{formatMaybeDate(row.created_at)}</ControlTableCell>
            </tr>
          ))}
        </tbody>
      </ControlTable>
    </ControlTableWrap>
  );
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { shopId } = await params;
  const query = (await searchParams) ?? {};
  const activeTab = normalizeTab(query.tab);
  const context = await getViewerContext();
  const shop = selectPrimaryShop(context.shops, shopId);

  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <ControlPageHeader
          eyebrow="Shops"
          title="Shop Not Available"
          description="This shop is not inside the current authorized Control scope."
          actions={<ControlActionLink href="/shops" tone="primary">Back to shops</ControlActionLink>}
        />
        <ControlPanel>
          <ControlEmptyState
            title="Choose a different shop"
            description="Return to the directory and open a workspace that exists inside the current cloud-authority scope."
            action={<ControlActionLink href="/shops" tone="primary">Open shops</ControlActionLink>}
          />
        </ControlPanel>
      </div>
    );
  }

  const [snapshot, deviceRows, memberData, auditRows, supportRows, billingSummary] = await Promise.all([
    getShopSnapshot(shop),
    loadShopDeviceRows(shop.id),
    loadShopMembers(shop.id),
    loadAuditRows(shop.id),
    loadSupportRows(shop.id),
    loadBillingSummary(shop.id),
  ]);

  const workstationRows = deviceRows.filter((row) => asText(row.device_type).toLowerCase() === "workstation");
  const mobileReadyRows = memberData.rows.filter((row) => row.mobile_access_enabled === true);
  const createdAt = billingSummary?.created_at ?? shop.created_at ?? null;
  const issues: Array<{ title: string; detail: string; tone: ControlStatusTone }> = [];

  if (snapshot.access.state === "restricted" || snapshot.access.state === "expired" || snapshot.access.state === "grace") {
    issues.push({
      title: "Billing and access attention required",
      detail: snapshot.access.summary,
      tone: snapshot.access.state === "grace" ? "warning" : "danger",
    });
  }
  if (snapshot.health.offline_devices > 0) {
    issues.push({
      title: "Offline devices detected",
      detail: `${snapshot.health.offline_devices} device${snapshot.health.offline_devices === 1 ? "" : "s"} have not checked in recently enough to stay operational.`,
      tone: "danger",
    });
  }
  if (snapshot.health.stale_devices > 0 && snapshot.health.offline_devices === 0) {
    issues.push({
      title: "Stale devices need review",
      detail: `${snapshot.health.stale_devices} device${snapshot.health.stale_devices === 1 ? "" : "s"} are stale but not yet fully offline.`,
      tone: "warning",
    });
  }
  if (memberData.counts.mobileReviewCount > 0) {
    issues.push({
      title: "Mobile timeclock queue pending review",
      detail: `${memberData.counts.mobileReviewCount} timeclock event${memberData.counts.mobileReviewCount === 1 ? "" : "s"} are waiting for review.`,
      tone: "warning",
    });
  }

  const headerActions = [
    <ControlActionLink key="back" href="/shops">Back to shops</ControlActionLink>,
    <ControlActionLink key="billing" href={`/shops/${shop.id}?tab=billing`} tone="secondary">Billing & access</ControlActionLink>,
  ];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Shop Profile"
        title={snapshot.name}
        description="Cloud authority view of this shop's identity, billing outcomes, access modes, members, enrolled devices, and support metadata."
        actions={headerActions}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard
          label="Billing Status"
          value={humanizeLabel(snapshot.billing_status, "Unknown")}
          meta={snapshot.access.summary}
          tone={billingTone(snapshot.billing_status)}
        />
        <ControlMetricCard
          label="Desktop Access"
          value={renderAccessModeLabel(snapshot.access.desktop_mode)}
          meta="Effective desktop mode under the current Control entitlement decision."
          tone={snapshot.access.desktop_mode === "full" ? "success" : snapshot.access.desktop_mode === "read_only" ? "warning" : "danger"}
        />
        <ControlMetricCard
          label="Mobile Access"
          value={renderAccessModeLabel(snapshot.access.mobile_mode)}
          meta={memberData.counts.mobileReviewCount > 0 ? `${memberData.counts.mobileReviewCount} review item${memberData.counts.mobileReviewCount === 1 ? "" : "s"} pending.` : "No mobile review queue is pending."}
          tone={snapshot.access.mobile_mode === "full" ? "success" : snapshot.access.mobile_mode === "queue_only" ? "warning" : "danger"}
        />
        <ControlMetricCard
          label="Workstation Access"
          value={renderAccessModeLabel(snapshot.access.workstation_mode)}
          meta={`${snapshot.counts.workstations_active} active workstation${snapshot.counts.workstations_active === 1 ? "" : "s"} currently enrolled.`}
          tone={snapshot.access.workstation_mode === "full" ? "success" : "danger"}
        />
      </div>

      <ShopTabNav shopId={shop.id} activeTab={activeTab} />

      {activeTab === "overview" ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)", gap: 18 }}>
            <ControlPanel
              title="Shop Identity"
              description="Core shop identity and the Control-side access posture for this authorized workspace."
            >
              <KeyValueGrid
                items={[
                  { label: "Shop Name", value: snapshot.name },
                  { label: "Viewer Role", value: humanizeLabel(snapshot.member_role, "member") },
                  { label: "Plan", value: humanizeLabel(billingSummary?.subscription_plan, "Not set") },
                  { label: "Created", value: formatMaybeDate(createdAt) },
                  { label: "Billing Status", value: <ControlStatusChip label={humanizeLabel(snapshot.billing_status, "Unknown")} tone={billingTone(snapshot.billing_status)} /> },
                  { label: "Access Status", value: <ControlStatusChip label={snapshot.access.display_status} tone={accessTone(snapshot)} /> },
                ]}
              />
            </ControlPanel>

            <ControlPanel
              title="RunBook Access Modes"
              description="These are the effective product outcomes for the current entitlement state, not just raw Stripe metadata."
            >
              <KeyValueGrid
                items={[
                  { label: "Desktop", value: renderAccessModeLabel(snapshot.access.desktop_mode) },
                  { label: "Mobile", value: renderAccessModeLabel(snapshot.access.mobile_mode) },
                  { label: "Workstation", value: renderAccessModeLabel(snapshot.access.workstation_mode) },
                  { label: "Trial End", value: formatMaybeDate(snapshot.trial_ends_at) },
                  { label: "Grace End", value: formatMaybeDate(snapshot.grace_ends_at) },
                  { label: "Current Period End", value: formatMaybeDate(snapshot.billing_current_period_end) },
                ]}
              />
            </ControlPanel>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <ControlMetricCard label="Members" value={String(memberData.rows.length)} meta={`${snapshot.counts.employees_active} active employee record${snapshot.counts.employees_active === 1 ? "" : "s"}.`} tone="neutral" />
            <ControlMetricCard label="Devices" value={String(snapshot.counts.devices_total)} meta={`${snapshot.counts.devices_active} active device${snapshot.counts.devices_active === 1 ? "" : "s"}.`} tone={snapshot.health.offline_devices > 0 ? "warning" : "success"} />
            <ControlMetricCard label="Workstations" value={String(snapshot.counts.workstations_total)} meta={`${snapshot.counts.workstations_active} active workstation${snapshot.counts.workstations_active === 1 ? "" : "s"}.`} tone={snapshot.access.workstation_mode === "full" ? "success" : "warning"} />
            <ControlMetricCard label="Mobile Users" value={String(snapshot.counts.employees_mobile_ready)} meta={`${memberData.counts.mobileReviewCount} review queue item${memberData.counts.mobileReviewCount === 1 ? "" : "s"}.`} tone={memberData.counts.mobileReviewCount > 0 ? "warning" : "info"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)", gap: 18 }}>
            <ControlPanel
              title="Recent Issues"
              description="Current shop-level conditions that need attention from billing, device, or access support."
            >
              <IssueList issues={issues} />
            </ControlPanel>

            <ControlPanel
              title="Recent Activity"
              description="Latest audit rows recorded for this shop scope."
              actions={<ControlActionLink href={`/shops/${shop.id}?tab=audit`}>Open audit</ControlActionLink>}
            >
              <ActivityTable rows={auditRows.slice(0, 6)} />
            </ControlPanel>
          </div>
        </div>
      ) : null}

      {activeTab === "billing" ? (
        <div style={{ display: "grid", gap: 18 }}>
          <ControlPanel
            title="Billing and Access Summary"
            description="RunBook product behavior under the current billing and entitlement outcome. This stays focused on what the customer can actually do."
          >
            <KeyValueGrid
              items={[
                { label: "Desktop", value: renderAccessModeLabel(snapshot.access.desktop_mode) },
                { label: "Mobile", value: renderAccessModeLabel(snapshot.access.mobile_mode) },
                { label: "Workstation", value: renderAccessModeLabel(snapshot.access.workstation_mode) },
                { label: "Billing Status", value: <ControlStatusChip label={humanizeLabel(snapshot.billing_status, "Unknown")} tone={billingTone(snapshot.billing_status)} /> },
                { label: "Subscription Status", value: humanizeLabel(snapshot.access.billing_status, "Unknown") },
                { label: "Plan", value: humanizeLabel(billingSummary?.subscription_plan, "Not set") },
                { label: "Trial End", value: formatMaybeDate(snapshot.trial_ends_at) },
                { label: "Grace End", value: formatMaybeDate(snapshot.grace_ends_at) },
                { label: "Entitlement Override", value: humanizeLabel(billingSummary?.entitlement_override, "Normal logic") },
                { label: "Manual Billing Override", value: billingSummary?.manual_billing_override ? humanizeLabel(billingSummary.manual_billing_status, "Enabled") : "Off" },
                { label: "Stripe Customer", value: billingSummary?.stripe_customer_id ?? "Not set" },
                { label: "Stripe Subscription", value: billingSummary?.stripe_subscription_id ?? "Not set" },
              ]}
            />
          </ControlPanel>

          <BillingControlPanel shopId={shop.id} shopName={snapshot.name} />
        </div>
      ) : null}

      {activeTab === "members" ? (
        <ControlPanel
          title="Members"
          description="Server-side view of shop members and employee access posture. MFA per member is not currently surfaced in this repo, so that column stays explicit about the gap."
        >
          {memberData.rows.length === 0 ? (
            <ControlEmptyState
              title="No members or employees found"
              description="This shop does not currently have member or employee records that Control can display."
            />
          ) : (
            <ControlTableWrap>
              <ControlTable minWidth={1080}>
                <thead>
                  <tr>
                    <ControlTableHeadCell>Name</ControlTableHeadCell>
                    <ControlTableHeadCell>Email</ControlTableHeadCell>
                    <ControlTableHeadCell>Role</ControlTableHeadCell>
                    <ControlTableHeadCell>Status</ControlTableHeadCell>
                    <ControlTableHeadCell>MFA</ControlTableHeadCell>
                    <ControlTableHeadCell>Mobile Access</ControlTableHeadCell>
                    <ControlTableHeadCell>Workstation Access</ControlTableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {memberData.rows.map((row) => (
                    <tr key={row.key}>
                      <ControlTableCell>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ color: t.color.text, fontWeight: 700 }}>{row.name}</div>
                          <div style={{ fontSize: 12, color: t.color.textMuted }}>{formatMaybeDate(row.created_at)}</div>
                        </div>
                      </ControlTableCell>
                      <ControlTableCell>{row.email ?? "Not available"}</ControlTableCell>
                      <ControlTableCell>{humanizeLabel(row.role ?? row.membership_role, "Not assigned")}</ControlTableCell>
                      <ControlTableCell>
                        <ControlStatusChip label={row.status} tone={memberStatusTone(row.status)} />
                      </ControlTableCell>
                      <ControlTableCell>
                        <ControlStatusChip label="Not surfaced" tone="neutral" />
                      </ControlTableCell>
                      <ControlTableCell>
                        <ControlStatusChip
                          label={row.mobile_access_enabled === true ? "Ready" : row.mobile_access_enabled === false ? "Disabled" : "Unknown"}
                          tone={row.mobile_access_enabled === true ? "success" : row.mobile_access_enabled === false ? "danger" : "neutral"}
                        />
                      </ControlTableCell>
                      <ControlTableCell>
                        <ControlStatusChip
                          label={row.workstation_access_enabled === true ? "Ready" : row.workstation_access_enabled === false ? "Disabled" : "Unknown"}
                          tone={row.workstation_access_enabled === true ? "success" : row.workstation_access_enabled === false ? "danger" : "neutral"}
                        />
                      </ControlTableCell>
                    </tr>
                  ))}
                </tbody>
              </ControlTable>
            </ControlTableWrap>
          )}
        </ControlPanel>
      ) : null}

      {activeTab === "devices" ? (
        <ControlPanel
          title="Devices"
          description="Enrolled device records for this shop, using Control-side enrollment and heartbeat metadata only."
        >
          {deviceRows.length === 0 ? (
            <ControlEmptyState
              title="No devices enrolled"
              description="There are no enrolled device rows for this shop yet."
            />
          ) : (
            <ControlTableWrap>
              <ControlTable minWidth={920}>
                <thead>
                  <tr>
                    <ControlTableHeadCell>Device</ControlTableHeadCell>
                    <ControlTableHeadCell>Type</ControlTableHeadCell>
                    <ControlTableHeadCell>Status</ControlTableHeadCell>
                    <ControlTableHeadCell>Created</ControlTableHeadCell>
                    <ControlTableHeadCell>Last Seen</ControlTableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {deviceRows.map((row) => (
                    <tr key={row.id}>
                      <ControlTableCell>{row.name ?? row.id}</ControlTableCell>
                      <ControlTableCell>{humanizeLabel(row.device_type, "Unknown")}</ControlTableCell>
                      <ControlTableCell>
                        <ControlStatusChip label={humanizeLabel(row.status, "Unknown")} tone={deviceStatusTone(row.status)} />
                      </ControlTableCell>
                      <ControlTableCell>{formatMaybeDate(row.created_at)}</ControlTableCell>
                      <ControlTableCell>{formatMaybeDate(row.last_seen_at)}</ControlTableCell>
                    </tr>
                  ))}
                </tbody>
              </ControlTable>
            </ControlTableWrap>
          )}
        </ControlPanel>
      ) : null}

      {activeTab === "workstations" ? (
        <ControlPanel
          title="Workstations"
          description="Shop-scoped workstation enrollment and effective access posture."
          actions={<ControlActionLink href="/workstations">Open workstation area</ControlActionLink>}
        >
          {workstationRows.length === 0 ? (
            <ControlEmptyState
              title="No workstation rows found"
              description="No enrolled workstation device rows are available for this shop yet."
            />
          ) : (
            <ControlTableWrap>
              <ControlTable minWidth={860}>
                <thead>
                  <tr>
                    <ControlTableHeadCell>Workstation</ControlTableHeadCell>
                    <ControlTableHeadCell>Status</ControlTableHeadCell>
                    <ControlTableHeadCell>Created</ControlTableHeadCell>
                    <ControlTableHeadCell>Last Seen</ControlTableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {workstationRows.map((row) => (
                    <tr key={row.id}>
                      <ControlTableCell>{row.name ?? row.id}</ControlTableCell>
                      <ControlTableCell>
                        <ControlStatusChip
                          label={snapshot.access.workstation_mode === "full" ? humanizeLabel(row.status, "Unknown") : "Blocked by policy"}
                          tone={snapshot.access.workstation_mode === "full" ? deviceStatusTone(row.status) : "danger"}
                        />
                      </ControlTableCell>
                      <ControlTableCell>{formatMaybeDate(row.created_at)}</ControlTableCell>
                      <ControlTableCell>{formatMaybeDate(row.last_seen_at)}</ControlTableCell>
                    </tr>
                  ))}
                </tbody>
              </ControlTable>
            </ControlTableWrap>
          )}
        </ControlPanel>
      ) : null}

      {activeTab === "mobile" ? (
        <ControlPanel
          title="Mobile Access"
          description="Mobile-ready employees and the current review queue recorded through Control."
        >
          {mobileReadyRows.length === 0 ? (
            <ControlEmptyState
              title="No mobile-ready users"
              description="No employee records are currently marked as mobile-ready for this shop."
            />
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <KeyValueGrid
                items={[
                  { label: "Mobile-ready users", value: String(mobileReadyRows.length) },
                  { label: "Review queue", value: String(memberData.counts.mobileReviewCount) },
                  { label: "Effective mobile mode", value: renderAccessModeLabel(snapshot.access.mobile_mode) },
                  { label: "Trusted devices", value: String(memberData.counts.trustedDeviceCount) },
                ]}
              />
              <ControlTableWrap>
                <ControlTable minWidth={860}>
                  <thead>
                    <tr>
                      <ControlTableHeadCell>Name</ControlTableHeadCell>
                      <ControlTableHeadCell>Email</ControlTableHeadCell>
                      <ControlTableHeadCell>Role</ControlTableHeadCell>
                      <ControlTableHeadCell>Status</ControlTableHeadCell>
                      <ControlTableHeadCell>Mobile Access</ControlTableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {mobileReadyRows.map((row) => (
                      <tr key={row.key}>
                        <ControlTableCell>{row.name}</ControlTableCell>
                        <ControlTableCell>{row.email ?? "Not available"}</ControlTableCell>
                        <ControlTableCell>{humanizeLabel(row.role ?? row.membership_role, "Not assigned")}</ControlTableCell>
                        <ControlTableCell><ControlStatusChip label={row.status} tone={memberStatusTone(row.status)} /></ControlTableCell>
                        <ControlTableCell><ControlStatusChip label="Ready" tone="success" /></ControlTableCell>
                      </tr>
                    ))}
                  </tbody>
                </ControlTable>
              </ControlTableWrap>
            </div>
          )}
        </ControlPanel>
      ) : null}

      {activeTab === "audit" ? (
        <ControlPanel
          title="Audit"
          description="Recent shop-scoped audit rows recorded by Control."
          actions={<ControlActionLink href="/audit">Open full audit log</ControlActionLink>}
        >
          <ActivityTable rows={auditRows} />
        </ControlPanel>
      ) : null}

      {activeTab === "support" ? (
        <ControlPanel
          title="Support"
          description="Control metadata for support bundles recorded against this shop."
          actions={<ControlActionLink href={`/support?shop=${encodeURIComponent(shop.id)}`}>Open support area</ControlActionLink>}
        >
          {supportRows.length === 0 ? (
            <ControlEmptyState
              title="No support bundles recorded"
              description="Control does not currently have support-bundle metadata recorded for this shop."
              action={<ControlActionLink href="/support/bundle" tone="primary">Upload support bundle</ControlActionLink>}
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
                      <ControlTableCell>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ color: t.color.text, fontWeight: 700 }}>{fileName(row.file_path)}</div>
                          <div style={{ fontSize: 12, color: t.color.textMuted }}>{row.notes ?? "No notes"}</div>
                        </div>
                      </ControlTableCell>
                      <ControlTableCell>{row.file_path ?? "No stored path"}</ControlTableCell>
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

      {activeTab === "settings" ? (
        <ControlPanel
          title="Settings and Policies"
          description="Shop-specific policy surfaces stay scoped and can expand further in a later phase."
          actions={<ControlActionLink href={`/shops/${shop.id}/policy`} tone="secondary">Open policy page</ControlActionLink>}
        >
          <KeyValueGrid
            items={[
              { label: "Desktop mode", value: renderAccessModeLabel(snapshot.access.desktop_mode) },
              { label: "Mobile mode", value: renderAccessModeLabel(snapshot.access.mobile_mode) },
              { label: "Workstation mode", value: renderAccessModeLabel(snapshot.access.workstation_mode) },
              { label: "Last device activity", value: formatMaybeDate(snapshot.health.last_device_activity_at) },
            ]}
          />
        </ControlPanel>
      ) : null}
    </div>
  );
}
