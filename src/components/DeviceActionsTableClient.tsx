"use client";

import React from "react";
import Link from "next/link";

export default function DeviceActionsTableClient({
  devices,
  tokenByDevice,
}: {
  devices: any[];
  tokenByDevice: [string, any][];
}) {
  const map = React.useMemo(() => new Map(tokenByDevice), [tokenByDevice]);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function post(action: string, payload: any) {
    const res = await fetch("/api/device/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.error ?? "Action failed");
    return j;
  }

  async function toggleStatus(deviceId: string, activated: boolean, currentStatus: string) {
    if (activated && currentStatus === "active") {
      const ok = window.confirm("This device has been activated before.\n\nDisabling blocks update checks.\n\nContinue?");
      if (!ok) return;
    }

    setBusyId(deviceId);
    try {
      await post("toggle_status", { deviceId });
      window.location.reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function regenActivation(deviceId: string, force: boolean) {
    const msg = force
      ? "Force re-activation?\n\nCreates a NEW activation token even if the device was already activated.\n\nContinue?"
      : "Regenerate activation token?\n\nCreates a new 24h token.\n\nContinue?";
    if (!window.confirm(msg)) return;

    setBusyId(deviceId);
    try {
      const j = await post(force ? "force_reactivation" : "regen_activation", { deviceId });

      const reveal = btoa(
        JSON.stringify({
          device_id: deviceId,
          shop_id: "",
          deviceKeyPlain: "(already set)",
          activationPlain: j.activationPlain,
        })
      );

      const url = new URL(window.location.href);
      url.searchParams.set("reveal", reveal);
      window.location.href = url.toString();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deactivateToken(deviceId: string, activated: boolean) {
    const msg = activated
      ? "Deactivate token?\n\nThis device was activated before.\nDeactivating removes the token record.\nYou will need Force Re-activate to onboard again.\n\nContinue?"
      : "Deactivate token?\n\nThis removes the activation token record.\n\nContinue?";
    if (!window.confirm(msg)) return;

    setBusyId(deviceId);
    try {
      await post("deactivate_token", { deviceId });
      window.location.reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDevice(deviceId: string, deviceName: string, activated: boolean) {
    const warning = activated
      ? "This device was activated before.\nDeleting it removes its activation record and it will NOT be able to check updates."
      : "Deleting it removes its activation record.";

    const typed = window.prompt(`${warning}\n\nType the EXACT device name to delete:\n\n"${deviceName}"`, "");
    if (typed !== deviceName) return;

    setBusyId(deviceId);
    try {
      await post("delete_device", { deviceId, confirmName: typed });
      window.location.reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      alert(text);
    }
  }

  if (!devices || devices.length === 0) return <div style={{ opacity: 0.75 }}>No devices yet.</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {devices.map((d) => {
        const t = map.get(d.id);
        const isBusy = busyId === d.id;
        const activated = !!t?.used_at;

        return (
          <div
            key={d.id}
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900 }}>{d.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Status: <b>{d.status}</b> • Device ID: <code>{String(d.id).slice(0, 8)}…</code>
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Activation: {t?.used_at ? "USED" : t ? "READY" : "—"}
                  {t?.expires_at ? ` (expires ${new Date(t.expires_at).toLocaleString()})` : ""}
                </div>
              </div>

              <Link href={`/devices/${d.id}`} style={{ textDecoration: "none", opacity: 0.9 }}>
                Details →
              </Link>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button disabled={isBusy} onClick={() => copy(d.id)} style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 900 }}>
                Copy ID
              </button>

              <button disabled={isBusy} onClick={() => toggleStatus(d.id, activated, d.status)} style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 900 }}>
                {d.status === "active" ? "Disable" : "Enable"}
              </button>

              <button disabled={isBusy} onClick={() => regenActivation(d.id, false)} style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 900 }}>
                Regenerate Token
              </button>

              <button disabled={isBusy} onClick={() => deactivateToken(d.id, activated)} style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 900 }}>
                Deactivate Token
              </button>

              <button disabled={isBusy} onClick={() => regenActivation(d.id, true)} style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 900 }}>
                Force Re-activate
              </button>

              <button disabled={isBusy} onClick={() => deleteDevice(d.id, d.name, activated)} style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 900 }}>
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
