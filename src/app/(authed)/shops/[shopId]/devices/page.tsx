import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import DataTable from "@/components/DataTable";
import { rbGetShop, rbListShopDevices } from "@/lib/rb";

export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function TabBar({ shopId, active }: { shopId: string; active: "overview" | "devices" | "members" | "audit" }) {
  const item = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: isActive ? "rgba(139,140,255,0.16)" : "rgba(255,255,255,0.04)",
        fontWeight: 900,
        color: "inherit",
        opacity: isActive ? 1 : 0.85,
      }}
    >
      {label}
    </Link>
  );

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {item(`/shops/${shopId}`, "Overview", active === "overview")}
      {item(`/shops/${shopId}/devices`, "Devices", active === "devices")}
      {item(`/shops/${shopId}/members`, "Members", active === "members")}
      {item(`/audit?shop=${shopId}`, "Audit", active === "audit")}
    </div>
  );
}

export default async function ShopDevicesPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const sid = String(shopId ?? "").trim();

  if (!isUuid(sid)) {
    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Shop Devices</h1>
        <GlassCard title="Invalid Shop ID">
          <Link href="/shops" style={{ textDecoration: "none" }}>
            ← Back to Shops
          </Link>
        </GlassCard>
      </div>
    );
  }

  const shop = await rbGetShop(sid);
  const devices = await rbListShopDevices(sid);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Devices — {shop.name}</h1>
        <TabBar shopId={shop.id} active="devices" />
      </div>

      <GlassCard title="Quick Actions">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href={`/devices?shop=${shop.id}`}
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
              fontWeight: 900,
              color: "inherit",
            }}
          >
            + Create Device
          </Link>
        </div>
      </GlassCard>

      <GlassCard title="All Devices">
        <DataTable
          rows={devices}
          empty="No devices for this shop."
          columns={[
            {
              key: "name",
              header: "Name",
              render: (d: any) => (
                <Link href={`/devices/${d.id}`} style={{ textDecoration: "none", color: "inherit", fontWeight: 900 }}>
                  {d.name}
                </Link>
              ),
            },
            { key: "status", header: "Status", width: "120px", render: (d: any) => <span>{d.status}</span> },
            { key: "id", header: "Device ID", width: "240px", render: (d: any) => <code style={{ opacity: 0.75 }}>{String(d.id).slice(0, 8)}…</code> },
            { key: "created", header: "Created", width: "180px", render: (d: any) => new Date(d.created_at).toLocaleString() },
          ]}
        />
      </GlassCard>
    </div>
  );
}
