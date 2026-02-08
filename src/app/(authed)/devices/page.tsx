"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { safeFetch } from "@/lib/http/safeFetch";

type Shop = { id: string; name: string; created_at: string };

type Device = {
  id: string;
  created_at: string;
  shop_id: string | null;
  shop_name?: string | null;

  name: string;
  device_type: string;
  status: string;

  last_seen_at?: string | null;
  reported_version?: string | null;
  version?: string | null;
  app_version?: string | null;
  reported_version_at?: string | null;
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

type ShopsResp = { ok: true; shops: Shop[] } | { ok?: false; error?: string };
type ListResp = { ok: true; devices: Device[]; tokens: Token[] } | { ok?: false; error?: string };

function isoOrDash(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toISOString();
  } catch {
    return ts;
  }
}

function newestIso(a?: string | null, b?: string | null) {
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta)) return b ?? a ?? null;
  if (!Number.isFinite(tb)) return a ?? b ?? null;
  return tb > ta ? b : a;
}

type RevealInfo = {
  token: string;
  token_id?: string | null;
  issuedAtIso: string;
};

function StatusChip({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  const isActive = s === "active";
  const label = isActive ? "ACTIVE" : "DISABLED";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        border: "1px solid rgba(255,255,255,0.14)",
        background: isActive ? "rgba(80,220,140,0.16)" : "rgba(255,120,120,0.16)",
        color: isActive ? "#bff5d2" : "#ffd0d0",
        width: "fit-content",
      }}
      title={`status: ${status}`}
    >
      {label}
    </span>
  );
}

export default function DevicesPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const shopNameById = useMemo(() => new Map(shops.map((s) => [s.id, s.name])), [shops]);

  const [devices, setDevices] = useState<Device[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("desktop");
  const [newShopId, setNewShopId] = useState<string>("");

  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [revealByDeviceId, setRevealByDeviceId] = useState<Record<string, RevealInfo>>({});

  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const tokensByDevice = useMemo(() => {
    const m = new Map<string, Token[]>();
    for (const t of tokens) {
      const arr = m.get(t.device_id) ?? [];
      arr.push(t);
      m.set(t.device_id, arr);
    }
    return m;
  }, [tokens]);

  function formatFetchErr(prefix: string, r: any) {
    return `${prefix}: [${r.status}] ${r.error}`;
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied token to clipboard.");
    } catch {
      setStatus("Copy failed (browser denied clipboard). Select and copy manually.");
    }
  }

  async function loadShops() {
    const r = await safeFetch<ShopsResp>("/api/shops/list-simple", {
      credentials: "include",
      cache: "no-store",
    });

    if (!r.ok) throw new Error(formatFetchErr("Shops", r));

    const j: any = r.data;
    if (!j?.ok) throw new Error(j?.error ?? "Failed to load shops");

    const s: Shop[] = j.shops ?? [];
    setShops(s);
  }

  async function loadDevices() {
    const r = await safeFetch<ListResp>("/api/device/list", {
      credentials: "include",
      cache: "no-store",
    });

    if (!r.ok) throw new Error(formatFetchErr("Devices", r));

    const j: any = r.data;
    if (!j?.ok) throw new Error(j?.error ?? "Failed to load devices");

    setDevices(j.devices ?? []);
    setTokens(j.tokens ?? []);
  }

  async function reload() {
    setLoading(true);
    setStatus("");
    try {
      await loadShops();
      await loadDevices();
    } catch (e: any) {
      setStatus(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function createDevice() {
    setStatus("");
    if (!newShopId) return setStatus("Pick a shop first (required).");

    const r = await safeFetch<any>("/api/device/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: newName.trim(), device_type: newType, shop_id: newShopId }),
    });

    if (!r.ok) return setStatus(formatFetchErr("Create", r));

    const j: any = r.data;
    if (!j?.ok) return setStatus(j?.error ?? "Create failed");

    setNewName("");
    await loadDevices();
  }

  async function issueToken(deviceId: string) {
    setStatus("");
    setBusyDeviceId(deviceId);

    const r = await safeFetch<any>("/api/device/issue-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ device_id: deviceId, label: "issued-from-ui" }),
    });

    setBusyDeviceId(null);

    if (!r.ok) return setStatus(formatFetchErr("Issue token", r));

    const j: any = r.data;
    if (!j?.ok) return setStatus(j?.error ?? "Issue token failed");

    const token = String(j.token ?? "").trim();
    if (!token) return setStatus("Token was not returned.");

    setRevealByDeviceId((prev) => ({
      ...prev,
      [deviceId]: {
        token,
        token_id: j.token_id ?? null,
        issuedAtIso: new Date().toISOString(),
      },
    }));

    await loadDevices();
  }

  async function revokeToken(tokenId: string) {
    setStatus("");

    const r = await safeFetch<any>("/api/device/revoke-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token_id: tokenId }),
    });

    if (!r.ok) return setStatus(formatFetchErr("Revoke token", r));

    const j: any = r.data;
    if (!j?.ok) return setStatus(j?.error ?? "Revoke failed");

    await loadDevices();
  }

  async function deleteDevice(deviceId: string, deviceName: string) {
    const ok = window.confirm(`Delete device "${deviceName}"?\n\nThis permanently deletes the device and ALL its tokens.`);
    if (!ok) return;

    setStatus("");

    const r = await safeFetch<any>("/api/device/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ device_id: deviceId }),
    });

    if (!r.ok) return setStatus(formatFetchErr("Delete device", r));

    const j: any = r.data;
    if (!j?.ok) return setStatus(j?.error ?? "Delete failed");

    setRevealByDeviceId((prev) => {
      const copy = { ...prev };
      delete copy[deviceId];
      return copy;
    });

    await loadDevices();
  }

  function getDeviceVersion(d: Device): string | null {
    const v =
      (d.reported_version ?? "").trim() ||
      (d.app_version ?? "").trim() ||
      (d.version ?? "").trim() ||
      "";
    return v ? v : null;
  }

  function getDeviceLastSeen(d: Device, deviceTokens: Token[]): string | null {
    let last: string | null = d.last_seen_at ?? null;
    for (const t of deviceTokens) last = newestIso(last, t.last_seen_at ?? null);
    last = newestIso(last, d.reported_version_at ?? null);
    return last;
  }

  function getShopLabel(d: Device): string {
    if (d.shop_name && d.shop_name.trim()) return d.shop_name.trim();
    if (d.shop_id) return shopNameById.get(d.shop_id) ?? d.shop_id;
    return "—";
  }

  function clearReveal(deviceId: string) {
    setRevealByDeviceId((prev) => {
      const copy = { ...prev };
      delete copy[deviceId];
      return copy;
    });
  }

  const filteredDevices = useMemo(() => {
    if (!showActiveOnly) return devices;
    return devices.filter((d) => (d.status ?? "").toLowerCase() === "active");
  }, [devices, showActiveOnly]);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <h1 style={{ margin: 0 }}>Devices</h1>

      <GlassCard title="Info">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Disabled devices will fail token validation (<span style={{ fontWeight: 900 }}>/api/device/validate-token</span>).
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => setShowActiveOnly((v) => !v)}
              style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}
            >
              {showActiveOnly ? "Show All" : "Show Active Only"}
            </button>

            <button onClick={reload} style={{ padding: "10px 14px", borderRadius: 12 }}>
              Refresh
            </button>
          </div>

          {status ? <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>{status}</div> : null}
        </div>
      </GlassCard>

      <GlassCard title="Create Device">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Device name (e.g., Front Office PC)"
            style={{ padding: 10, borderRadius: 12, minWidth: 320 }}
          />

          <select
            value={newShopId}
            onChange={(e) => setNewShopId(e.target.value)}
            style={{ padding: 10, borderRadius: 12, minWidth: 220 }}
          >
            <option value="" disabled>
              Select shop…
            </option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ padding: 10, borderRadius: 12 }}>
            <option value="desktop">desktop</option>
            <option value="kiosk">kiosk</option>
            <option value="mobile">mobile</option>
          </select>

          <button
            onClick={createDevice}
            disabled={!newName.trim() || !newShopId}
            style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}
          >
            Create
          </button>
        </div>
      </GlassCard>

      <GlassCard title={`Registered Devices (${filteredDevices.length})`}>
        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {filteredDevices.map((d) => {
              const deviceTokens = (tokensByDevice.get(d.id) ?? []).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
              const lastSeen = getDeviceLastSeen(d, deviceTokens);
              const version = getDeviceVersion(d);
              const reveal = revealByDeviceId[d.id] ?? null;

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
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>{d.name}</div>
                        <StatusChip status={d.status} />
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {d.device_type} • {d.id}
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Shop: <span style={{ fontWeight: 900 }}>{getShopLabel(d)}</span>
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                        Last seen: <span style={{ fontWeight: 900 }}>{isoOrDash(lastSeen)}</span>
                        {"  "}•{"  "}
                        Version: <span style={{ fontWeight: 900 }}>{version ?? "—"}</span>
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <Link href={`/devices/${d.id}`} style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>
                          Details →
                        </Link>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => issueToken(d.id)}
                        disabled={busyDeviceId === d.id}
                        style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900 }}
                      >
                        Reveal Token (once)
                      </button>
                      <button
                        onClick={() => deleteDevice(d.id, d.name)}
                        disabled={busyDeviceId === d.id}
                        style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900, opacity: 0.9 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {reveal ? (
                    <div
                      style={{
                        marginTop: 10,
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 14,
                        padding: 12,
                        background: "rgba(139,140,255,0.10)",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 900 }}>
                        Token revealed (copy now) • {reveal.issuedAtIso}
                      </div>
                      <textarea
                        readOnly
                        value={reveal.token}
                        style={{
                          width: "100%",
                          minHeight: 70,
                          padding: 10,
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(0,0,0,0.25)",
                          color: "#e6e8ef",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          fontSize: 12,
                        }}
                      />
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={() => copyToClipboard(reveal.token)}
                          style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900 }}
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => clearReveal(d.id)}
                          style={{ padding: "10px 12px", borderRadius: 12, opacity: 0.9 }}
                        >
                          Clear
                        </button>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        This raw token is shown only here. It is not stored and cannot be recovered later.
                      </div>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Tokens</div>

                  {deviceTokens.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>No tokens yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                      {deviceTokens.map((tok) => (
                        <div
                          key={tok.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 12,
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, opacity: 0.9 }}>
                              {tok.id} {tok.label ? `• ${tok.label}` : ""}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.65 }}>
                              revoked: {tok.revoked_at ? "yes" : "no"} • last_seen: {isoOrDash(tok.last_seen_at)}
                            </div>
                          </div>

                          <button
                            onClick={() => revokeToken(tok.id)}
                            disabled={!!tok.revoked_at}
                            style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 900 }}
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
