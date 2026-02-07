import React from "react";
import GlassCard from "@/components/GlassCard";
import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  const id = String(deviceId ?? "").trim();

  if (!isUuid(id)) {
    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Device</h1>
        <GlassCard title="Invalid Device ID">
          <div style={{ opacity: 0.8 }}>Bad device id received.</div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Received: <code>{id || "(empty)"}</code>
          </div>
          <div style={{ marginTop: 12 }}>
            <Link href="/devices" style={{ textDecoration: "none" }}>
              ← Back to Devices
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const supabase = await supabaseServer();

  const { data: device, error: e1 } = await supabase
    .from("rb_devices")
    .select("*")
    .eq("id", id)
    .single();

  if (e1) throw new Error(e1.message);

  const { data: token } = await supabase
    .from("rb_device_activation_tokens")
    .select("*")
    .eq("device_id", id)
    .maybeSingle();

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Device</h1>

      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <GlassCard title="Device Info">
          <div style={{ display: "grid", gap: 8 }}>
            <div>
              <span style={{ opacity: 0.7 }}>Name:</span>{" "}
              <b>{device.name}</b>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Status:</span>{" "}
              <b>{device.status}</b>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Shop:</span>{" "}
              <code>{device.shop_id}</code>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Device ID:</span>{" "}
              <code>{device.id}</code>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Key Hash:</span>{" "}
              <code>{String(device.device_key_hash ?? "").slice(0, 24)}…</code>
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Activation Token">
          {!token ? (
            <div style={{ opacity: 0.75 }}>No activation token row found.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div>
                <span style={{ opacity: 0.7 }}>Used:</span>{" "}
                <b>{token.used_at ? "YES" : "NO"}</b>
              </div>
              <div>
                <span style={{ opacity: 0.7 }}>Expires:</span>{" "}
                <b>{new Date(token.expires_at).toLocaleString()}</b>
              </div>
              <div>
                <span style={{ opacity: 0.7 }}>Token Hash:</span>{" "}
                <code>{String(token.token_hash).slice(0, 24)}…</code>
              </div>
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
            Plaintext token is only shown once (on creation / regenerate).
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
