// REPLACE ENTIRE FILE: src/app/(authed)/shops/[shopId]/page.tsx

import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import SetupChecklist from "@/components/SetupChecklist";
import { rbGetShop, rbGetUpdatePolicy, rbListShopDevices } from "@/lib/rb";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function savePolicy(formData: FormData) {
  "use server";

  const shopId = String(formData.get("shopId") ?? "").trim();
  const channel = String(formData.get("channel") ?? "stable").trim();
  const min_version_raw = String(formData.get("min_version") ?? "").trim();
  const pinned_version_raw = String(formData.get("pinned_version") ?? "").trim();

  if (!isUuid(shopId)) return;

  const min_version = min_version_raw ? min_version_raw : null;
  const pinned_version = pinned_version_raw ? pinned_version_raw : null;

  const supabase = await supabaseServer();

  const { data: before } = await supabase.from("rb_update_policy").select("*").eq("shop_id", shopId).maybeSingle();

  const { data: after, error } = await supabase
    .from("rb_update_policy")
    .upsert({ shop_id: shopId, channel, min_version, pinned_version }, { onConflict: "shop_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await auditLog({
    shop_id: shopId,
    action: "policy.changed",
    entity_type: "policy",
    entity_id: after.id,
    details: {
      before: before
        ? { channel: before.channel, min_version: before.min_version, pinned_version: before.pinned_version }
        : null,
      after: { channel: after.channel, min_version: after.min_version, pinned_version: after.pinned_version },
    },
  });

  redirect(`/shops/${shopId}`);
}

function TabBar({
  shopId,
  active,
}: {
  shopId: string;
  active: "overview" | "devices" | "admins" | "audit";
}) {
  const item = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: isActive ? "rgba(139,140,255,0.16)" : "rgba(255,255,255,0.04)",
        fontWeight: 900,
        color: "inherit",
        opacity: isActive ? 1 : 0.85,
      }}
    >
      {label}
    </Link>
  );

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {item(`/shops/${shopId}`, "Overview", active === "overview")}
      {item(`/shops/${shopId}/devices`, "Devices", active === "devices")}
      {item(`/shops/${shopId}/members`, "Admins", active === "admins")}
      {item(`/audit?shop=${shopId}`, "Audit", active === "audit")}
    </div>
  );
}

export default async function ShopDetailPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const sid = String(shopId ?? "").trim();

  if (!isUuid(sid)) {
    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Shop</h1>
        <GlassCard title="Invalid Shop ID">
          <Link href="/shops" style={{ textDecoration: "none" }}>
            ← Back to Shops
          </Link>
        </GlassCard>
      </div>
    );
  }

  const shop = await rbGetShop(sid);

  // ✅ IMPORTANT: rbGetShop can now return null (RLS or deleted)
  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Shop</h1>
        <GlassCard title="Not found / no access">
          <div style={{ opacity: 0.85, marginBottom: 10 }}>
            This shop either doesn’t exist anymore or your account doesn’t have access to it.
          </div>
          <Link href="/shops" style={{ textDecoration: "none" }}>
            ← Back to Shops
          </Link>
        </GlassCard>
      </div>
    );
  }

  const devices = await rbListShopDevices(sid);
  const policy = await rbGetUpdatePolicy(sid);

  const supabase = await supabaseServer();
  const { count: adminsCount } = await supabase
    .from("rb_shop_members")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", sid);

  const checklistItems = [
    {
      key: "admins",
      title: "Add admins (optional)",
      done: (adminsCount ?? 0) > 1,
      hint: "Admins can log into RunBook.Control to manage devices, updates, and access.",
      ctaLabel: "Manage Admins",
      ctaHref: `/shops/${shop.id}/members`,
    },
    {
      key: "device",
      title: "Create a device",
      done: devices.length > 0,
      hint: "Devices are PCs/tablets that will check RunBook.Control for updates and policy.",
      ctaLabel: "Create Device",
      ctaHref: `/devices?shop=${shop.id}`,
    },
    {
      key: "policy",
      title: "Set update policy",
      done: !!policy && (policy.channel !== "stable" || policy.min_version || policy.pinned_version),
      hint: "Stable/beta controls what builds devices receive. Pin forces a specific version for this shop.",
      ctaLabel: "Edit Policy",
      ctaHref: `/shops/${shop.id}#policy`,
    },
    {
      key: "audit",
      title: "Verify activity in audit",
      done: true,
      hint: "Audit is your truth log: who changed what, when.",
      ctaLabel: "View Audit",
      ctaHref: `/audit?shop=${shop.id}`,
    },
  ];

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <h1 style={{ fontSize: 34, margin: 0 }}>{shop.name}</h1>
        <TabBar shopId={shop.id} active="overview" />
      </div>

      <SetupChecklist title="Getting Started" subtitle="Follow these steps to bring a shop online safely." items={(checklistItems.map((i:any)=>({...i, done: !!i.done})) as any)} />

      <GlassCard title="Quick Actions">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href={`/devices?shop=${shop.id}`}
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
              fontWeight: 900,
              color: "inherit",
            }}
          >
            + Create Device
          </Link>

          <Link
            href={`/shops/${shop.id}/devices`}
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
              fontWeight: 900,
              color: "inherit",
            }}
          >
            View Devices
          </Link>

          <Link
            href={`/shops/${shop.id}/members`}
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
              fontWeight: 900,
              color: "inherit",
            }}
          >
            Manage Admins
          </Link>

          <Link
            href={`/audit?shop=${shop.id}`}
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
              fontWeight: 900,
              color: "inherit",
            }}
          >
            View Audit
          </Link>
        </div>
      </GlassCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <GlassCard title="Shop Info">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Shop ID</div>
          <div style={{ fontWeight: 800 }}>{shop.id}</div>

          <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: 13, opacity: 0.8 }}>
            <div>
              Admins: <b>{adminsCount ?? 0}</b>
            </div>
            <div>
              Devices: <b>{devices.length}</b>
            </div>
            <div title="Stable is safer, Beta is faster moving.">
              Channel: <b>{policy?.channel ?? "stable"}</b>
            </div>
          </div>
        </GlassCard>

        <div id="policy" />
        <GlassCard title="Update Policy (simple)">
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
            <b>Stable</b> = production releases. <b>Beta</b> = early access. <b>Pinned</b> forces an exact version.
          </div>

          <form action={savePolicy} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="shopId" value={shop.id} />

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Channel</span>
              <select name="channel" defaultValue={policy?.channel ?? "stable"} style={{ padding: 10, borderRadius: 12 }}>
                <option value="stable">stable</option>
                <option value="beta">beta</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Min version (optional)</span>
              <input
                name="min_version"
                defaultValue={policy?.min_version ?? ""}
                placeholder="e.g. 1.0.0"
                style={{ padding: 10, borderRadius: 12 }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Pinned version (optional)</span>
              <input
                name="pinned_version"
                defaultValue={policy?.pinned_version ?? ""}
                placeholder="e.g. 1.2.3"
                style={{ padding: 10, borderRadius: 12 }}
              />
            </label>

            <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
              Save Policy
            </button>
          </form>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
            Every save writes an Audit entry showing before/after.
          </div>
        </GlassCard>

        <GlassCard title="Devices (quick view)">
          {devices.length === 0 ? (
            <div style={{ opacity: 0.75 }}>
              No devices yet. Use <b>Create Device</b> above.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {devices.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>{d.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>Status: {d.status}</div>
                  </div>
                  <Link href={`/devices/${d.id}`} style={{ textDecoration: "none", opacity: 0.9 }}>
                    Details →
                  </Link>
                </div>
              ))}

              {devices.length > 5 ? (
                <Link href={`/shops/${shop.id}/devices`} style={{ textDecoration: "none", opacity: 0.85 }}>
                  View all devices →
                </Link>
              ) : null}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
