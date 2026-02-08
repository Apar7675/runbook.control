import React from "react";
import GlassCard from "@/components/GlassCard";
import { rbGetShop, rbListShopDevices } from "@/lib/rb";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopDevicesPage({ params }: Props) {
  const { shopId } = await params;

  const shop = await rbGetShop(shopId);

  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Devices</h1>

        <GlassCard title="Not found / no access">
          <div style={{ opacity: 0.8 }}>
            This shop does not exist, or you don’t have access.
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            shop_id: <span style={{ fontWeight: 900 }}>{shopId}</span>
          </div>
        </GlassCard>
      </div>
    );
  }

  const devices = await rbListShopDevices(shop.id);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Devices — {shop.name}</h1>
      </div>

      <GlassCard title={`Registered Devices (${devices.length})`}>
        {devices.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No devices for this shop.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {devices.map((d: any) => (
              <div
                key={d.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ fontWeight: 900 }}>{d.name ?? "(unnamed)"}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {(d.device_type ?? "—")} • {(d.status ?? "—")} • {d.id}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Created: {d.created_at ? new Date(d.created_at).toISOString() : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
