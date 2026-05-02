"use client";

import React from "react";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { ControlActionButtonV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlPanelV2 from "@/components/control/v2/ControlPanelV2";

export type ShopUserRow = {
  employee_id: string | null;
  auth_user_id: string | null;
  employee_code: string | null;
  display_name: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  employee_role: string | null;
  membership_role: string | null;
  membership_is_active?: boolean;
  status: string | null;
  is_active: boolean;
  mobile_access_enabled: boolean;
  mobile_timeclock_enabled: boolean;
  mobile_timeclock_requires_review: boolean;
  workstation_access_enabled: boolean;
  runbook_access_enabled: boolean;
  created_at: string | null;
  membership_created_at: string | null;
  source: "employee" | "membership_only";
  trusted_device_count?: number;
  trusted_recorded_at?: string | null;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "132px minmax(0, 1fr)", gap: 12, alignItems: "start", padding: "6px 0", borderTop: `1px solid ${t.color.border}` }}>
      <div style={{ color: t.color.textQuiet, ...t.type.label }}>{label}</div>
      <div style={{ color: t.color.text, fontSize: 13, lineHeight: 1.52 }}>{value}</div>
    </div>
  );
}

export default function ShopUserDrawer({
  shopId,
  user,
  open,
  onClose,
  onRemoved,
}: {
  shopId: string;
  user: ShopUserRow | null;
  open: boolean;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [timeclockBusy, setTimeclockBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [mobileTimeclockEnabled, setMobileTimeclockEnabled] = React.useState(false);
  const [mobileTimeclockRequiresReview, setMobileTimeclockRequiresReview] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setBusy(false);
      setTimeclockBusy(false);
      setStatus("");
    }
    setMobileTimeclockEnabled(Boolean(user?.mobile_timeclock_enabled));
    setMobileTimeclockRequiresReview(Boolean(user?.mobile_timeclock_requires_review));
  }, [open, user?.employee_id, user?.mobile_timeclock_enabled, user?.mobile_timeclock_requires_review]);

  if (!open || !user) return null;

  const activeUser = user;

  async function removeEmployee() {
    if (!activeUser.employee_id) return;
    const confirmed = window.confirm(`Disable ${activeUser.display_name} for this shop? Historical records will stay visible.`);
    if (!confirmed) return;

    setBusy(true);
    setStatus("");
    const response = await safeFetch<{ ok?: boolean; error?: string }>("/api/people/remove", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shopId, employeeId: activeUser.employee_id }),
    });

    if (!response.ok || !response.data?.ok) {
      setStatus(response.ok ? response.data?.error ?? "Could not disable user." : `${response.status}: ${response.error}`);
      setBusy(false);
      return;
    }

    setStatus("User disabled. Historical records remain visible.");
    setBusy(false);
    onRemoved();
    onClose();
  }

  async function saveMobileTimeclockAccess() {
    if (!activeUser.employee_id) return;
    setTimeclockBusy(true);
    setStatus("");

    const response = await safeFetch<{
      ok?: boolean;
      error?: string;
      employee?: {
        mobile_timeclock_enabled?: boolean;
        mobile_timeclock_requires_review?: boolean;
      };
    }>("/api/admin/users/mobile-timeclock", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shop_id: shopId,
        employee_id: activeUser.employee_id,
        mobile_timeclock_enabled: mobileTimeclockEnabled,
        mobile_timeclock_requires_review: mobileTimeclockRequiresReview,
      }),
    });

    if (!response.ok || !response.data?.ok) {
      setStatus(response.ok ? response.data?.error ?? "Could not save Mobile Time Clock access." : `${response.status}: ${response.error}`);
      setTimeclockBusy(false);
      return;
    }

    setMobileTimeclockEnabled(Boolean(response.data.employee?.mobile_timeclock_enabled));
    setMobileTimeclockRequiresReview(Boolean(response.data.employee?.mobile_timeclock_requires_review));
    setStatus("Mobile Time Clock access saved.");
    setTimeclockBusy(false);
    onRemoved();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 420px",
        background: "rgba(6, 9, 14, 0.54)",
      }}
    >
      <button type="button" aria-label="Close drawer" onClick={onClose} style={{ border: 0, background: "transparent", cursor: "pointer" }} />

      <aside
        style={{
          height: "100vh",
          overflowY: "auto",
          borderLeft: `1px solid ${t.color.borderStrong}`,
          background: t.color.workspace,
          padding: 16,
          display: "grid",
          alignContent: "start",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: t.color.textQuiet, ...t.type.label }}>User Details</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.4 }}>{activeUser.display_name}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <ControlBadgeV2 label={activeUser.is_active ? "Active" : "Inactive"} tone={toneFromStatusV2(activeUser.is_active ? "OK" : "Warning")} />
              {activeUser.membership_is_active === false ? <ControlBadgeV2 label="Access disabled" tone="warning" /> : null}
              {activeUser.membership_role ? <ControlBadgeV2 label={activeUser.membership_role} tone="neutral" /> : null}
              {activeUser.employee_role ? <ControlBadgeV2 label={activeUser.employee_role} tone="neutral" /> : null}
            </div>
          </div>

          <ControlActionButtonV2 onClick={onClose}>Close</ControlActionButtonV2>
        </div>

        <ControlPanelV2>
          <DetailRow label="Email" value={activeUser.email ?? "Not available"} />
          <DetailRow label="Phone" value={activeUser.phone ?? "Not available"} />
          <DetailRow label="Employee Code" value={activeUser.employee_code ?? "Not assigned"} />
          <DetailRow label="Source" value={activeUser.source === "employee" ? "Employee record" : "Membership only"} />
          <DetailRow label="RunBook Access" value={activeUser.runbook_access_enabled ? "Enabled" : "Not enabled"} />
          <DetailRow label="Mobile" value={activeUser.mobile_access_enabled ? "Ready" : "Not ready"} />
          <DetailRow label="Mobile Time Clock" value={mobileTimeclockEnabled ? "Phone punching allowed" : "Phone punching not allowed"} />
          <DetailRow label="Workstation" value={activeUser.workstation_access_enabled ? "Ready" : "Not ready"} />
          <DetailRow label="Created" value={activeUser.created_at ? formatDateTime(activeUser.created_at) : activeUser.membership_created_at ? formatDateTime(activeUser.membership_created_at) : "Unknown"} />
          <DetailRow label="Auth User" value={activeUser.auth_user_id ?? "Not linked"} />
        </ControlPanelV2>

        <ControlPanelV2 title="Mobile Time Clock" description="Phone punching requires both general Mobile access and this employee-specific permission. Control still evaluates each submitted punch.">
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: activeUser.employee_id ? "pointer" : "not-allowed" }}>
              <input
                type="checkbox"
                checked={mobileTimeclockEnabled}
                disabled={!activeUser.employee_id || timeclockBusy}
                onChange={(event) => setMobileTimeclockEnabled(event.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span style={{ display: "grid", gap: 3 }}>
                <span style={{ color: t.color.text, fontSize: 13, fontWeight: 700 }}>Allow this employee to punch from phone</span>
                <span style={{ color: t.color.textQuiet, fontSize: 12, lineHeight: 1.45 }}>
                  This is separate from general Mobile app access.
                </span>
              </span>
            </label>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: activeUser.employee_id ? "pointer" : "not-allowed" }}>
              <input
                type="checkbox"
                checked={mobileTimeclockRequiresReview}
                disabled={!activeUser.employee_id || timeclockBusy}
                onChange={(event) => setMobileTimeclockRequiresReview(event.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span style={{ display: "grid", gap: 3 }}>
                <span style={{ color: t.color.text, fontSize: 13, fontWeight: 700 }}>Always send this employee&apos;s mobile punches for review</span>
                <span style={{ color: t.color.textQuiet, fontSize: 12, lineHeight: 1.45 }}>
                  Approved policy checks will still land as pending review for this employee.
                </span>
              </span>
            </label>

            {!activeUser.mobile_access_enabled ? (
              <div style={{ color: t.color.warning, fontSize: 12 }}>
                General Mobile access is not enabled, so this employee still cannot punch from phone.
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ControlActionButtonV2 tone="primary" disabled={timeclockBusy || !activeUser.employee_id} onClick={saveMobileTimeclockAccess}>
                {timeclockBusy ? "Saving..." : "Save Mobile Time Clock"}
              </ControlActionButtonV2>
            </div>
          </div>
        </ControlPanelV2>

        <ControlPanelV2 title="Access actions" description="Disabling an employee uses the authoritative server route, removes active access, and preserves historical records.">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ControlActionButtonV2 tone="danger" disabled={busy || !activeUser.employee_id} onClick={removeEmployee}>
              {busy ? "Disabling..." : "Disable employee"}
            </ControlActionButtonV2>
          </div>
          {!activeUser.employee_id ? <div style={{ color: t.color.textQuiet, fontSize: 12 }}>This record does not have an employee row to disable.</div> : null}
          {status ? <div style={{ color: t.color.textMuted, fontSize: 12 }}>{status}</div> : null}
        </ControlPanelV2>
      </aside>
    </div>
  );
}
