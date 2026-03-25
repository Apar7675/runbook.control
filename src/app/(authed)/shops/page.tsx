import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import DeleteShopButton from "@/components/DeleteShopButton";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";

export const dynamic = "force-dynamic";

type Shop = { id: string; name: string; created_at: string | null };

function ShopCard({ shop, canDelete = false }: { shop: Shop; canDelete?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 16,
        padding: 16,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{shop.name}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {shop.created_at ? new Date(shop.created_at).toISOString() : "-"} • {shop.id}
          </div>
        </div>

        {canDelete ? <DeleteShopButton shopId={shop.id} shopName={shop.name} /> : null}
      </div>

      <div>
        <Link href={`/shops/${shop.id}`} style={{ color: "#b8b9ff", textDecoration: "none", fontWeight: 900 }}>
          Enter Shop -&gt;
        </Link>
      </div>
    </div>
  );
}

export default async function ShopsPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  if (!user) redirect("/login");

  const email = user.email ?? null;
  const isAdmin = isPlatformAdminEmail(email);

  if (isAdmin) {
    const admin = supabaseAdmin();
    const { data: shops, error } = await admin.from("rb_shops").select("id,name,created_at").order("created_at", { ascending: false });

    if (error) {
      return (
        <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>All Shops</h1>
          <GlassCard title="Error">
            <div style={{ opacity: 0.9 }}>{error.message}</div>
          </GlassCard>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>All Shops</h1>
          <Link
            href="/shops/create"
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

        <GlassCard title={`Shops (${(shops ?? []).length})`}>
          <div style={{ display: "grid", gap: 12 }}>
            {(shops ?? []).map((s: any) => (
              <ShopCard key={s.id} shop={s} canDelete />
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  const { data: members, error: memErr } = await supabase
    .from("shop_members")
    .select("shop_id, role, shops:shops(id,name,created_at)")
    .eq("user_id", user.id);

  if (memErr) {
    redirect("/onboarding");
  }

  const shops = (members ?? [])
    .map((m: any) => m.shops)
    .filter(Boolean) as Shop[];

  if (shops.length === 0) {
    redirect("/onboarding");
  }

  if (shops.length === 1) {
    redirect(`/shops/${shops[0].id}`);
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Your Shops</h1>
      <GlassCard title={`Shops (${shops.length})`}>
        <div style={{ display: "grid", gap: 12 }}>
          {shops.map((s) => (
            <ShopCard key={s.id} shop={s} />
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
