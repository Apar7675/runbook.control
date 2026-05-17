"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ControlActionButton from "@/components/control/ControlActionButton";
import ControlPanel from "@/components/control/ControlPanel";
import { safeFetch, type SafeFetchResult } from "@/lib/http/safeFetch";

type BasicResponse = { ok?: boolean; error?: string };
type IssueTokenResponse = { ok?: boolean; error?: string; token?: string; token_id?: string | null };

function messageFromError<T>(response: SafeFetchResult<T>) {
  if (response.ok && response.data && typeof response.data === "object" && "error" in (response.data as Record<string, unknown>)) {
    const payloadError = String((response.data as Record<string, unknown>).error ?? "").trim();
    if (payloadError) return payloadError;
  }
  return response.ok ? "Action failed." : `${response.status}: ${response.error}`;
}

export default function DeviceAdminActionsPanel({
  deviceId,
  deviceName,
  deviceStatus,
  activeTokenId,
  disableDelete = false,
}: {
  deviceId: string;
  deviceName: string;
  deviceStatus: string | null;
  activeTokenId: string | null;
  disableDelete?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState("");
  const [revealedToken, setRevealedToken] = React.useState<string | null>(null);

  async function issueToken() {
    setBusy("issue");
    setStatus("");
    setRevealedToken(null);

    const response = await safeFetch<IssueTokenResponse>("/api/device/issue-token", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, label: "device-detail" }),
    });

    setBusy(null);

    if (!response.ok || !response.data?.ok || !response.data.token) {
      setStatus(messageFromError(response));
      return;
    }

    setRevealedToken(response.data.token);
    setStatus("A new token was issued and older active tokens were revoked.");
    router.refresh();
  }

  async function revokeToken() {
    if (!activeTokenId) return;
    const confirmed = window.confirm("Revoke the current active device token?");
    if (!confirmed) return;

    setBusy("revoke");
    setStatus("");

    const response = await safeFetch<BasicResponse>("/api/device/revoke-token", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token_id: activeTokenId }),
    });

    setBusy(null);

    if (!response.ok || !response.data?.ok) {
      setStatus(messageFromError(response));
      return;
    }

    setStatus("The active token was revoked.");
    router.refresh();
  }

  async function setDeviceStatus(nextStatus: "active" | "disabled") {
    const actionLabel = nextStatus === "active" ? "Enable" : "Disable";
    const confirmed = window.confirm(`${actionLabel} this device?`);
    if (!confirmed) return;

    setBusy(nextStatus);
    setStatus("");

    const response = await safeFetch<BasicResponse>("/api/device/set-status", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, status: nextStatus }),
    });

    setBusy(null);

    if (!response.ok || !response.data?.ok) {
      setStatus(messageFromError(response));
      return;
    }

    setStatus(nextStatus === "active" ? "Device enabled." : "Device disabled.");
    router.refresh();
  }

  async function deleteDevice() {
    if (disableDelete) return;
    const confirmed = window.confirm(`Delete device "${deviceName}"? This cannot be undone.`);
    if (!confirmed) return;

    setBusy("delete");
    setStatus("");

    const response = await safeFetch<BasicResponse>("/api/device/delete", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id: deviceId }),
    });

    setBusy(null);

    if (!response.ok || !response.data?.ok) {
      setStatus(messageFromError(response));
      return;
    }

    router.push("/devices");
    router.refresh();
  }

  return (
    <ControlPanel
      title="Actions"
      description="These actions use the existing authenticated device admin routes. Plaintext tokens are only revealed once when issued."
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ControlActionButton onClick={() => void issueToken()} disabled={busy !== null} tone="secondary">
          {busy === "issue" ? "Issuing..." : "Issue Token"}
        </ControlActionButton>
        <ControlActionButton onClick={() => void setDeviceStatus(deviceStatus === "active" ? "disabled" : "active")} disabled={busy !== null}>
          {busy === "active" || busy === "disabled"
            ? "Saving..."
            : deviceStatus === "active"
              ? "Disable Device"
              : "Enable Device"}
        </ControlActionButton>
        <ControlActionButton onClick={() => void revokeToken()} disabled={busy !== null || !activeTokenId}>
          {busy === "revoke" ? "Revoking..." : "Revoke Active Token"}
        </ControlActionButton>
        <ControlActionButton onClick={() => void deleteDevice()} disabled={busy !== null || disableDelete} tone="danger">
          {busy === "delete" ? "Deleting..." : "Delete Device"}
        </ControlActionButton>
      </div>

      {status ? <div style={{ color: "#CBD5E1", fontSize: 13, lineHeight: 1.55 }}>{status}</div> : null}

      {revealedToken ? (
        <div
          style={{
            display: "grid",
            gap: 8,
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(148, 163, 184, 0.16)",
            background: "rgba(7, 10, 15, 0.34)",
          }}
        >
          <div style={{ color: "#F8FAFC", fontSize: 13, fontWeight: 700 }}>New token</div>
          <code style={{ color: "#CBD5E1", fontSize: 12, wordBreak: "break-all" }}>{revealedToken}</code>
          <div style={{ color: "#64748B", fontSize: 12 }}>Store this token now. Control will not show the plaintext value again after refresh.</div>
        </div>
      ) : null}
    </ControlPanel>
  );
}
