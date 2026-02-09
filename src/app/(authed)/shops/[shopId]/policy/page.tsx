import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { rbGetShop, rbGetUpdatePolicy } from "@/lib/rb";

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

export default async function ShopPolicyPage({ params }: Props) {
  const { shopId } = await params;

  const shop = await rbGetShop(shopId);
  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Update Policy</h1>
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

  const policy = await rbGetUpdatePolicy(shop.id);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Update Policy</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          This policy controls update channel and version gates for this shop.
        </div>
      </div>

      <GlassCard title="Current Policy">
        {!policy ? (
          <div style={{ opacity: 0.75 }}>
            No policy found for this shop yet.
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              (This page is read-only right now; next step is adding an editor.)
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <Row label="Channel" value={policy.channel ?? "—"} />
            <Row label="Minimum version" value={policy.min_version ?? "—"} />
            <Row label="Pinned version" value={policy.pinned_version ?? "—"} />
            <Row label="Updated/created" value={policy.created_at ? new Date(policy.created_at).toISOString() : "—"} />
          </div>
        )}
      </GlassCard>
    </div>
  );
}
