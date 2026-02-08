// REPLACE ENTIRE FILE: src/app/devices/page.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
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

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("desktop");

  const tokensByDevice = useMemo(() => {
    const m = new Map<string, Token[]>();
    for (const t of tokens) {
      const arr = m.get(t.device_id) ?? [];
      arr.push(t);
      m.set(t.device_id, arr);
    }
    return m;
  }, [tokens]);

  async function reload() {
    setLoading(true);
    setStatus("");
    const res = await fetch("/api/device/list", { credentials: "include" });
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      if (!j.ok) throw new Error(j.error ?? "Failed");
      setDevices(j.devices ?? []);
      setTokens(j.tokens ?? []);
    } catch {
      setStatus(text);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function createDevice() {
    setStatus("");
    const res = await fetch("/api/device/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: newName.trim(), device_type: newType }),
    });
    const j = await res.json().catch(() => null);
    if (!j?.ok) {
      setStatus(j?.error ?? "Create failed");
      return;
    }
    setNewName("");
    await reload();
  }

  async function issueToken(deviceId: string) {
    setStatus("");
    const res = await fetch("/api/device/issue-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ device_id: deviceId, label: "issued-from-ui" }),
    });
    const j = await res.json().catch(() => null);
    if (!j?.ok) {
      setStatus(j?.error ?? "Issue token failed");
      return;
    }

    // One-time token display:
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

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <h1 style={{ margin: 0 }}>Devices</h1>

      <GlassCard title="Create Device">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Device name (e.g., Front Office PC)"
            style={{ padding: 10, borderRadius: 12, minWidth: 320 }}
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ padding: 10, borderRadius: 12 }}>
            <option value="desktop">desktop</option>
            <option value="kiosk">kiosk</option>
            <option value="mobile">mobile</option>
          </select>
          <button
            onClick={createDevice}
            disabled={!newName.trim()}
            style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}
          >
            Create
          </button>
          <button onClick={reload} style={{ padding: "10px 14px", borderRadius: 12 }}>
            Refresh
          </button>
        </div>
        {status ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>{status}</div> : null}
      </GlassCard>

      <GlassCard title="Registered Devices">
        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {devices.map((d) => {
              const t = (tokensByDevice.get(d.id) ?? []).sort(
                (a, b) => (a.created_at < b.created_at ? 1 : -1)
              );
              return (
                <div
                  key={d.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    padding: 14,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{d.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {d.device_type} • {d.status} • {d.id}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => issueToken(d.id)} style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900 }}>
                        Issue Token (rotates)
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Tokens</div>
                  {t.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>No tokens yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                      {t.map((tok) => (
                        <div
                          key={tok.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius:
