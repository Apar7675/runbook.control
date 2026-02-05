import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import GlassCard from "@/components/GlassCard";
import { rbListMyShops } from "@/lib/rb";

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  const shops = await rbListMyShops();

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
        <GlassCard title="Signed In">
          <div style={{ fontSize: 16, fontWeight: 800 }}>{data.user?.email}</div>
        </GlassCard>

        <GlassCard title="Shops">
          <div style={{ opacity: 0.85 }}>
            {shops.length} shop{shops.length === 1 ? "" : "s"}
          </div>
          <div style={{ marginTop: 10 }}>
            <Link href="/shops" style={{ textDecoration: "none" }}>
              Go to Shops →
            </Link>
          </div>
        </GlassCard>

        <GlassCard title="Devices">
          <div style={{ opacity: 0.85 }}>Manage registered devices</div>
          <div style={{ marginTop: 10 }}>
            <Link href="/devices" style={{ textDecoration: "none" }}>
              Go to Devices →
            </Link>
          </div>
        </GlassCard>

        <GlassCard title="Updates">
          <div style={{ opacity: 0.85 }}>Set stable/beta per shop</div>
          <div style={{ marginTop: 10 }}>
            <Link href="/updates" style={{ textDecoration: "none" }}>
              Go to Updates →
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
