import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";

async function createShop(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await supabaseServer();

  // RPC does: create shop + make current user admin + create default policy
  const { data: shopId, error } = await supabase.rpc("rb_create_shop", { p_name: name });

  if (error) throw new Error(error.message);
  if (!shopId) throw new Error("rb_create_shop returned no id");

  await auditLog({
    shop_id: shopId,
    action: "shop.created",
    entity_type: "shop",
    entity_id: shopId,
    details: { name },
  });

  redirect(`/shops/${shopId}`);
}

export default async function NewShopPage() {
  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Create Shop</h1>
        <Link href="/shops" style={{ textDecoration: "none", opacity: 0.9 }}>
          ← Back to Shops
        </Link>
      </div>

      <GlassCard title="Shop Details">
        <form action={createShop} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            name="name"
            placeholder="Shop name (e.g. Ten MFG)"
            style={{ padding: 10, borderRadius: 12, minWidth: 320 }}
          />
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
            Create
          </button>
        </form>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
          Uses a secure server function to create the shop and set you as admin.
        </div>
      </GlassCard>
    </div>
  );
}
