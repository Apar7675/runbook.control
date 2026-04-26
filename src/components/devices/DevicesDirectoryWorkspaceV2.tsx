"use client";

import React from "react";
import Link from "next/link";
import ControlMetricStripV2 from "@/components/control/v2/ControlMetricStripV2";
import { ControlActionButtonV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlBadgeV2, { toneFromStatusV2 } from "@/components/control/v2/ControlBadgeV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import { ControlTableV2, ControlTableCellV2, ControlTableHeadCellV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";

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
type OkResp = { ok: true } | { ok?: false; error?: string };

type SortKey = "name" | "shop" | "last_seen" | "status" | "version";

function healthLabel(lastSeenAt?: string | null) {
  if (!lastSeenAt) return "Offline";
  const ts = Date.parse(lastSeenAt);
  if (!Number.isFinite(ts)) return "Offline";
  const ageMs = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  if (ageMs > 7 * day) return "Offline";
  if (ageMs > day) return "Warning";
  return "OK";
}

function parseTime(value?: string | null) {
  const ms = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

export default function DevicesDirectoryWorkspaceV2() {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [shops, setShops] = React.useState<Shop[]>([]);
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [shopFilter, setShopFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("last_seen");

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
    setShops(shopPayload?.ok ? shopPayload.shops ?? [] : []);
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, []);

  const summary = React.useMemo(() => {
    const active = devices.filter((device) => String(device.status).toLowerCase() === "active").length;
    const desktop = devices.filter((device) => String(device.device_type).toLowerCase() === "desktop").length;
    const workstation = devices.filter((device) => String(device.device_type).toLowerCase() === "workstation").length;
    const attention = devices.filter((device) => healthLabel(device.last_seen_at) !== "OK").length;
    return { active, desktop, workstation, attention };
  }, [devices]);

  const filteredDevices = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...devices]
      .filter((device) => {
        if (shopFilter !== "all" && String(device.shop_id ?? "") !== shopFilter) return false;
        if (typeFilter !== "all" && String(device.device_type ?? "").toLowerCase() !== typeFilter) return false;
        if (statusFilter === "attention") return healthLabel(device.last_seen_at) !== "OK";
        if (statusFilter !== "all" && String(device.status ?? "").toLowerCase() !== statusFilter) return false;
        return true;
      })
      .filter((device) => {
        if (!needle) return true;
        return [
          device.name,
          device.device_type,
          device.status,
          device.shop_name,
          device.shop_id,
          device.reported_version,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "shop") return String(a.shop_name ?? a.shop_id ?? "").localeCompare(String(b.shop_name ?? b.shop_id ?? ""));
        if (sort === "status") return String(a.status ?? "").localeCompare(String(b.status ?? ""));
        if (sort === "version") return String(b.reported_version ?? "").localeCompare(String(a.reported_version ?? ""));
        return parseTime(b.last_seen_at) - parseTime(a.last_seen_at);
      });
  }, [devices, query, shopFilter, sort, statusFilter, typeFilter]);

  async function updateDevice(deviceId: string, action: "disable" | "enable" | "delete") {
    const endpoint = action === "delete" ? "/api/device/delete" : "/api/device/set-status";
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
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ color: t.color.textQuiet, ...t.type.label }}>Devices</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Device center</h1>
        <div style={{ fontSize: 13, color: t.color.textQuiet }}>The devices table is the primary operator surface for device health, app version review, and admin action.</div>
      </div>

      <ControlMetricStripV2
        items={[
          { label: "Devices", value: String(devices.length) },
          { label: "Active", value: String(summary.active) },
          { label: "Desktop", value: String(summary.desktop) },
          { label: "Attention", value: String(summary.attention) },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ControlInputV2 value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search devices" style={{ minWidth: 220 }} />
          <ControlSelectV2 value={shopFilter} onChange={(event) => setShopFilter(event.target.value)} style={{ minWidth: 150 }}>
            <option value="all">All shops</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </ControlSelectV2>
          <ControlSelectV2 value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={{ minWidth: 140 }}>
            <option value="all">All types</option>
            <option value="desktop">Desktop</option>
            <option value="workstation">Workstation</option>
            <option value="mobile">Mobile</option>
          </ControlSelectV2>
          <ControlSelectV2 value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ minWidth: 140 }}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="attention">Needs attention</option>
          </ControlSelectV2>
          <ControlSelectV2 value={sort} onChange={(event) => setSort(event.target.value as SortKey)} style={{ minWidth: 150 }}>
            <option value="last_seen">Sort: last seen</option>
            <option value="name">Sort: name</option>
            <option value="shop">Sort: shop</option>
            <option value="status">Sort: status</option>
            <option value="version">Sort: version</option>
          </ControlSelectV2>
        </div>

        <ControlActionButtonV2 onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </ControlActionButtonV2>
      </div>

      {status ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>{status}</div> : null}

      <ControlTableWrapV2>
        <ControlTableV2 minWidth={980}>
          <thead>
            <tr>
              <ControlTableHeadCellV2>Device</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Shop</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Type</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Status</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Last Seen</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Version</ControlTableHeadCellV2>
              <ControlTableHeadCellV2 align="right">Actions</ControlTableHeadCellV2>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: t.color.textMuted }}>Loading devices...</td>
              </tr>
            ) : filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: t.color.textMuted }}>No devices matched the current filters.</td>
              </tr>
            ) : (
              filteredDevices.map((device) => {
                const health = healthLabel(device.last_seen_at);
                const isActive = String(device.status).toLowerCase() === "active";
                const statusLabel = isActive ? "Active" : String(device.status ?? "Unknown");
                return (
                  <tr key={device.id}>
                    <ControlTableCellV2>
                      <div style={{ display: "grid", gap: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.color.text }}>{device.name}</div>
                        <div style={{ color: t.color.textQuiet, fontSize: 11.5 }}>{device.id}</div>
                      </div>
                    </ControlTableCellV2>
                    <ControlTableCellV2>{device.shop_name ?? device.shop_id ?? "Unassigned"}</ControlTableCellV2>
                    <ControlTableCellV2>{device.device_type ?? "Unknown"}</ControlTableCellV2>
                    <ControlTableCellV2>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <ControlBadgeV2 label={statusLabel} tone={toneFromStatusV2(statusLabel)} />
                        <ControlBadgeV2 label={health} tone={toneFromStatusV2(health)} />
                      </div>
                    </ControlTableCellV2>
                    <ControlTableCellV2>{device.last_seen_at ? formatDateTime(device.last_seen_at) : "No recent check-in"}</ControlTableCellV2>
                    <ControlTableCellV2>{device.reported_version ?? "Unknown"}</ControlTableCellV2>
                    <ControlTableCellV2 align="right">
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Link
                          href={`/devices/${device.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 30,
                            padding: "5px 10px",
                            borderRadius: t.radius.sm,
                            border: `1px solid ${t.color.border}`,
                            background: t.color.surfaceAlt,
                            color: t.color.text,
                            textDecoration: "none",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Open
                        </Link>
                        <ControlActionButtonV2 onClick={() => void updateDevice(device.id, isActive ? "disable" : "enable")}>
                          {isActive ? "Disable" : "Enable"}
                        </ControlActionButtonV2>
                        <ControlActionButtonV2 tone="danger" onClick={() => void updateDevice(device.id, "delete")}>
                          Remove
                        </ControlActionButtonV2>
                      </div>
                    </ControlTableCellV2>
                  </tr>
                );
              })
            )}
          </tbody>
        </ControlTableV2>
      </ControlTableWrapV2>
    </div>
  );
}
