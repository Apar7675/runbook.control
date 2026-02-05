import React from "react";
import GlassCard from "@/components/GlassCard";
import { rbListMyShops } from "@/lib/rb";
import { supabaseServer } from "@/lib/supabase/server";

async function savePolicy(formData: FormData) {
  "use server";

  const shopId = String(formData.get("shopId") ?? "").trim();
  const channel = String(formData.get("channel") ?? "stable").trim();
  const min_version_raw = String(formData.get("min_version") ?? "").trim();
  const pinned_version_raw = String(formData.get("pinned_version") ?? "").trim();

  const min_version = min_version_raw ? min_version_raw : null;
  const pinned_version = pinned_version_raw ? pinned_version_raw : null;

  if (!shopId) return;

  const supabase = await supabaseServer();

  // Upsert by unique(shop_id)
  const { error } = await supabase.from("rb_update_policy").upsert(
    {
      shop_id: shopId,
      channel,
      min_version,
      pinned_version,
    },
    { onConflict: "shop_id" }
  );

  if (error) throw new Error(error.message);
}

export default async function UpdatesPage() {
  const shops = await rbListMyShops();
  const supabase = await supabaseServer();

  const { data: policies, error } = await supabase
    .from("rb_update_policy")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const byShop = new Map<string, any>();
  (policies ?? []).forEach((p: any) => byShop.set(p.shop_id, p));

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Updates</h1>

      <GlassCard title="Set Policy (per shop)">
        <form action={savePolicy} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select name="shopId" style={{ padding: 10, borderRadius: 12, minWidth: 260 }}>
            <option value="">Select shop…</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select name="channel" style={{ padding: 10, borderRadius: 12, minWidth: 160 }}>
            <option value="stable">stable</option>
            <option value="beta">beta</option>
          </select>

          <input name="min_version" placeholder="min version (optional)" style={{ padding: 10, borderRadius: 12 }} />
          <input name="pinned_version" placeholder="pinned version (optional)" style={{ padding: 10, borderRadius: 12 }} />

          <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 800 }}>
            Save
          </button>
        </form>
      </GlassCard>

      <GlassCard title="Current Policies">
        {shops.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No shops yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {shops.map((s) => {
              const p = byShop.get(s.id);
              return (
                <div
                  key={s.id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{s.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Channel: <b>{p?.channel ?? "stable"}</b> • Min: {p?.min_version ?? "—"} • Pinned:{" "}
                    {p?.pinned_version ?? "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
