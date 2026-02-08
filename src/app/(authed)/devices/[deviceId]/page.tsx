"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import { safeFetch } from "@/lib/http/safeFetch";

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

export default function DeviceDetailPage() {
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;
  const router = useRouter();

  const [device, setDevice] = useState<Device | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [reveal, setReveal] = useState<RevealInfo | null>(null);

  const [testToken, setTestToken] = useState("");
  const [testResult, setTestResult] = useState<string>("");
  const [testBusy, setTestBusy] = useState(false);

  const activeToken = useMemo(() => tokens.find((t) => !t.revoked_at) ?? null, [tokens]);

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

  function getDeviceVersion(d: Device | null): string | null {
    if (!d) return null;
    const v =
      (d.reported_version ?? "").trim() ||
      (d.app_version ?? "").trim() ||
      (d.version ?? "").trim() ||
      "";
    return v ? v : null;
  }

  function getDeviceLastSeen(d: Device | null, deviceTokens: Token[]): string | null {
    let last: string | null = d?.last_seen_at ?? null;
    for (const t of deviceTokens) last = newestIso(last, t.last_seen_at ?? null);
    last = newestIso(last, d?.reported_version_at ?? null);
    return last;
  }

  function getShopLabel(d: Device | null): string {
    if (!d) return "—";
    if (d.shop_name && d.shop_name.trim()) return d.shop_name.trim();
    if (d.shop_id) return d.shop_id;
    return "—";
  }

  async function reload() {
    setLoading(true);
    setStatus("");

    const r = await safeFetch<ListResp>("/api/device/list", {
      credentials: "include",
      cache: "no-store",
    });

    if (!r.ok) {
      setStatus(formatFetchErr("Devices", r));
      setDevice(null);
      setTokens([]);
      setLoading(false);
      return;
    }

    const j: any = r.data;
    if (!j?.ok) {
      setStatus(j?.error ?? "Failed to load devices");
      setDevice(null);
      setTokens([]);
      setLoading(false);
      return;
    }

    const allDevices: Device[] = (j.devices ?? []) as Device[];
    const allTokens: Token[] = (j.tokens ?? []) as Token[];

    const d = allDevices.find((x) => x.id === deviceId) ?? null;
    setDevice(d);

    const t = allTokens
      .filter((x) => x.device_id === deviceId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    setTokens(t);

    if (!d) setStatus("Device not found (it may have been deleted).");

    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [deviceId]);

  async function issueToken() {
    setStatus("");
    setBusy(true);

    const r = await safeFetch<any>("/api/device/issue-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ device_id: deviceId, label: "issued-from-details" }),
    });

    setBusy(false);

    if (!r.ok) return setStatus(formatFetchErr("Issue token", r));

    const j: any = r.data;
    if (!j?.ok) return setStatus(j?.error ?? "Issue token failed");

    const token = String(j.token ?? "").trim();
    if (!token) return setStatus("Token was not returned.");

    setReveal({
      token,
      token_id: j.token_id ?? null,
      issuedAtIso: new Date().toISOString(),
    });

    // convenience: load into test box too
    setTestToken(token);
    setTestResult("");

    await reload();
  }

  async function revokeToken(tokenId: string) {
    setStatus("");
    setBusy(true);

    const r = await safeFetch<any>("/api/device/revoke-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token_id: tokenId }),
    });

    setBusy(false);

    if (!r.ok) return setStatus(formatFetchErr("Revoke token", r));

    const j: any = r.data;
    if (!j?.ok) return setStatus(j?.error ?? "Revoke failed");

    await reload();
  }

  async function deleteDevice() {
    if (!device) return;

    const ok = window.confirm(`Delete device "${device.name}"?\n\nThis permanently deletes the device and ALL its tokens.`);
    if (!ok) return;

    setStatus("");
    setBusy(true);

    const r = await safeFetch<any>("/api/device/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ device_id: device.id }),
    });

    setBusy(false);

    if (!r.ok) return setStatus(formatFetchErr("Delete device", r));

    const j: any = r.data;
    if (!j?.ok) return setStatus(j?.error ?? "Delete failed");

    router.replace("/devices");
  }

  async function setDeviceStatus(nextStatus: "active" | "disabled") {
    if (!device) return;

    const label = nextStatus === "disabled" ? "Disable" : "Enable";
    const ok = window.confirm(`${label} this device?\n\nToken validation will ${nextStatus === "disabled" ? "FAIL" : "PASS"} based on status.`);
    if (!ok) return;

    setBusy(true);
    setStatus("");

    const r = await safeFetch<any>("/api/device/set-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ device_id: device.id, status: nextStatus }),
    });

    setBusy(false);

    if (!r.ok) return setStatus(formatFetchErr("Set status", r));

    const j: any = r.data;
    if (!j?.ok) return setStatus(j?.error ?? "Status update failed");

    await reload();
  }

  async function testValidate() {
    setTestBusy(true);
    setTestResult("");

    const raw = testToken.trim();
    if (!raw) {
      setTestBusy(false);
      setTestResult("Enter a token first.");
      return;
    }

    try {
      const res = await fetch("/api/device/validate-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${raw}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({}),
      });

      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}

      const out = {
        http_status: res.status,
        ok: res.ok,
        body: parsed ?? text,
      };

      setTestResult(JSON.stringify(out, null, 2));
    } catch (e: any) {
      setTestResult(`Fetch failed: ${e?.message ?? String(e)}`);
    } finally {
      setTestBusy(false);
      // refresh to pull last_seen updates if any
      await reload();
    }
  }

  const version = getDeviceVersion(device);
  const lastSeen = getDeviceLastSeen(device, tokens);
  const isDisabled = (device?.status ?? "") !== "active";

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Device Details</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => router.back()} style={{ padding: "10px 14px", borderRadius: 12 }}>
            Back
          </button>
          <button onClick={reload} disabled={busy} style={{ padding: "10px 14px", borderRadius: 12 }}>
            Refresh
          </button>
        </div>
      </div>

      {status ? (
        <div
          style={{
            fontSize: 12,
            opacity: 0.85,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 12,
            whiteSpace: "pre-wrap",
          }}
        >
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
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{device.name}</div>
              <StatusChip status={device.status} />
            </div>

            <div style={{ fontSize: 12, opacity: 0.75 }}>{device.device_type}</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Device ID: {device.id}</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Shop: {getShopLabel(device)}</div>

            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Last seen: <span style={{ fontWeight: 900 }}>{isoOrDash(lastSeen)}</span>
              {"  "}•{"  "}
              Version: <span style={{ fontWeight: 900 }}>{version ?? "—"}</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <button onClick={issueToken} disabled={busy} style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900 }}>
                Reveal Token (once)
              </button>

              {isDisabled ? (
                <button
                  onClick={() => setDeviceStatus("active")}
                  disabled={busy}
                  style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900 }}
                >
                  Enable Device
                </button>
              ) : (
                <button
                  onClick={() => setDeviceStatus("disabled")}
                  disabled={busy}
                  style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900, opacity: 0.95 }}
                >
                  Disable Device
                </button>
              )}

              <button
                onClick={deleteDevice}
                disabled={busy}
                style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900, opacity: 0.9 }}
              >
                Delete Device
              </button>
            </div>

            <div style={{ fontSize: 12, opacity: 0.65 }}>
              Validation behavior: {isDisabled ? "token validation will FAIL (disabled)" : "token validation will PASS (active)"}
            </div>
          </div>
        )}
      </GlassCard>

      {reveal ? (
        <GlassCard title="Token (revealed once)">
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 900 }}>
              Copy now • {reveal.issuedAtIso}
            </div>
            <textarea
              readOnly
              value={reveal.token}
              style={{
                width: "100%",
                minHeight: 90,
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
                onClick={() => setReveal(null)}
                style={{ padding: "10px 12px", borderRadius: 12, opacity: 0.9 }}
              >
                Clear
              </button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              This raw token is shown only here. It is not stored and cannot be recovered later.
            </div>
          </div>
        </GlassCard>
      ) : null}

      <GlassCard title="Test validate-token">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Paste a device token and click Validate. This calls <b>/api/device/validate-token</b> and shows the HTTP status + response.
          </div>

          <textarea
            value={testToken}
            onChange={(e) => setTestToken(e.target.value)}
            placeholder="Paste token here..."
            style={{
              width: "100%",
              minHeight: 80,
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
              onClick={testValidate}
              disabled={testBusy}
              style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900 }}
            >
              {testBusy ? "Validating…" : "Validate"}
            </button>

            <button
              onClick={() => {
                setTestResult("");
                setStatus("");
              }}
              disabled={testBusy}
              style={{ padding: "10px 12px", borderRadius: 12, opacity: 0.9 }}
            >
              Clear result
            </button>
          </div>

          {testResult ? (
            <pre
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                opacity: 0.9,
              }}
            >
{testResult}
            </pre>
          ) : null}
        </div>
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
                    revoked: {t.revoked_at ? "yes" : "no"} • last_seen: {isoOrDash(t.last_seen_at)}
                  </div>
                </div>

                <button
                  onClick={() => revokeToken(t.id)}
                  disabled={busy || !!t.revoked_at}
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
