import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { rbGetShop, rbGetUpdatePolicy, rbListShopDevices } from "@/lib/rb";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

export default async function ShopPage({ params }: Props) {
  const { shopId } = await params;

  const shop = await rbGetShop(shopId);
  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Shop</h1>
        <GlassCard title="Not found / no access">
          <div style={{ opacity: 0.8 }}>This shop does not exist, or you don’t have access.</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            shop_id: <span style={{ fontWeight: 900 }}>{shopId}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Link href="/shops" style={{ color: "#b8b9ff", textDecoration: "none", fontWeight: 900 }}>
              ← Back to All Shops
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const [policy, devices] = await Promise.all([rbGetUpdatePolicy(shop.id), rbListShopDevices(shop.id)]);
  const activeDevices = devices.filter((d: any) => (String(d.status ?? "").toLowerCase() === "active")).length;

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>{shop.name}</h1>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/shops/${shop.id}/devices`}
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
            Manage Devices →
          </Link>

          <Link
            href={`/shops/${shop.id}/policy`}
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
            Update Policy →
          </Link>

          <Link
            href={`/shops/${shop.id}/audit`}
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
            Audit →
          </Link>
        </div>
      </div>

      <GlassCard title="Shop Summary">
        <div style={{ display: "grid", gap: 10 }}>
          <Row label="Shop ID" value={shop.id} />
          <Row label="Created" value={shop.created_at ? new Date(shop.created_at).toISOString() : "—"} />
          <Row label="Devices" value={`${devices.length} total (${activeDevices} active)`} />
        </div>
      </GlassCard>

      <GlassCard title="Update Policy (read-only)">
        {!policy ? (
          <div style={{ opacity: 0.75 }}>
            No policy found for this shop yet.
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Go to <b>Update Policy</b> to review/update when editor is added.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <Row label="Channel" value={policy.channel ?? "—"} />
            <Row label="Minimum version" value={policy.min_version ?? "—"} />
            <Row label="Pinned version" value={policy.pinned_version ?? "—"} />
          </div>
        )}
      </GlassCard>

      <GlassCard title="Getting Started (shop-scoped)">
        <div style={{ display: "grid", gap: 10, opacity: 0.9 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Bring this shop online safely. Recommended order:
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>
              Add/register devices in <b>Devices</b>
            </li>
            <li>
              Issue a device token and validate it
            </li>
            <li>
              Confirm check-in updates “Last seen” and “Version”
            </li>
            <li>
              Review update policy
            </li>
          </ol>
        </div>
      </GlassCard>
    </div>
  );
}
