import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("rb_shops")
    .select("id,name,created_at")
    .order("created_at", { ascending: false });

  const shops = data ?? [];

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>All Shops</h1>

        <Link
          href="/shops/new"
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
          Create Shop
        </Link>
      </div>

      {error ? (
        <GlassCard title="Error">
          <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>{error.message}</div>
        </GlassCard>
      ) : null}

      <GlassCard title={`Shops (${shops.length})`}>
        {shops.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No shops yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {shops.map((s: any) => (
              <Link
                key={s.id}
                href={`/shops/${s.id}`}
                style={{
                  textDecoration: "none",
                  color: "#e6e8ef",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(255,255,255,0.02)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 900 }}>{s.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {s.created_at ? new Date(s.created_at).toISOString() : "—"} • {s.id}
                </div>
                <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 900 }}>Enter Shop →</div>
              </Link>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
