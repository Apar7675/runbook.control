"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { safeFetch } from "@/lib/http/safeFetch";

type Device = {
  id: string;
  name: string;
  device_type: string;
  status: string;
  shop_id: string | null;
  shop_name?: string | null;
  last_seen_at?: string | null;
  reported_version?: string | null;
};

type Token = {
  id: string;
  device_id: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

type ListResp = { ok: true; devices: Device[]; tokens: Token[] } | { ok?: false; error?: string };

function StatusChip({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  const isActive = s === "active";
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,0.14)",
        background: isActive ? "rgba(80,220,140,0.16)" : "rgba(255,120,120,0.16)",
        color: isActive ? "#bff5d2" : "#ffd0d0",
      }}
    >
      {isActive ? "ACTIVE" : "DISABLED"}
    </span>
  );
}

function iso(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toISOString();
  } catch {
    return ts;
  }
}

export default function GlobalDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  const tokensByDevice = useMemo(() => {
    const m = new Map<string, Token[]>();
    for (const t of tokens) {
      const arr = m.get(t.device_id) ?? [];
      arr.push(t);
      m.set(t.device_id, arr);
    }
    return m;
  }, [tokens]);

  async function load() {
    setLoading(true);
    setStatus("");
    const r = await safeFetch<ListResp>("/api/device/list", { credentials: "include", cache: "no-store" });
    if (!r.ok) {
      setStatus(`${r.status}: ${r.error}`);
      setLoading(false);
      return;
    }
    const j: any = r.data;
    if (!j?.ok) {
      setStatus(j?.error ?? "Failed");
      setLoading(false);
      return;
    }
    setDevices(j.devices ?? []);
    setTokens(j.tokens ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!activeOnly) return devices;
    return devices.filter((d) => (d.status ?? "").toLowerCase() === "active");
  }, [devices, activeOnly]);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Global Devices</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setActiveOnly((v) => !v)} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
            {activeOnly ? "Show All" : "Show Active Only"}
          </button>
          <button onClick={load} style={{ padding: "10px 14px", borderRadius: 12 }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Disabled devices will fail token validation.
      </div>

      <GlassCard title={`Devices (${filtered.length})`}>
        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No devices.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((d) => {
              const tks = tokensByDevice.get(d.id) ?? [];
              const lastSeen = [...tks].map((t) => t.last_seen_at).filter(Boolean).sort().pop() ?? d.last_seen_at ?? null;
              return (
                <div
                  key={d.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>{d.name}</div>
                      <StatusChip status={d.status} />
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {d.device_type} • {d.shop_name ?? d.shop_id ?? "—"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      Last seen: <b>{iso(lastSeen)}</b> • Version: <b>{d.reported_version ?? "—"}</b>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Link
                      href={`/devices/${d.id}`}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        textDecoration: "none",
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.03)",
                        color: "#e6e8ef",
                        fontWeight: 900,
                      }}
                    >
                      Details →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{status}</div> : null}
    </div>
  );
}
