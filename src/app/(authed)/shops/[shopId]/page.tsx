import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { rbGetShop, rbGetUpdatePolicy, rbListShopDevices } from "@/lib/rb";

export default async function ShopDetailPage({ params }: { params: { shopId: string } }) {
  const shop = await rbGetShop(params.shopId);
  const devices = await rbListShopDevices(params.shopId);
  const policy = await rbGetUpdatePolicy(params.shopId);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>{shop.name}</h1>
        <Link href={`/shops/${shop.id}/members`} style={{ textDecoration: "none" }}>
          Members →
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <GlassCard title="Shop Info">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Shop ID</div>
          <div style={{ fontWeight: 800 }}>{shop.id}</div>
        </GlassCard>

        <GlassCard title="Update Policy">
          <div style={{ opacity: 0.9 }}>
            Channel: <b>{policy?.channel ?? "none"}</b>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
            Min: {policy?.min_version ?? "—"} <br />
            Pinned: {policy?.pinned_version ?? "—"}
          </div>
        </GlassCard>

        <GlassCard title="Devices">
          {devices.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No devices for this shop.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {devices.map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{d.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Status: {d.status}</div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
