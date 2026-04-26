"use client";

import React from "react";
import GlassCard from "@/components/GlassCard";
import {
  ControlButton,
  ControlInput,
  MetricCard,
  StatusBadge,
  toneFromStatus,
} from "@/components/control/ui";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";
import { theme } from "@/lib/ui/theme";
import ShopUserDrawer, { type ShopUserRow } from "@/components/shops/ShopUserDrawer";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

type UsersResponse = {
  ok: true;
  shop_id: string;
  admin: { is_platform_admin: boolean };
  summary: {
    member_count: number;
    employee_count: number;
    active_employee_count: number;
    mobile_ready_count: number;
    workstation_ready_count: number;
    trusted_device_count: number;
  };
  users: ShopUserRow[];
};

type QueryState = "loading" | "ready" | "error";

export default function ShopUsersManager({
  shopId,
  shopName,
}: {
  shopId: string;
  shopName: string;
}) {
  const [queryState, setQueryState] = React.useState<QueryState>("loading");
  const [status, setStatus] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState<ShopUserRow | null>(null);
  const [summary, setSummary] = React.useState<UsersResponse["summary"] | null>(null);
  const [users, setUsers] = React.useState<ShopUserRow[]>([]);
  const loading = queryState === "loading";
  const queryFailed = queryState === "error";

  async function loadUsers() {
    setQueryState("loading");
    setStatus("");
    const response = await safeFetch<UsersResponse>(`/api/admin/users/list?shop_id=${encodeURIComponent(shopId)}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setSummary(null);
      setUsers([]);
      setStatus(response.ok ? (response.data as any)?.error ?? "Could not load users." : `${response.status}: ${response.error}`);
      setQueryState("error");
      return;
    }

    setSummary(response.data.summary);
    setUsers(response.data.users ?? []);
    setStatus("");
    setQueryState("ready");
  }

  React.useEffect(() => {
    loadUsers();
  }, [shopId]);

  const filteredUsers = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;

    return users.filter((user) =>
      [
        user.display_name,
        user.email,
        user.phone,
        user.employee_code,
        user.employee_role,
        user.membership_role,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [query, users]);

  const metricValues = queryFailed
    ? {
        members: "Unavailable",
        employees: "Unavailable",
        mobile: "Unavailable",
        workstation: "Unavailable",
        summary: "Query failed",
      }
    : {
        members: String(summary?.member_count ?? 0),
        employees: String(summary?.employee_count ?? 0),
        mobile: String(summary?.mobile_ready_count ?? 0),
        workstation: String(summary?.workstation_ready_count ?? 0),
        summary: "Users with real shop membership.",
      };

  return (
    <>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <MetricCard title="Members" value={metricValues.members} summary={metricValues.summary} tone="subtle" />
          <MetricCard title="Employees" value={metricValues.employees} summary={queryFailed ? "Query failed" : "Employee records currently linked to this shop."} tone="subtle" />
          <MetricCard title="Mobile Ready" value={metricValues.mobile} summary={queryFailed ? "Query failed" : "Employees ready to use Mobile."} tone="subtle" />
          <MetricCard title="Workstation Ready" value={metricValues.workstation} summary={queryFailed ? "Query failed" : "Employees ready for Workstation."} tone="subtle" />
        </div>

        <GlassCard
          title="Shop Users"
          subtitle={`Real membership and employee records for ${shopName}. Privileged reads come from the server and row details open in a separate drawer.`}
          actions={
            <>
              <ControlInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users"
                style={{ minWidth: 220 }}
              />
              <ControlButton onClick={loadUsers} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </ControlButton>
            </>
          }
        >
          {status ? (
            <div style={{ color: queryFailed ? t.color.danger : theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>{status}</div>
          ) : null}

          {loading ? (
            <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>Loading users...</div>
          ) : queryFailed ? (
            <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>
              User data is unavailable for the selected shop right now.
            </div>
          ) : users.length === 0 ? (
            <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>
              No users are recorded for this shop yet.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>
              No users matched the current filter.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredUsers.map((user) => {
                const readiness =
                  user.membership_is_active !== false && user.mobile_access_enabled && user.workstation_access_enabled
                    ? "Healthy"
                    : user.mobile_access_enabled || user.workstation_access_enabled
                      ? "Warning"
                      : "Action Needed";

                return (
                  <button
                    key={`${user.employee_id ?? "membership"}:${user.auth_user_id ?? user.display_name}`}
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      display: "grid",
                      gap: 12,
                      padding: 16,
                      borderRadius: 18,
                      border: theme.border.muted,
                      background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.18 }}>{user.display_name}</div>
                        <div style={{ color: theme.text.secondary, fontSize: 12.5, lineHeight: 1.55 }}>
                          {user.email ?? "No email"}{user.employee_code ? ` | ${user.employee_code}` : ""}{user.phone ? ` | ${user.phone}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <StatusBadge label={user.is_active && user.membership_is_active !== false ? "Active" : "Inactive"} tone={toneFromStatus(user.is_active && user.membership_is_active !== false ? "Healthy" : "Warning")} />
                        <StatusBadge label={readiness} tone={toneFromStatus(readiness)} />
                        {user.membership_role ? <StatusBadge label={user.membership_role} tone="neutral" /> : null}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                      <div style={{ color: theme.text.secondary, fontSize: 12.5 }}>Employee Role: <strong>{user.employee_role ?? "Not assigned"}</strong></div>
                      <div style={{ color: theme.text.secondary, fontSize: 12.5 }}>Mobile: <strong>{user.mobile_access_enabled ? "Ready" : "Not ready"}</strong></div>
                      <div style={{ color: theme.text.secondary, fontSize: 12.5 }}>Workstation: <strong>{user.workstation_access_enabled ? "Ready" : "Not ready"}</strong></div>
                      <div style={{ color: theme.text.secondary, fontSize: 12.5 }}>Created: <strong>{user.created_at ? formatDateTime(user.created_at) : user.membership_created_at ? formatDateTime(user.membership_created_at) : "Unknown"}</strong></div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      <ShopUserDrawer
        shopId={shopId}
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onRemoved={loadUsers}
      />
    </>
  );
}
