import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import DataTable from "@/components/DataTable";
import DeleteShopButton from "@/components/DeleteShopButton";
import { rbListMyShops } from "@/lib/rb";
import { theme } from "@/lib/ui/theme";

export default async function ShopsPage() {
  const shops = await rbListMyShops();

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Shops</h1>
        <Link
          href="/shops/new"
          style={{
            textDecoration: "none",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.05)",
            color: theme.text.primary,
            fontWeight: 900,
          }}
        >
          + Create Shop
        </Link>
      </div>

      <GlassCard title="All Shops">
        <DataTable
          rows={shops}
          empty="No shops created yet."
          columns={[
            {
              key: "name",
              header: "Name",
              render: (s: any) => {
                const id = String(s?.id ?? "");
                const name = String(s?.name ?? "Unnamed");
                if (!id) return <span style={{ fontWeight: 800 }}>{name}</span>;

                return (
                  <Link
                    href={`/shops/${id}`}
                    style={{
                      fontWeight: 800,
                      color: theme.text.primary,
                      textDecoration: "none",
                    }}
                  >
                    {name}
                  </Link>
                );
              },
            },
            {
              key: "id",
              header: "ID",
              render: (s: any) => {
                const id = String(s?.id ?? "");
                return id ? <code style={{ opacity: 0.7 }}>{id.slice(0, 8)}…</code> : <span style={{ opacity: 0.5 }}>—</span>;
              },
              width: "220px",
            },
            {
              key: "created",
              header: "Created",
              render: (s: any) => (s?.created_at ? new Date(s.created_at).toLocaleDateString() : "—"),
              width: "140px",
            },
            {
              key: "actions",
              header: "Actions",
              width: "140px",
              render: (s: any) => {
                const id = String(s?.id ?? "");
                const name = String(s?.name ?? "Shop");
                if (!id) return <span style={{ opacity: 0.5 }}>—</span>;

                return <DeleteShopButton shopId={id} shopName={name} />;
              },
            },
          ]}
        />
      </GlassCard>
    </div>
  );
}
