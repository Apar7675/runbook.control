// REPLACE ENTIRE FILE: src/app/(authed)/devices/[deviceId]/page.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";

type Device = {
  id: string;
  created_at: string;
  shop_id: string | null;
  name: string;
  device_type: string;
  status: string;
};

type Token = {
  id: string;
  device_id: string;
  created_at: string;
  issued_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
  label: string | null;
};

export default function DeviceDetailPage() {
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;
  const router = useRouter();

  const [device, setDevice] = useState<Device | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");

  const activeToken = useMemo(() => {
    return tokens.find((t) => !t.revoked_at) ?? null;
  }, [tokens]);

  async function reload() {
    setLoading(true);
    setStatus("");

    const res = await fetch("/api/device/list", { credentials: "include" });
    const text = await res.text();

    try {
      const j = JSON.parse(text);
      if (!j.ok) throw new Error(j.error ?? "Failed to load devices");

      const allDevices: Device[] = (j.devices ?? []) as Device[];
      const allTokens: Token[] = (j.tokens ?? []) as Token[];

      const d = allDevices.find((x) => x.id === deviceId) ?? null;
      setDevice(d);

      const t = allTokens
        .filter((x) => x.device_id === deviceId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      setTokens(t);

      if (!d) setStatus("Device not found (it may have been deleted).");
    } catch (e: any) {
      setStatus(e?.message ?? text);
      setDevice(null);
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  async function issueToken() {
    setStatus("");
    const res = await fetch("/api/device/issue-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ device_id: deviceId, label: "issued-from-details" }),
    });

    const j = await res.json().catch(() => null);
    if (!j?.ok) {
      setStatus(j?.error ?? "Issue token failed");
      return;
    }

    alert(`DEVICE TOKEN (COPY NOW)\n\n${j.token}\n\nThis will not be shown again.`);
    await reload();
  }

  async function revokeToken(tokenId: string) {
    setStatus("");
    const res = await fetch("/api/device/revoke-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token_id: tokenId }),
    });

    const j = await res.json().catch(() => null);
    if (!j?.ok) {
      setStatus(j?.error ?? "Revoke failed");
      return;
    }

    await reload();
  }

  async function deleteDevice() {
    if (!device) return;

    const ok = window.confirm(
      `Delete device "${device.name}"?\n\nThis permanently deletes the device and ALL its tokens.`
    );
    if (!ok) return;

    setStatus("");
    const res = await fetch("/api/device/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ device_id: device.id }),
    });

    const j = await res.json().catch(() => null);
    if (!j?.ok) {
      setStatus(j?.error ?? "Delete failed");
      return;
    }

    router.replace("/devices");
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Device Details</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => router.back()} style={{ padding: "10px 14px", borderRadius: 12 }}>
            Back
          </button>
          <button onClick={reload} style={{ padding: "10px 14px", borderRadius: 12 }}>
            Refresh
          </button>
        </div>
      </div>

      {status ? (
        <div style={{ fontSize: 12, opacity: 0.85, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
          {status}
        </div>
      ) : null}

      <GlassCard title="Device">
        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : !device ? (
          <div style={{ opacity: 0.75 }}>No device.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{device.name}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {device.device_type} • {device.status}
            </div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Device ID: {device.id}</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Shop ID: {device.shop_id ?? "—"}</div>

            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <button onClick={issueToken} style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900 }}>
                Issue Token (rotates)
              </button>
              <button onClick={deleteDevice} style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900, opacity: 0.9 }}>
                Delete Device
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard title="Tokens">
        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : tokens.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No tokens yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {activeToken ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                Active token: <span style={{ fontWeight: 900 }}>{activeToken.id}</span>
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.85 }}>No active token.</div>
            )}

            {tokens.map((t) => (
              <div
                key={t.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, opacity: 0.95 }}>
                    {t.id} {t.label ? `• ${t.label}` : ""}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    revoked: {t.revoked_at ? "yes" : "no"} • last_seen: {t.last_seen_at ?? "—"}
                  </div>
                </div>

                <button
                  onClick={() => revokeToken(t.id)}
                  disabled={!!t.revoked_at}
                  style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 900 }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
