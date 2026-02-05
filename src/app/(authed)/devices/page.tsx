import React from "react";
import GlassCard from "@/components/GlassCard";
import { rbListMyShops, rbGetUserIdOrThrow } from "@/lib/rb";
import { supabaseServer } from "@/lib/supabase/server";
import { newToken, sha256Hex } from "@/lib/crypto";
import RevealSecretModal from "@/components/RevealSecretModal";
import { redirect } from "next/navigation";

function b64Json(obj: any) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

async function createDevice(formData: FormData) {
  "use server";

  const shopId = String(formData.get("shopId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!shopId || !name) redirect("/devices");

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

  const { error: e2 } = await supabase.from("rb_device_activation_tokens").insert({
    shop_id: shopId,
    device_id: device.id,
    token_hash,
    expires_at: expires.toISOString(),
    used_at: null,
  });

  if (e2) throw new Error(e2.message);

  const reveal = b64Json({
    device_id: device.id,
    shop_id: shopId,
    deviceKeyPlain,
    activationPlain,
  });

  redirect(`/devices?reveal=${encodeURIComponent(reveal)}`);
}

export default async function DevicesPage() {
  const shops = await rbListMyShops();
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
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      {/* @ts-expect-error server->client */}
      <RevealSecretModal />

      <h1 style={{ fontSize: 28, margin: 0 }}>Devices</h1>

      <GlassCard title="Register Device">
        <form action={createDevice} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select name="shopId" style={{ padding: 10, borderRadius: 12, minWidth: 260 }}>
            <option value="">Select shop…</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input name="name" placeholder="Device name (e.g. Front Office PC)" style={{ padding: 10, borderRadius: 12, minWidth: 280 }} />

          <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
            Create
          </button>
        </form>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
          After create, you’ll get a one-time modal with Device Key + Activation Token (copy immediately).
        </div>
      </GlassCard>

      <GlassCard title="All Devices">
        {devices.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No devices yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {devices.map((d: any) => {
              const t = tokenByDevice.get(d.id);
              return (
                <div
                  key={d.id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{d.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Shop: {d.shop_id}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Status: {d.status}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Key Hash: <code>{String(d.device_key_hash ?? "").slice(0, 16)}…</code>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Activation: {t?.used_at ? "USED" : t ? "READY" : "—"}{" "}
                    {t ? `(expires ${new Date(t.expires_at).toLocaleString()})` : ""}
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
