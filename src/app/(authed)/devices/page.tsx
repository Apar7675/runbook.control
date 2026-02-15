"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { safeFetch } from "@/lib/http/safeFetch";

type Device = {
  id: string;
  name: string;
  device_type: string | null;
  status: string;
  shop_id: string | null;
  shop_name?: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
  reported_version?: string | null;
};

type Token = {
  id: string;
  device_id: string;
  created_at?: string | null;
  issued_at?: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  label?: string | null;
};

type Shop = { id: string; name: string; created_at?: string };

type ListResp = { ok: true; devices: Device[]; tokens: Token[] } | { ok?: false; error?: string };
type ShopsResp = { ok: true; shops: Shop[] } | { ok?: false; error?: string };

type CreateResp = { ok: true; device: Device } | { ok?: false; error?: string };
type OkResp = { ok: true } | { ok?: false; error?: string };
type IssueResp =
  | { ok: true; token?: string; token_id?: string | null; deduped?: boolean }
  | { ok?: false; error?: string };

function iso(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toISOString();
  } catch {
    return ts;
  }
}

function shortId(id?: string | null) {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function msToAge(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 12) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function ageFromIso(ts?: string | null) {
  if (!ts) return "—";
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return "—";
  const age = Date.now() - t;
  if (age < 0) return "—";
  return msToAge(age);
}

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

function TokenActiveChip({ active }: { active: number }) {
  if (active <= 0) return null;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(139,140,255,0.16)",
        color: "#cfd0ff",
      }}
    >
      TOKEN ACTIVE
    </span>
  );
}

function HealthChip({ kind }: { kind: "ok" | "stale" | "offline" }) {
  if (kind === "ok") return null;
  const isOffline = kind === "offline";
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,0.14)",
        background: isOffline ? "rgba(255,80,80,0.18)" : "rgba(255,180,80,0.18)",
        color: isOffline ? "#ffd0d0" : "#ffe4c6",
      }}
    >
      {isOffline ? "OFFLINE" : "STALE"}
    </span>
  );
}

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(900px, 96vw)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(10,12,18,0.92)",
          boxShadow: "0 20px 70px rgba(0,0,0,0.55)",
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ padding: "8px 10px", borderRadius: 12 }}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  tone,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "neutral" | "warn" | "danger";
  title?: string;
}) {
  const t = tone ?? "neutral";
  const style: React.CSSProperties =
    t === "danger"
      ? {
          border: "1px solid rgba(255,120,120,0.28)",
          background: "rgba(255,120,120,0.12)",
          color: "#ffd0d0",
          fontWeight: 900,
        }
      : t === "warn"
      ? {
          border: "1px solid rgba(255,200,120,0.26)",
          background: "rgba(255,200,120,0.10)",
          color: "#ffe4c6",
          fontWeight: 900,
        }
      : t === "primary"
      ? {
          border: "1px solid rgba(139,140,255,0.28)",
          background: "rgba(139,140,255,0.16)",
          color: "#cfd0ff",
          fontWeight: 900,
        }
      : {
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          color: "#e6e8ef",
          fontWeight: 900,
        };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        ...(style as any),
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  // Filters
  const [activeOnly, setActiveOnly] = useState(false);
  const [q, setQ] = useState("");
  const [shopFilter, setShopFilter] = useState<string>("");

  // Create form
  const [cName, setCName] = useState("");
  const [cType, setCType] = useState<"desktop" | "mobile">("desktop");
  const [cShopId, setCShopId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  // Issue token modal
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueDevice, setIssueDevice] = useState<Device | null>(null);
  const [issueLabel, setIssueLabel] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string>("");
  const [issueMsg, setIssueMsg] = useState<string>("");

  const tokensByDevice = useMemo(() => {
    const m = new Map<string, Token[]>();
    for (const t of tokens) {
      const arr = m.get(t.device_id) ?? [];
      arr.push(t);
      m.set(t.device_id, arr);
    }
    return m;
  }, [tokens]);

  const shopsById = useMemo(() => {
    const m = new Map<string, Shop>();
    for (const s of shops) m.set(s.id, s);
    return m;
  }, [shops]);

  async function loadShops() {
    const r = await safeFetch<ShopsResp>("/api/shops/list-simple", { credentials: "include", cache: "no-store" });
    if (!r.ok) {
      setStatus((prev) => prev || `${r.status}: ${r.error}`);
      return;
    }
    const j: any = r.data;
    if (!j?.ok) {
      setStatus((prev) => prev || (j?.error ?? "Failed to load shops"));
      return;
    }
    const list: Shop[] = j.shops ?? [];
    setShops(list);
    if (!cShopId && list.length === 1) setCShopId(list[0].id);
  }

  async function loadDevices() {
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

  async function loadAll() {
    await Promise.all([loadShops(), loadDevices()]);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDevice() {
    setCreateMsg("");
    const name = cName.trim();
    const shop_id = cShopId.trim();

    if (!name) return setCreateMsg("Missing device name.");
    if (!shop_id) return setCreateMsg("Select a shop.");

    setCreating(true);
    try {
      const r = await safeFetch<CreateResp>("/api/device/create", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, device_type: cType, shop_id }),
      });

      if (!r.ok) return setCreateMsg(`${r.status}: ${r.error}`);

      const j: any = r.data;
      if (!j?.ok) return setCreateMsg(j?.error ?? "Create failed");

      setCreateMsg(`Created: ${j.device?.id ?? "(id?)"}`);
      setCName("");
      await loadDevices();
    } finally {
      setCreating(false);
    }
  }

  async function setDeviceStatus(device_id: string, next: "active" | "disabled") {
    const r = await safeFetch<OkResp>("/api/device/set-status", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id, status: next }),
    });
    if (!r.ok) return { ok: false as const, msg: `${r.status}: ${r.error}` };
    const j: any = r.data;
    if (!j?.ok) return { ok: false as const, msg: j?.error ?? "Failed" };
    return { ok: true as const, msg: "" };
  }

  async function deleteDevice(device_id: string) {
    const r = await safeFetch<OkResp>("/api/device/delete", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id }),
    });
    if (!r.ok) return { ok: false as const, msg: `${r.status}: ${r.error}` };
    const j: any = r.data;
    if (!j?.ok) return { ok: false as const, msg: j?.error ?? "Failed" };
    return { ok: true as const, msg: "" };
  }

  function openIssueToken(d: Device) {
    setIssueDevice(d);
    setIssueLabel("");
    setIssuedToken("");
    setIssueMsg("");
    setIssueOpen(true);
  }

  async function issueTokenNow() {
    if (!issueDevice) return;
    setIssuing(true);
    setIssueMsg("");
    setIssuedToken("");
    try {
      const r = await safeFetch<IssueResp>("/api/device/issue-token", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `ui-${issueDevice.id}-${Date.now()}`,
        },
        body: JSON.stringify({ device_id: issueDevice.id, label: issueLabel.trim() || null }),
      });

      if (!r.ok) {
        setIssueMsg(`${r.status}: ${r.error}`);
        return;
      }

      const j: any = r.data;
      if (!j?.ok) {
        setIssueMsg(j?.error ?? "Issue failed");
        return;
      }

      if (j?.deduped) {
        setIssueMsg("Deduped (idempotency). Re-open and try again if needed.");
        return;
      }

      setIssuedToken(String(j?.token ?? ""));
      if (!j?.token) setIssueMsg("Issued, but no token returned.");
      await loadDevices();
    } finally {
      setIssuing(false);
    }
  }

  async function revokeActiveToken(device_id: string) {
    const tks = tokensByDevice.get(device_id) ?? [];
    const active = tks.find((t) => !t.revoked_at) ?? null;
    if (!active) return { ok: false as const, msg: "No active token to revoke." };

    const r = await safeFetch<OkResp>("/api/device/revoke-token", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token_id: active.id }),
    });

    if (!r.ok) return { ok: false as const, msg: `${r.status}: ${r.error}` };
    const j: any = r.data;
    if (!j?.ok) return { ok: false as const, msg: j?.error ?? "Failed" };

    await loadDevices();
    return { ok: true as const, msg: "" };
  }

  const filtered = useMemo(() => {
    let list = devices;

    if (activeOnly) list = list.filter((d) => (d.status ?? "").toLowerCase() === "active");
    if (shopFilter) list = list.filter((d) => (d.shop_id ?? "") === shopFilter);

    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter((d) => {
        const shopName = d.shop_name ?? shopsById.get(d.shop_id ?? "")?.name ?? "";
        return (
          (d.name ?? "").toLowerCase().includes(qq) ||
          (d.id ?? "").toLowerCase().includes(qq) ||
          (d.device_type ?? "").toLowerCase().includes(qq) ||
          (d.shop_id ?? "").toLowerCase().includes(qq) ||
          String(shopName).toLowerCase().includes(qq)
        );
      });
    }

    return list;
  }, [devices, activeOnly, shopFilter, q, shopsById]);

  function computeLastSeen(d: Device) {
    const tks = tokensByDevice.get(d.id) ?? [];
    const ts = [...tks].map((t) => t.last_seen_at).filter(Boolean) as string[];
    const lastTok = ts.sort().pop() ?? null;
    return lastTok ?? d.last_seen_at ?? null;
  }

  function computeHealth(lastSeenIso: string | null): "ok" | "stale" | "offline" {
    if (!lastSeenIso) return "offline";
    const t = Date.parse(lastSeenIso);
    if (!Number.isFinite(t)) return "offline";
    const ageMs = Date.now() - t;
    const day = 24 * 60 * 60 * 1000;
    if (ageMs > 7 * day) return "offline";
    if (ageMs > 1 * day) return "stale";
    return "ok";
  }

  function tokenCounts(device_id: string) {
    const tks = tokensByDevice.get(device_id) ?? [];
    const active = tks.filter((t) => !t.revoked_at).length;
    const revoked = tks.filter((t) => !!t.revoked_at).length;
    return { active, revoked, total: tks.length };
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Global Devices</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn tone="neutral" onClick={() => setActiveOnly((v) => !v)}>
            {activeOnly ? "Show All" : "Show Active Only"}
          </Btn>
          <Btn tone="neutral" onClick={loadAll}>
            Refresh
          </Btn>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Issue Token returns a raw token once. Disabled devices fail validation. Stale &gt; 24h, Offline &gt; 7d.
      </div>

      <GlassCard title="Create Device">
        <div style={{ display: "grid", gap: 10, maxWidth: 900 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Device name</div>
            <input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="e.g. Front Office PC"
              style={{ padding: "10px 12px", borderRadius: 12 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Device type</div>
              <select value={cType} onChange={(e) => setCType(e.target.value as any)} style={{ padding: "10px 12px", borderRadius: 12 }}>
                <option value="desktop">desktop</option>
                <option value="mobile">mobile</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Shop</div>
              <select value={cShopId} onChange={(e) => setCShopId(e.target.value)} style={{ padding: "10px 12px", borderRadius: 12 }}>
                <option value="">Select shop…</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {shortId(s.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Btn tone="primary" onClick={createDevice} disabled={creating}>
              {creating ? "Creating…" : "Create Device"}
            </Btn>
            {createMsg ? <div style={{ fontSize: 12, opacity: 0.85 }}>{createMsg}</div> : null}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Filters">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search (device name/id/shop/type)…"
              style={{ padding: "10px 12px", borderRadius: 12 }}
            />
            <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)} style={{ padding: "10px 12px", borderRadius: 12 }}>
              <option value="">All shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {(q || shopFilter) ? (
            <div style={{ display: "flex", gap: 10 }}>
              <Btn
                tone="neutral"
                onClick={() => {
                  setQ("");
                  setShopFilter("");
                }}
              >
                Clear Filters
              </Btn>
            </div>
          ) : null}
        </div>
      </GlassCard>

      <GlassCard title={`Devices (${filtered.length})`}>
        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No devices.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map((d) => {
              const lastSeen = computeLastSeen(d);
              const health = computeHealth(lastSeen);
              const shopName = d.shop_name ?? shopsById.get(d.shop_id ?? "")?.name ?? "—";
              const counts = tokenCounts(d.id);
              const isActive = (d.status ?? "").toLowerCase() === "active";

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
                      <TokenActiveChip active={counts.active} />
                      <HealthChip kind={health} />
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.78 }}>
                      {d.device_type ?? "—"} • {shopName} ({shortId(d.shop_id)})
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.82 }}>
                      Last seen: <b>{ageFromIso(lastSeen)}</b> • Version: <b>{d.reported_version ?? "—"}</b>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>
                      ISO: {iso(lastSeen)}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.82 }}>
                      Tokens: <b style={{ opacity: 0.95 }}>{counts.active}</b> active /{" "}
                      <b style={{ opacity: 0.9 }}>{counts.revoked}</b> revoked (total {counts.total})
                    </div>

                    <div style={{ fontSize: 11, opacity: 0.6 }}>Device ID: {d.id}</div>
                  </div>

                  <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <Btn tone="primary" onClick={() => openIssueToken(d)}>
                        Issue Token
                      </Btn>

                      <Btn
                        tone="neutral"
                        onClick={async () => {
                          const r = await revokeActiveToken(d.id);
                          if (!r.ok) alert(r.msg);
                        }}
                        disabled={counts.active === 0}
                        title={counts.active === 0 ? "No active token" : "Revoke current active token"}
                      >
                        Revoke Active
                      </Btn>

                      <Btn
                        tone={isActive ? "warn" : "neutral"}
                        onClick={async () => {
                          const next = isActive ? "disabled" : "active";
                          const ok = window.confirm(
                            `${isActive ? "Disable" : "Enable"} device?\n\n${d.name}\n${d.id}\n\n${
                              isActive
                                ? "Disabling causes token validation to fail."
                                : "Enabling allows token validation again."
                            }`
                          );
                          if (!ok) return;
                          const r = await setDeviceStatus(d.id, next);
                          if (!r.ok) alert(r.msg);
                          else await loadDevices();
                        }}
                      >
                        {isActive ? "Disable" : "Enable"}
                      </Btn>

                      <Btn
                        tone="danger"
                        onClick={async () => {
                          const ok = window.confirm(
                            `DELETE device?\n\n${d.name}\n${d.id}\n\nThis deletes the device row. Tokens may remain unless FK cascade is set.`
                          );
                          if (!ok) return;
                          const r = await deleteDevice(d.id);
                          if (!r.ok) alert(r.msg);
                          else await loadDevices();
                        }}
                      >
                        Delete
                      </Btn>
                    </div>

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <Link
                        href={`/devices/${d.id}`}
                        style={{
                          padding: "10px 12px",
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

                      {d.shop_id ? (
                        <Link
                          href={`/shops/${d.shop_id}/audit`}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            textDecoration: "none",
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.03)",
                            color: "#e6e8ef",
                            fontWeight: 900,
                          }}
                        >
                          Audit →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{status}</div> : null}

      <Modal
        title={issueDevice ? `Issue Token — ${issueDevice.name}` : "Issue Token"}
        open={issueOpen}
        onClose={() => {
          setIssueOpen(false);
          setIssueDevice(null);
        }}
      >
        {!issueDevice ? null : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              This revokes any existing active token for this device, then returns a raw token once.
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Label (optional)</div>
              <input
                value={issueLabel}
                onChange={(e) => setIssueLabel(e.target.value)}
                placeholder="e.g. FrontOffice-2026-02-15"
                style={{ padding: "10px 12px", borderRadius: 12 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Btn tone="primary" onClick={issueTokenNow} disabled={issuing}>
                {issuing ? "Issuing…" : "Issue Token"}
              </Btn>
              {issueMsg ? <div style={{ fontSize: 12, opacity: 0.85 }}>{issueMsg}</div> : null}
            </div>

            {issuedToken ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 900 }}>Raw Token (copy once)</div>
                <textarea
                  readOnly
                  value={issuedToken}
                  style={{
                    width: "100%",
                    minHeight: 96,
                    padding: 12,
                    borderRadius: 12,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 12,
                  }}
                />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Btn
                    tone="primary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(issuedToken);
                        setIssueMsg("Copied to clipboard.");
                      } catch {
                        setIssueMsg("Copy failed (browser blocked). Select + copy manually.");
                      }
                    }}
                  >
                    Copy Token
                  </Btn>
                  <Btn
                    tone="neutral"
                    onClick={() => {
                      setIssuedToken("");
                      setIssueMsg("Cleared.");
                    }}
                  >
                    Clear
                  </Btn>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
