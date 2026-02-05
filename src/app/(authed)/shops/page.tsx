import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { rbGetUserIdOrThrow, rbListMyShops } from "@/lib/rb";
import { supabaseServer } from "@/lib/supabase/server";

async function createShop(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const userId = await rbGetUserIdOrThrow();
  const supabase = await supabaseServer();

  // Create shop
  const { data: shop, error: e1 } = await supabase
    .from("rb_shops")
    .insert({ name })
    .select("*")
    .single();

  if (e1) throw new Error(e1.message);

  // Create membership as admin
  const { error: e2 } = await supabase.from("rb_shop_members").insert({
    shop_id: shop.id,
    user_id: userId,
    role: "admin",
  });

  if (e2) throw new Error(e2.message);

  // Create default update policy
  const { error: e3 } = await supabase.from("rb_update_policy").insert({
    shop_id: shop.id,
    channel: "stable",
    min_version: null,
    pinned_version: null,
  });

  if (e3) throw new Error(e3.message);
}

export default async function ShopsPage() {
  const shops = await rbListMyShops();

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Shops</h1>
        <div style={{ opacity: 0.7, fontSize: 13 }}>{shops.length} total</div>
      </div>

      <GlassCard title="Create Shop">
        <form action={createShop} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            name="name"
            placeholder="Shop name (e.g. Ten MFG)"
            style={{ padding: 10, borderRadius: 12, minWidth: 280 }}
          />
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 800 }}>
            Create
          </button>
        </form>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
          Creates the shop + makes you <b>admin</b> + creates default update policy.
        </div>
      </GlassCard>

      <div style={{ display: "grid", gap: 12 }}>
        {shops.map((s) => (
          <Link
            key={s.id}
            href={`/shops/${s.id}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 16,
              padding: 14,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900 }}>{s.name}</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>ID: {s.id}</div>
          </Link>
        ))}

        {shops.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No shops yet. Create your first one above.</div>
        ) : null}
      </div>
    </div>
  );
}
