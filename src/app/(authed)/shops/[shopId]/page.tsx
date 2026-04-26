import React from "react";
import { ActionLink, EmptyState } from "@/components/control/ui";
import ShopWorkspaceShellV2 from "@/components/shops/v2/ShopWorkspaceShellV2";
import type { ShopWorkspaceTabKeyV2 } from "@/components/shops/v2/ShopTabBarV2";
import type { ShopDeviceRowV2 } from "@/components/shops/v2/DevicesTabV2";
import { getShopSnapshot, getViewerContext, selectPrimaryShop } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeTab(input: string | string[] | undefined): ShopWorkspaceTabKeyV2 {
  const value = typeof input === "string" ? input : "";
  if (value === "users" || value === "billing" || value === "devices" || value === "activity") {
    return value;
  }
  return "overview";
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function isoOrNull(value: unknown) {
  const text = asText(value);
  return text || null;
}

async function loadShopDeviceRows(shopId: string): Promise<ShopDeviceRowV2[]> {
  const admin = supabaseAdmin();
  const { data: devices, error } = await admin
    .from("rb_devices")
    .select("id,name,status,created_at,last_seen_at,device_type")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const ids = (devices ?? []).map((device: any) => String(device.id)).filter(Boolean);
  let tokenRows: any[] = [];
  if (ids.length > 0) {
    const { data } = await admin
      .from("rb_device_tokens")
      .select("device_id,last_seen_at,revoked_at")
      .in("device_id", ids);
    tokenRows = data ?? [];
  }

  const tokenLastSeen = new Map<string, string>();
  for (const token of tokenRows) {
    if (token.revoked_at) continue;
    const deviceId = asText(token.device_id);
    const ts = asText(token.last_seen_at);
    if (!deviceId || !ts) continue;
    const existing = tokenLastSeen.get(deviceId);
    if (!existing || ts > existing) tokenLastSeen.set(deviceId, ts);
  }

  return (devices ?? []).map((device: any) => {
    const directSeen = isoOrNull(device.last_seen_at);
    const tokenSeen = tokenLastSeen.get(asText(device.id)) ?? null;
    const mergedSeen = tokenSeen && directSeen ? (tokenSeen > directSeen ? tokenSeen : directSeen) : tokenSeen ?? directSeen;
    return {
      id: asText(device.id),
      name: asText(device.name) || null,
      status: isoOrNull(device.status),
      device_type: isoOrNull(device.device_type),
      created_at: isoOrNull(device.created_at),
      last_seen_at: mergedSeen,
    };
  });
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { shopId } = await params;
  const query = (await searchParams) ?? {};
  const activeTab = normalizeTab(query.tab);
  const context = await getViewerContext();
  const shop = selectPrimaryShop(context.shops, shopId);

  if (!shop) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <EmptyState title="Shop not available" description="Return to the shop list and choose a different workspace." action={<ActionLink href="/shops" tone="primary">Back to Shops</ActionLink>} />
      </div>
    );
  }

  const [snapshot, deviceRows] = await Promise.all([getShopSnapshot(shop), loadShopDeviceRows(shop.id)]);

  return <ShopWorkspaceShellV2 snapshot={snapshot} activeTab={activeTab} isPlatformAdmin={context.isPlatformAdmin} deviceRows={deviceRows} />;
}
