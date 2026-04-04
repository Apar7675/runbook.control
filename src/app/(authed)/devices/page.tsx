"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ActionLink, EmptyState, PageHeader, SectionBlock, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { safeFetch } from "@/lib/http/safeFetch";

type Device = {
  id: string;
  name: string;
  device_type: string | null;
  status: string;
  shop_id: string | null;
  shop_name?: string | null;
  last_seen_at?: string | null;
  reported_version?: string | null;
};

type Token = {
  id: string;
  device_id: string;
  revoked_at: string | null;
  last_seen_at: string | null;
};

type Shop = { id: string; name: string };

type ListResp = { ok: true; devices: Device[]; tokens: Token[] } | { ok?: false; error?: string };
type ShopsResp = { ok: true; shops: Shop[] } | { ok?: false; error?: string };
type CreateResp = { ok: true } | { ok?: false; error?: string };
type OkResp = { ok: true } | { ok?: false; error?: string };

function relativeAge(value?: string | null) {
  if (!value) return "No recent check-in";
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return "No recent check-in";
  const ageMs = Date.now() - ts;
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return "Checked in just now";
  if (minutes < 60) return `Checked in ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Checked in ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Checked in ${days}d ago`;
}

function healthLabel(lastSeenAt?: string | null) {
  if (!lastSeenAt) return "Offline";
  const ts = Date.parse(lastSeenAt);
  if (!Number.isFinite(ts)) return "Offline";
  const ageMs = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  if (ageMs > 7 * day) return "Offline";
  if (ageMs > day) return "Warning";
  return "Healthy";
}

export default function DevicesPage() {
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<"desktop" | "mobile">("desktop");
  const [createShopId, setCreateShopId] = useState("");
  const [creating, setCreating] = useState(false);
  const returnTo = searchParams.get("return_to") ?? "";

  async function load() {
    setLoading(true);
    setStatus("");
    const [devicesRes, shopsRes] = await Promise.all([
      safeFetch<ListResp>("/api/device/list", { credentials: "include", cache: "no-store" }),
      safeFetch<ShopsResp>("/api/shops/list-simple", { credentials: "include", cache: "no-store" }),
    ]);

    if (!devicesRes.ok) {
      setStatus(`${devicesRes.status}: ${devicesRes.error}`);
      setLoading(false);
      return;
    }
    if (!shopsRes.ok) {
      setStatus(`${shopsRes.status}: ${shopsRes.error}`);
      setLoading(false);
      return;
    }

    const devicePayload: any = devicesRes.data;
    const shopPayload: any = shopsRes.data;

    if (!devicePayload?.ok) {
      setStatus(devicePayload?.error ?? "Unable to load devices.");
      setLoading(false);
      return;
    }

    setDevices(devicePayload.devices ?? []);
    setTokens(devicePayload.tokens ?? []);
    setShops(shopPayload?.ok ? shopPayload.shops ?? [] : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const tokenMap = useMemo(() => {
    const map = new Map<string, Token[]>();
    for (const token of tokens) {
      const rows = map.get(token.device_id) ?? [];
      rows.push(token);
      map.set(token.device_id, rows);
    }
    return map;
  }, [tokens]);

  const summary = useMemo(() => {
    const active = devices.filter((device) => String(device.status).toLowerCase() === "active").length;
    const workstations = devices.filter((device) => String(device.device_type).toLowerCase() === "workstation").length;
    const desktops = devices.filter((device) => String(device.device_type).toLowerCase() === "desktop").length;
    const offline = devices.filter((device) => healthLabel(device.last_seen_at) === "Offline").length;
    return { active, workstations, desktops, offline };
  }, [devices]);

  async function createDevice() {
    if (!createName.trim() || !createShopId) {
      setStatus("Choose a shop and device name first.");
      return;
    }

    setCreating(true);
    const response = await safeFetch<CreateResp>("/api/device/create", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: createName.trim(), device_type: createType, shop_id: createShopId }),
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setStatus(response.ok ? ((response.data as any)?.error ?? "Unable to create device.") : `${response.status}: ${response.error}`);
      setCreating(false);
      return;
    }

    setCreateName("");
    setStatus("Device created.");
    setCreating(false);
    await load();
  }

  async function updateDevice(deviceId: string, action: "disable" | "enable" | "delete") {
    const endpoint =
      action === "delete" ? "/api/device/delete" : "/api/device/set-status";
    const body = action === "delete" ? { device_id: deviceId } : { device_id: deviceId, status: action === "disable" ? "disabled" : "active" };

    const response = await safeFetch<OkResp>(endpoint, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok || !(response.data as any)?.ok) {
      setStatus(response.ok ? ((response.data as any)?.error ?? "Action failed.") : `${response.status}: ${response.error}`);
      return;
    }

    setStatus(action === "delete" ? "Device removed." : "Device updated.");
    await load();
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        eyebrow="Devices"
        title="Device Center"
        description="Keep device management calm and obvious: what is connected, what needs attention, and which action matters next."
        actions={
          <>
            {returnTo ? <ActionLink href={returnTo}>Return to Setup</ActionLink> : null}
            <ActionLink href="/apps" tone="primary">Review App Access</ActionLink>
            <ActionLink href="/updates">Review Updates</ActionLink>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <SectionBlock title="Active Devices" description="Devices currently allowed to operate.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{summary.active}</div>
        </SectionBlock>
        <SectionBlock title="Desktop" description="Registered desktop devices.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{summary.desktops}</div>
        </SectionBlock>
        <SectionBlock title="Workstation" description="Registered workstation devices.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{summary.workstations}</div>
        </SectionBlock>
        <SectionBlock title="Attention Needed" description="Devices not checking in normally.">
          <div style={{ fontSize: 34, fontWeight: 900 }}>{summary.offline}</div>
        </SectionBlock>
      </div>

      <SectionBlock title="Register Device" description="Use one clear workflow instead of scattering setup actions across the page.">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(180px, 0.8fr) minmax(220px, 1fr) auto", gap: 10, alignItems: "end" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Device name</label>
            <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Front Office PC" style={{ padding: "10px 12px", borderRadius: 12 }} />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Type</label>
            <select value={createType} onChange={(event) => setCreateType(event.target.value as "desktop" | "mobile")} style={{ padding: "10px 12px", borderRadius: 12 }}>
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile Client</option>
            </select>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Shop</label>
            <select value={createShopId} onChange={(event) => setCreateShopId(event.target.value)} style={{ padding: "10px 12px", borderRadius: 12 }}>
              <option value="">Select shop</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </div>
          <button onClick={createDevice} disabled={creating} style={{ minHeight: 42, padding: "10px 14px", borderRadius: 14, fontWeight: 900 }}>
            {creating ? "Creating..." : "Register Device"}
          </button>
        </div>
      </SectionBlock>

      <SectionBlock title="Device Health" description="Separate what the admin needs to know from the lower-level implementation details.">
        {loading ? (
          <div style={{ opacity: 0.76 }}>Loading devices...</div>
        ) : devices.length === 0 ? (
          <EmptyState
            title="No devices yet"
            description="Register the first device to start Desktop, Workstation, or update-client setup."
            action={<ActionLink href="/apps" tone="primary">Review App Setup</ActionLink>}
          />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {devices.map((device) => {
              const health = healthLabel(device.last_seen_at);
              const activeTokens = (tokenMap.get(device.id) ?? []).filter((token) => !token.revoked_at).length;
              const isActive = String(device.status).toLowerCase() === "active";
              return (
                <div
                  key={device.id}
                  style={{
                    display: "grid",
                    gap: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{device.name}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <StatusBadge label={health} tone={toneFromStatus(health)} />
                        <StatusBadge label={isActive ? "Active" : "Restricted"} tone={toneFromStatus(isActive ? "Healthy" : "Action Needed")} />
                        <StatusBadge label={device.device_type ?? "client"} tone="neutral" />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <ActionLink href={`/devices/${device.id}`}>View Health</ActionLink>
                      <button
                        onClick={() => updateDevice(device.id, isActive ? "disable" : "enable")}
                        style={{ minHeight: 42, padding: "10px 14px", borderRadius: 14, fontWeight: 900 }}
                      >
                        {isActive ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        onClick={() => updateDevice(device.id, "delete")}
                        style={{ minHeight: 42, padding: "10px 14px", borderRadius: 14, fontWeight: 900 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div style={{ color: "rgba(230,232,239,0.82)", lineHeight: 1.5 }}>
                    {relativeAge(device.last_seen_at)}. {activeTokens} active token{activeTokens === 1 ? "" : "s"}.
                    {device.reported_version ? ` Reported version ${device.reported_version}.` : " No version reported yet."}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.72 }}>
                    Shop: {device.shop_name ?? device.shop_id ?? "Unassigned"} | Device ID: {device.id}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionBlock>

      {status ? <div style={{ fontSize: 13, opacity: 0.82 }}>{status}</div> : null}
    </div>
  );
}
