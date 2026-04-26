"use client";

import React from "react";
import { ControlActionButtonV2 } from "@/components/control/v2/ControlActionButtonV2";
import { ControlInputV2 } from "@/components/control/v2/ControlFieldV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { ControlTableV2, ControlTableCellV2, ControlTableHeadCellV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import ShopUserDrawer, { type ShopUserRow } from "@/components/shops/ShopUserDrawer";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";

type UsersResponse = {
  ok: true;
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

function compactCount(label: string, value: string | number, meta?: string) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.24 }}>{value}</span>
        <span style={{ color: t.color.textQuiet, ...t.type.label }}>{label}</span>
      </div>
      {meta ? <span style={{ color: t.color.textQuiet, fontSize: 11.5 }}>{meta}</span> : null}
    </div>
  );
}

export default function UsersTabV2({
  shopId,
}: {
  shopId: string;
}) {
  const [queryState, setQueryState] = React.useState<QueryState>("loading");
  const [status, setStatus] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [summary, setSummary] = React.useState<UsersResponse["summary"] | null>(null);
  const [users, setUsers] = React.useState<ShopUserRow[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<ShopUserRow | null>(null);
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
    void loadUsers();
  }, [shopId]);

  const filteredUsers = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [user.display_name, user.email, user.phone, user.employee_code, user.employee_role, user.membership_role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [query, users]);

  const metricItems = queryFailed
    ? [
        compactCount("Members", "Unavailable", "Query failed"),
        compactCount("Employees", "Unavailable", "Query failed"),
        compactCount("Mobile Ready", "Unavailable", "Query failed"),
        compactCount("Workstation Ready", "Unavailable", "Query failed"),
      ]
    : [
        compactCount("Members", summary?.member_count ?? 0),
        compactCount("Employees", summary?.employee_count ?? 0, `${summary?.active_employee_count ?? 0} active`),
        compactCount("Mobile Ready", summary?.mobile_ready_count ?? 0),
        compactCount("Workstation Ready", summary?.workstation_ready_count ?? 0),
      ];

  return (
    <>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            {metricItems.map((item, index) => (
              <React.Fragment key={index}>{item}</React.Fragment>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ControlInputV2 value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users" style={{ minWidth: 220 }} />
            <ControlActionButtonV2 onClick={loadUsers} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</ControlActionButtonV2>
          </div>
        </div>

        {status ? <div style={{ fontSize: 12.5, color: queryFailed ? t.color.danger : t.color.textMuted }}>{status}</div> : null}

        <ControlTableWrapV2>
          <ControlTableV2>
            <thead>
              <tr>
                {["User", "Roles", "Readiness", "Contact", "Created", "Action"].map((heading) => (
                  <ControlTableHeadCellV2 key={heading}>{heading}</ControlTableHeadCellV2>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: t.color.textMuted }}>Loading users...</td>
                </tr>
              ) : queryFailed ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: t.color.textMuted }}>User data is unavailable for the selected shop right now.</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: t.color.textMuted }}>No users are recorded for this shop yet.</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: t.color.textMuted }}>No users matched the current filter.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isActive = user.is_active && user.membership_is_active !== false;
                  const readiness =
                    isActive && user.mobile_access_enabled && user.workstation_access_enabled
                      ? "OK"
                      : isActive && (user.mobile_access_enabled || user.workstation_access_enabled)
                        ? "Warning"
                        : "Action Needed";

                  return (
                    <tr key={`${user.employee_id ?? "membership"}:${user.auth_user_id ?? user.display_name}`}>
                      <ControlTableCellV2>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 700, color: t.color.text }}>{user.display_name}</div>
                          <div style={{ color: t.color.textQuiet, fontSize: 11.5 }}>{user.employee_code ?? user.source}</div>
                        </div>
                      </ControlTableCellV2>
                      <ControlTableCellV2>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div>{user.employee_role ?? "No employee role"}</div>
                          <div style={{ color: t.color.textQuiet, fontSize: 11.5 }}>{user.membership_role ?? "No membership role"}</div>
                        </div>
                      </ControlTableCellV2>
                      <ControlTableCellV2>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <ControlBadgeV2 label={isActive ? "active" : "inactive"} tone={toneFromStatusV2(isActive ? "OK" : "Warning")} />
                          {user.membership_is_active === false ? <ControlBadgeV2 label="access disabled" tone="warning" /> : null}
                          <ControlBadgeV2 label={readiness} tone={toneFromStatusV2(readiness)} />
                        </div>
                      </ControlTableCellV2>
                      <ControlTableCellV2>
                        <div>{user.email ?? "No email"}</div>
                        <div style={{ fontSize: 11.5, color: t.color.textQuiet }}>{user.phone ?? "No phone"}</div>
                      </ControlTableCellV2>
                      <ControlTableCellV2>
                        {user.created_at ? formatDateTime(user.created_at) : user.membership_created_at ? formatDateTime(user.membership_created_at) : "Unknown"}
                      </ControlTableCellV2>
                      <ControlTableCellV2>
                        <ControlActionButtonV2 onClick={() => setSelectedUser(user)}>Open</ControlActionButtonV2>
                      </ControlTableCellV2>
                    </tr>
                  );
                })
              )}
            </tbody>
          </ControlTableV2>
        </ControlTableWrapV2>
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
