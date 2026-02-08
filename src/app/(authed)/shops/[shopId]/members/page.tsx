import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { rbGetShop } from "@/lib/rb";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopMembersPage({ params }: Props) {
  const { shopId } = await params;

  const shop = await rbGetShop(shopId);
  const shopName = shop?.name ?? "Shop";

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>{shopName} — Admins</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          RunBook.Control is the control plane. Shop employees do not log into Control.
        </div>
      </div>

      <GlassCard title="Not managed here">
        <div style={{ display: "grid", gap: 10, opacity: 0.85 }}>
          <div>
            Shop users (employees, supervisors, quality, etc.) are managed inside the RunBook app — not RunBook.Control.
          </div>

          <div>
            RunBook.Control access is limited to platform admins for:
            <ul style={{ margin: "8px 0 0 18px", opacity: 0.9 }}>
              <li>Devices + tokens</li>
              <li>Updates + packages</li>
              <li>Audit log + support bundles</li>
              <li>Security (MFA, trusted devices)</li>
            </ul>
          </div>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            shop_id: <span style={{ fontWeight: 900 }}>{shopId}</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={`/shops/${shopId}`}
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
              Back to Shop
            </Link>

            <Link
              href="/devices"
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
              Go to Devices
            </Link>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
