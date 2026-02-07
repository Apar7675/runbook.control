import React from "react";
import GlassCard from "@/components/GlassCard";
import RevealSecretModal from "@/components/RevealSecretModal";
import DeviceActionsTableClient from "@/components/DeviceActionsTableClient";
import { rbListMyShops, rbGetUserIdOrThrow } from "@/lib/rb";
import { supabaseServer } from "@/lib/supabase/server";
import { newToken, sha256Hex } from "@/lib/crypto";
import { redirect } from "next/navigation";

function b64Json(obj: any) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function createDevice(formData: FormData) {
  "use server";

  const shopId = String(formData.get("shopId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!isUuid(shopId) || !name) redirect("/devices");

  const supabase = await supabaseServer();
  await rbGetUserIdOrThrow();

  const deviceKeyPlain = newToken("devkey");
  const device_key_hash = sha256Hex(deviceKeyPlain);

  const { data: device, error: e1 } = await supabase
    .from("rb_devices")
    .insert({
      shop_id: shopId,
      name,
      device_key: null,
      device_key_hash,
      status: "active",
    })
    .select("*")
    .single();

  if (e1) throw new Error(e1.message);

  const activationPlain = newToken("activate");
  const token_hash = sha256Hex(activationPlain);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  const { error: e2 } = await supabase.from("rb_device_activation_tokens").upsert(
    {
      shop_id: shopId,
      device_id: device.id,
      token_hash,
      expires_at: expires.toISOString(),
      used_at: null,
    },
    { onConflict: "device_id" }
  );

  if (e2) throw new Error(e2.message);

  const reveal = b64Json({
    device_id: device.id,
    shop_id: shopId,
    deviceKeyPlain,
    activationPlain,
  });

  redirect(`/devices?shop=${encodeURIComponent(shopId)}&reveal=${encodeURIComponent(reveal)}`);
}

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: { shop?: string };
}) {
  const shops = await rbListMyShops();
  const preselect = isUuid(String(searchParams.shop ?? "")) ? String(searchParams.shop) : "";

  const supabase = await supabaseServer();

  const { data: devices, error } = await supabase
    .from("rb_devices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const { data: tokens } = await supabase
    .from("rb_device_activation_tokens")
    .select("*")
    .order("created_at", { ascending: false });

  const tokenByDevice = new Map<string, any>();
  (tokens ?? []).forEach((t: any) => tokenByDevice.set(t.device_id, t));

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      {/* @ts-expect-error server->client */}
      <RevealSecretModal />

      <h1 style={{ fontSize: 28, margin: 0 }}>Devices</h1>

      <GlassCard title="Register Device">
        <form action={createDevice} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            name="shopId"
            defaultValue={preselect}
            style={{ padding: 10, borderRadius: 12, minWidth: 260 }}
          >
            <option value="">Select shop…</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            name="name"
            placeholder="Device name (e.g. Front Office PC)"
            style={{ padding: 10, borderRadius: 12, minWidth: 280 }}
          />

          <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
            Create
          </button>
        </form>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
          After create, you’ll get a one-time modal with Device Key + Activation Token (copy immediately).
        </div>
      </GlassCard>

      <GlassCard title="All Devices">
        <DeviceActionsTableClient devices={devices ?? []} tokenByDevice={Array.from(tokenByDevice.entries())} />
      </GlassCard>
    </div>
  );
}
