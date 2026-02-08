import React from "react";
import GlassCard from "@/components/GlassCard";
import { rbGetShop } from "@/lib/rb";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
};

type ShopAdminRow = {
  id: string;
  shop_id: string;
  user_id: string;
  email: string | null;
  created_at: string;
};

export default async function ShopMembersPage({ params }: Props) {
  const { shopId } = await params;

  const shop = await rbGetShop(shopId);

  // rbGetShop returns null if shop doesn't exist OR is not visible via RLS
  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Admins</h1>

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

  // NOTE:
  // This page manages Control-plane admins for a shop. If your schema differs,
  // adjust table/columns below to match your actual members/admin table.
  const admin = supabaseAdmin();

  // Try common table names in RunBook.Control. Prefer rb_shop_admins if it exists.
  // If your project uses a different table, change it here.
  let admins: ShopAdminRow[] = [];
  let tableTried: string[] = [];

  // Attempt 1: rb_shop_admins
  tableTried.push("rb_shop_admins");
  const a1 = await admin
    .from("rb_shop_admins")
    .select("id,shop_id,user_id,email,created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  if (!a1.error) {
    admins = (a1.data ?? []) as any;
  } else {
    // Attempt 2: rb_shop_members (fallback)
    tableTried.push("rb_shop_members");
    const a2 = await admin
      .from("rb_shop_members")
      .select("id,shop_id,user_id,email,created_at")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false });

    if (!a2.error) {
      admins = (a2.data ?? []) as any;
    } else {
      // If both failed, show an error card with details.
      return (
        <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <h1 style={{ fontSize: 28, margin: 0 }}>Admins — {shop.name}</h1>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              <b>Admins</b> are users who can log into RunBook.Control to manage devices, updates, and access.
              <br />
              If you intended shop employees, those should NOT be here.
            </div>
          </div>

          <GlassCard title="Config error">
            <div style={{ opacity: 0.85 }}>
              Could not load admins for this shop. Checked tables:
              <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 12, opacity: 0.9 }}>
                {tableTried.join(", ")}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                rb_shop_admins error: {String(a1.error?.message ?? a1.error)}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                rb_shop_members error: {String(a2.error?.message ?? a2.error)}
              </div>
            </div>
          </GlassCard>
        </div>
      );
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Admins — {shop.name}</h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          <b>Admins</b> are users who can log into RunBook.Control to manage devices, updates, and access.
          <br />
          (Shop employees should NOT use RunBook.Control.)
        </div>
      </div>

      <GlassCard title={`Admins (${admins.length})`}>
        {admins.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No admins assigned.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {admins.map((a) => (
              <div
                key={a.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 900 }}>{a.email ?? a.user_id}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  user_id: {a.user_id}
                </div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  created: {a.created_at ? new Date(a.created_at).toISOString() : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
