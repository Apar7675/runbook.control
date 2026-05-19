import { getShopSnapshot, getViewerContext, type ShopSnapshot, type ViewerContext } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PersonRowType = "Control User" | "Shop Member" | "Employee";

export type PeopleDirectoryRow = {
  key: string;
  type: PersonRowType;
  name: string;
  email: string | null;
  shop_id: string | null;
  shop_name: string | null;
  role: string | null;
  mfa_label: string;
  status_label: string;
  mobile_access_label: string;
  workstation_access_label: string;
  mobile_access_tone: RowTone;
  workstation_access_tone: RowTone;
  status_tone: RowTone;
  action_href: string | null;
  action_label: string | null;
  created_at: string | null;
};

export type MobileAccessRow = {
  key: string;
  employee_id: string;
  name: string;
  email: string | null;
  shop_id: string;
  shop_name: string;
  access_mode: "full" | "queue_only" | "blocked";
  mobile_timeclock_enabled: boolean | null;
  review_required: boolean | null;
  status_label: string;
  status_tone: RowTone;
  last_mobile_activity_at: string | null;
  action_href: string | null;
};

export type TimeclockReviewRow = {
  id: string;
  employee_name: string;
  shop_id: string | null;
  shop_name: string | null;
  event_type: string | null;
  client_time: string | null;
  server_time: string | null;
  source: string | null;
  offline: boolean | null;
  reason: string | null;
  status_label: string;
  action_href: string | null;
};

export type RowTone = "success" | "warning" | "danger" | "neutral" | "info";

export type PeopleViewsData = {
  context: ViewerContext;
  shopSnapshots: Map<string, ShopSnapshot>;
  peopleRows: PeopleDirectoryRow[];
  mobileRows: MobileAccessRow[];
  timeclockRows: TimeclockReviewRow[];
  summary: {
    totalPeople: number;
    shopMembers: number;
    employees: number;
    mobileEnabled: number;
    workstationEnabled: number;
    workstationBlocked: number;
    mobileQueueOnly: number;
    mobileBlocked: number;
    mobileReviewRequired: number;
    recentMobileEvents: number;
    reviewNeedsAttention: number;
    reviewPendingToday: number;
    reviewOfflinePunches: number;
    reviewMobileSourceEvents: number;
    reviewBlockedOrRejected: number;
  };
  actions: {
    timeclockApprovalSurfaced: boolean;
  };
};

type EmployeeDbRow = {
  id: string | null;
  shop_id: string | null;
  auth_user_id: string | null;
  employee_code: string | null;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  is_active: boolean | null;
  mobile_access_enabled: boolean | null;
  mobile_timeclock_enabled: boolean | null;
  mobile_timeclock_requires_review: boolean | null;
  workstation_access_enabled: boolean | null;
  runbook_access_enabled: boolean | null;
  created_at: string | null;
};

type MemberDbRow = {
  shop_id: string | null;
  user_id: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type AdminDbRow = {
  user_id: string | null;
  created_at?: string | null;
};

type ProfileDbRow = {
  id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type TimeEventDbRow = {
  id: string | null;
  shop_id: string | null;
  employee_id: string | null;
  event_type?: string | null;
  client_ts?: string | null;
  server_ts?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  source?: string | null;
  is_offline?: boolean | null;
  needs_review?: boolean | null;
  policy_result?: string | null;
  policy_reason?: string | null;
};

type EmployeeViewSeed = {
  employee_id: string;
  shop_id: string;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  role: string | null;
  status: string | null;
  is_active: boolean;
  mobile_access_enabled: boolean;
  mobile_timeclock_enabled: boolean | null;
  mobile_timeclock_requires_review: boolean | null;
  workstation_access_enabled: boolean;
  created_at: string | null;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function isoOrNull(value: unknown) {
  const text = asText(value);
  return text || null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function humanize(value: string | null | undefined, fallback: string) {
  const text = asText(value);
  return text ? text.replaceAll("_", " ") : fallback;
}

function fullName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return [asText(firstName), asText(lastName)].filter(Boolean).join(" ").trim();
}

function newestIso(...values: Array<string | null | undefined>) {
  let winner: string | null = null;
  for (const value of values) {
    const text = asText(value);
    if (!text) continue;
    if (!winner || text > winner) winner = text;
  }
  return winner;
}

function safeDateMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isToday(value: string | null | undefined) {
  const ms = safeDateMs(value);
  if (ms === null) return false;
  const date = new Date(ms);
  const now = new Date();
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

function isRecentWithinDays(value: string | null | undefined, days: number) {
  const ms = safeDateMs(value);
  if (ms === null) return false;
  return Date.now() - ms <= days * 24 * 60 * 60 * 1000;
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

async function loadShopSnapshots(context: ViewerContext) {
  const snapshots = await Promise.all(context.shops.map((shop) => getShopSnapshot(shop)));
  return new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
}

async function loadEmployees(shopIds: string[]) {
  if (shopIds.length === 0) return [] as EmployeeDbRow[];

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("employees")
    .select("id,shop_id,auth_user_id,employee_code,display_name,full_name,email,role,status,is_active,mobile_access_enabled,mobile_timeclock_enabled,mobile_timeclock_requires_review,workstation_access_enabled,runbook_access_enabled,created_at")
    .in("shop_id", shopIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return asArray<EmployeeDbRow>(data);
}

async function loadMembers(shopIds: string[]) {
  if (shopIds.length === 0) return [] as MemberDbRow[];

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("shop_id,user_id,role,is_active,created_at")
    .in("shop_id", shopIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return asArray<MemberDbRow>(data);
}

async function loadControlAdmins(includeAdmins: boolean) {
  if (!includeAdmins) return [] as AdminDbRow[];

  const admin = supabaseAdmin();
  const columns = ["user_id", "created_at"];
  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt += 1) {
    const { data, error } = await admin
      .from("rb_control_admins")
      .select(working.join(","))
      .order("created_at", { ascending: false });

    if (!error) return asArray<AdminDbRow>(data);

    const missingColumn = tryExtractMissingColumn(String(error.message ?? ""));
    if (missingColumn && working.includes(missingColumn)) {
      working = working.filter((column) => column !== missingColumn);
      continue;
    }

    throw new Error(error.message);
  }

  return [] as AdminDbRow[];
}

async function loadProfiles(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const profileMap = new Map<string, ProfileDbRow>();
  if (ids.length === 0) return profileMap;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rb_profiles")
    .select("id,first_name,last_name,email,phone")
    .in("id", ids);

  if (error) return profileMap;

  for (const row of asArray<ProfileDbRow>(data)) {
    const id = asText(row.id);
    if (!id) continue;
    profileMap.set(id, row);
  }

  return profileMap;
}

async function loadTimeEventRows(shopIds: string[]) {
  if (shopIds.length === 0) return [] as TimeEventDbRow[];

  const admin = supabaseAdmin();
  const columns = [
    "id",
    "shop_id",
    "employee_id",
    "event_type",
    "client_ts",
    "server_ts",
    "updated_at",
    "created_at",
    "source",
    "is_offline",
    "needs_review",
    "policy_result",
    "policy_reason",
  ];
  let working = [...columns];

  for (let attempt = 0; attempt < columns.length; attempt += 1) {
    const { data, error } = await admin
      .from("time_events")
      .select(working.join(","))
      .in("shop_id", shopIds)
      .order("updated_at", { ascending: false })
      .limit(1500);

    if (!error) return asArray<TimeEventDbRow>(data);

    const missingColumn = tryExtractMissingColumn(String(error.message ?? ""));
    if (missingColumn && working.includes(missingColumn)) {
      working = working.filter((column) => column !== missingColumn);
      continue;
    }

    throw new Error(error.message);
  }

  return [] as TimeEventDbRow[];
}

function employeeSeed(row: EmployeeDbRow) {
  const employeeId = asText(row.id);
  const shopId = asText(row.shop_id);
  if (!employeeId || !shopId) return null;

  return {
    employee_id: employeeId,
    shop_id: shopId,
    auth_user_id: isoOrNull(row.auth_user_id),
    name: asText(row.display_name) || asText(row.full_name) || asText(row.email) || "Unnamed employee",
    email: isoOrNull(row.email),
    role: isoOrNull(row.role),
    status: isoOrNull(row.status),
    is_active: row.is_active !== false,
    mobile_access_enabled: asBoolean(row.mobile_access_enabled),
    mobile_timeclock_enabled: row.mobile_timeclock_enabled === null ? null : asBoolean(row.mobile_timeclock_enabled),
    mobile_timeclock_requires_review:
      row.mobile_timeclock_requires_review === null ? null : asBoolean(row.mobile_timeclock_requires_review),
    workstation_access_enabled: asBoolean(row.workstation_access_enabled),
    created_at: isoOrNull(row.created_at),
  } satisfies EmployeeViewSeed;
}

function employeeStatusLabel(seed: EmployeeViewSeed) {
  if (!seed.is_active) return "Inactive";
  const status = asText(seed.status);
  return status ? humanize(status, "Active") : "Active";
}

function employeeStatusTone(seed: EmployeeViewSeed): RowTone {
  const text = employeeStatusLabel(seed).toLowerCase();
  if (text.includes("active")) return "success";
  if (text.includes("review") || text.includes("pending")) return "warning";
  if (text.includes("inactive") || text.includes("blocked") || text.includes("disabled")) return "danger";
  return "neutral";
}

function effectiveMobileAccess(seed: EmployeeViewSeed, snapshot: ShopSnapshot | null) {
  if (!snapshot) {
    return { label: "Not surfaced", tone: "neutral" as const, mode: "blocked" as const };
  }

  if (!seed.mobile_access_enabled) {
    return { label: "Disabled", tone: "danger" as const, mode: "blocked" as const };
  }

  if (snapshot.access.mobile_mode === "blocked") {
    return { label: "Blocked by shop", tone: "danger" as const, mode: "blocked" as const };
  }

  if (snapshot.access.mobile_mode === "queue_only") {
    return { label: "Queue only", tone: "warning" as const, mode: "queue_only" as const };
  }

  return { label: "Full", tone: "success" as const, mode: "full" as const };
}

function effectiveWorkstationAccess(seed: EmployeeViewSeed, snapshot: ShopSnapshot | null) {
  if (!snapshot) return { label: "Not surfaced", tone: "neutral" as const };
  if (!seed.workstation_access_enabled) return { label: "Disabled", tone: "danger" as const };
  if (snapshot.access.workstation_mode !== "full") return { label: "Blocked by shop", tone: "danger" as const };
  return { label: "Enabled", tone: "success" as const };
}

function lastActivityByEmployee(events: TimeEventDbRow[]) {
  const result = new Map<string, string>();
  for (const row of events) {
    const employeeId = asText(row.employee_id);
    const stamp = newestIso(row.server_ts ?? null, row.updated_at ?? null, row.created_at ?? null);
    if (!employeeId || !stamp) continue;
    const existing = result.get(employeeId);
    if (!existing || stamp > existing) result.set(employeeId, stamp);
  }
  return result;
}

export async function loadPeopleViews(): Promise<PeopleViewsData> {
  const context = await getViewerContext();
  const shopIds = context.shops.map((shop) => shop.id);
  const [shopSnapshots, employeesRaw, membersRaw, controlAdminsRaw, timeEventRows] = await Promise.all([
    loadShopSnapshots(context),
    loadEmployees(shopIds),
    loadMembers(shopIds),
    loadControlAdmins(context.isPlatformAdmin),
    loadTimeEventRows(shopIds),
  ]);

  const employeeSeeds = employeesRaw.map(employeeSeed).filter((row): row is EmployeeViewSeed => Boolean(row));
  const employeeByUserAndShop = new Map<string, EmployeeViewSeed>();
  const employeeById = new Map<string, EmployeeViewSeed>();
  const userIds = new Set<string>();

  for (const row of employeeSeeds) {
    employeeById.set(row.employee_id, row);
    if (row.auth_user_id) {
      employeeByUserAndShop.set(`${row.shop_id}:${row.auth_user_id}`, row);
      userIds.add(row.auth_user_id);
    }
  }

  for (const member of membersRaw) {
    const userId = asText(member.user_id);
    if (userId) userIds.add(userId);
  }
  for (const admin of controlAdminsRaw) {
    const userId = asText(admin.user_id);
    if (userId) userIds.add(userId);
  }

  const profilesById = await loadProfiles([...userIds]);

  const peopleRows: PeopleDirectoryRow[] = [];

  if (context.isPlatformAdmin) {
    for (const row of controlAdminsRaw) {
      const userId = asText(row.user_id);
      if (!userId) continue;
      const profile = profilesById.get(userId) ?? null;
      const name = fullName(profile?.first_name, profile?.last_name) || asText(profile?.email) || `Admin ${userId.slice(0, 8)}`;
      peopleRows.push({
        key: `control:${userId}`,
        type: "Control User",
        name,
        email: isoOrNull(profile?.email),
        shop_id: null,
        shop_name: null,
        role: "platform_admin",
        mfa_label: "Not surfaced",
        status_label: "Active",
        mobile_access_label: "Not surfaced",
        workstation_access_label: "Not surfaced",
        mobile_access_tone: "neutral",
        workstation_access_tone: "neutral",
        status_tone: "success",
        action_href: "/settings",
        action_label: "Open settings",
        created_at: isoOrNull(row.created_at),
      });
    }
  }

  for (const member of membersRaw) {
    const shopId = asText(member.shop_id);
    const userId = asText(member.user_id);
    if (!shopId || !userId) continue;
    const profile = profilesById.get(userId) ?? null;
    const snapshot = shopSnapshots.get(shopId) ?? null;
    const linkedEmployee = employeeByUserAndShop.get(`${shopId}:${userId}`) ?? null;
    const name =
      linkedEmployee?.name ||
      fullName(profile?.first_name, profile?.last_name) ||
      asText(profile?.email) ||
      `Member ${userId.slice(0, 8)}`;
    const mobile = linkedEmployee ? effectiveMobileAccess(linkedEmployee, snapshot) : { label: "Not surfaced", tone: "neutral" as const };
    const workstation = linkedEmployee
      ? effectiveWorkstationAccess(linkedEmployee, snapshot)
      : { label: "Not surfaced", tone: "neutral" as const };
    const statusLabel = member.is_active === false ? "Inactive" : "Active";

    peopleRows.push({
      key: `member:${shopId}:${userId}`,
      type: "Shop Member",
      name,
      email: linkedEmployee?.email ?? isoOrNull(profile?.email),
      shop_id: shopId,
      shop_name: snapshot?.name ?? context.shops.find((shop) => shop.id === shopId)?.name ?? "Unknown shop",
      role: isoOrNull(member.role),
      mfa_label: "Not surfaced",
      status_label: statusLabel,
      mobile_access_label: mobile.label,
      workstation_access_label: workstation.label,
      mobile_access_tone: mobile.tone,
      workstation_access_tone: workstation.tone,
      status_tone: member.is_active === false ? "danger" : "success",
      action_href: `/shops/${shopId}?tab=members`,
      action_label: "Open membership",
      created_at: isoOrNull(member.created_at),
    });
  }

  for (const row of employeeSeeds) {
    const snapshot = shopSnapshots.get(row.shop_id) ?? null;
    const mobile = effectiveMobileAccess(row, snapshot);
    const workstation = effectiveWorkstationAccess(row, snapshot);
    peopleRows.push({
      key: `employee:${row.employee_id}`,
      type: "Employee",
      name: row.name,
      email: row.email,
      shop_id: row.shop_id,
      shop_name: snapshot?.name ?? context.shops.find((shop) => shop.id === row.shop_id)?.name ?? "Unknown shop",
      role: row.role,
      mfa_label: "Not surfaced",
      status_label: employeeStatusLabel(row),
      mobile_access_label: mobile.label,
      workstation_access_label: workstation.label,
      mobile_access_tone: mobile.tone,
      workstation_access_tone: workstation.tone,
      status_tone: employeeStatusTone(row),
      action_href: `/shops/${row.shop_id}?tab=members`,
      action_label: "Open employee access",
      created_at: row.created_at,
    });
  }

  peopleRows.sort((left, right) => {
    const shopCompare = asText(left.shop_name).localeCompare(asText(right.shop_name));
    if (shopCompare !== 0) return shopCompare;
    return left.name.localeCompare(right.name);
  });

  const latestActivityByEmployee = lastActivityByEmployee(timeEventRows);
  const mobileRows: MobileAccessRow[] = employeeSeeds
    .filter((row) => row.mobile_access_enabled || row.mobile_timeclock_enabled === true || row.mobile_timeclock_requires_review === true)
    .map((row) => {
      const snapshot = shopSnapshots.get(row.shop_id) ?? null;
      const shopName = snapshot?.name ?? context.shops.find((shop) => shop.id === row.shop_id)?.name ?? "Unknown shop";
      const mobile = effectiveMobileAccess(row, snapshot);
      return {
        key: `mobile:${row.employee_id}`,
        employee_id: row.employee_id,
        name: row.name,
        email: row.email,
        shop_id: row.shop_id,
        shop_name: shopName,
        access_mode: mobile.mode,
        mobile_timeclock_enabled: row.mobile_timeclock_enabled,
        review_required: row.mobile_timeclock_requires_review,
        status_label: employeeStatusLabel(row),
        status_tone: employeeStatusTone(row),
        last_mobile_activity_at: latestActivityByEmployee.get(row.employee_id) ?? null,
        action_href: `/shops/${row.shop_id}?tab=mobile`,
      };
    })
    .sort((left, right) => {
      const shopCompare = left.shop_name.localeCompare(right.shop_name);
      if (shopCompare !== 0) return shopCompare;
      return left.name.localeCompare(right.name);
    });

  const timeclockRows: TimeclockReviewRow[] = timeEventRows
    .filter((row) => row.needs_review === true)
    .map((row) => {
      const employee = employeeById.get(asText(row.employee_id)) ?? null;
      const shopId = isoOrNull(row.shop_id);
      const shopName =
        (shopId ? shopSnapshots.get(shopId)?.name : null) ??
        (shopId ? context.shops.find((shop) => shop.id === shopId)?.name : null) ??
        null;
      return {
        id: asText(row.id),
        employee_name: employee?.name ?? "Unknown employee",
        shop_id: shopId,
        shop_name: shopName,
        event_type: isoOrNull(row.event_type),
        client_time: isoOrNull(row.client_ts),
        server_time: newestIso(row.server_ts ?? null, row.updated_at ?? null, row.created_at ?? null),
        source: isoOrNull(row.source),
        offline: typeof row.is_offline === "boolean" ? row.is_offline : null,
        reason: isoOrNull(row.policy_reason) ?? humanize(row.policy_result, "Pending review"),
        status_label: row.needs_review === true ? "Pending review" : humanize(row.policy_result, "Not surfaced"),
        action_href: shopId ? `/shops/${shopId}?tab=mobile` : null,
      };
    })
    .sort((left, right) => String(right.server_time ?? "").localeCompare(String(left.server_time ?? "")));

  const uniquePeople = new Set<string>();
  for (const row of peopleRows) {
    if (row.type === "Control User" && row.email) {
      uniquePeople.add(`email:${row.email.toLowerCase()}`);
      continue;
    }
    if (row.type !== "Control User" && row.shop_id && row.email) {
      uniquePeople.add(`shop-email:${row.shop_id}:${row.email.toLowerCase()}`);
      continue;
    }
    uniquePeople.add(row.key);
  }

  const recentMobileEvents = timeEventRows.filter((row) => {
    const source = asText(row.source).toLowerCase();
    return source.includes("mobile") && isRecentWithinDays(newestIso(row.server_ts ?? null, row.updated_at ?? null, row.created_at ?? null), 7);
  }).length;

  const reviewBlockedOrRejected = timeEventRows.filter((row) => {
    const result = asText(row.policy_result).toLowerCase();
    return result.includes("blocked") || result.includes("reject");
  }).length;

  return {
    context,
    shopSnapshots,
    peopleRows,
    mobileRows,
    timeclockRows,
    summary: {
      totalPeople: uniquePeople.size,
      shopMembers: membersRaw.length,
      employees: employeeSeeds.length,
      mobileEnabled: employeeSeeds.filter((row) => row.mobile_access_enabled).length,
      workstationEnabled: employeeSeeds.filter((row) => row.workstation_access_enabled).length,
      workstationBlocked: employeeSeeds.filter((row) => {
        const snapshot = shopSnapshots.get(row.shop_id) ?? null;
        return !row.workstation_access_enabled || snapshot?.access.workstation_mode !== "full";
      }).length,
      mobileQueueOnly: mobileRows.filter((row) => row.access_mode === "queue_only").length,
      mobileBlocked: employeeSeeds.filter((row) => effectiveMobileAccess(row, shopSnapshots.get(row.shop_id) ?? null).mode === "blocked").length,
      mobileReviewRequired: employeeSeeds.filter((row) => row.mobile_timeclock_requires_review === true).length,
      recentMobileEvents,
      reviewNeedsAttention: timeclockRows.length,
      reviewPendingToday: timeclockRows.filter((row) => isToday(row.server_time)).length,
      reviewOfflinePunches: timeclockRows.filter((row) => row.offline === true).length,
      reviewMobileSourceEvents: timeclockRows.filter((row) => asText(row.source).toLowerCase().includes("mobile")).length,
      reviewBlockedOrRejected,
    },
    actions: {
      timeclockApprovalSurfaced: false,
    },
  };
}
