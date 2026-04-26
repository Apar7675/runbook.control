"use client";

import React from "react";
import GlassCard from "@/components/GlassCard";
import { ControlButton, ControlInput } from "@/components/control/ui";
import DeleteOperationStatusCard from "@/components/shops/DeleteOperationStatusCard";
import { safeFetch } from "@/lib/http/safeFetch";
import { theme } from "@/lib/ui/theme";

type DeleteResponse = {
  ok?: boolean;
  error?: string;
  operation?: { id?: string; status?: string };
};

export default function ShopDangerZone({
  shopId,
  shopName,
}: {
  shopId: string;
  shopName: string;
}) {
  const [confirmName, setConfirmName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [refreshToken, setRefreshToken] = React.useState(0);

  async function deleteShop() {
    setStatus("");

    if (confirmName.trim() !== shopName) {
      setStatus(`Type "${shopName}" exactly to continue.`);
      return;
    }

    setBusy(true);
    const response = await safeFetch<DeleteResponse>("/api/shops/delete", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shopId, confirmName }),
    });

    if (!response.ok || !response.data?.ok) {
      setStatus(response.ok ? response.data?.error ?? "Delete failed." : `${response.status}: ${response.error}`);
      setBusy(false);
      setRefreshToken((value) => value + 1);
      return;
    }

    setStatus("Delete accepted. Live operation status is shown below until the orchestration finishes.");
    setBusy(false);
    setRefreshToken((value) => value + 1);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <GlassCard
        title="Shop Danger Zone"
        subtitle="Dangerous actions stay isolated from normal user management. Delete requests go through the authoritative server orchestration and are tracked live below."
        tone="critical"
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 1.58 }}>
            To delete this shop, type the shop name exactly. This will disable devices, run storage cleanup, track the operation in Control, and continue through the server-side delete workflow.
          </div>

          <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
            <div style={{ color: theme.text.quiet, fontSize: 10.5, fontWeight: 900, letterSpacing: 0.82, textTransform: "uppercase" }}>
              Confirm Shop Name
            </div>
            <ControlInput
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={shopName}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ControlButton tone="danger" onClick={deleteShop} disabled={busy}>
              {busy ? "Starting Delete..." : "Delete Shop"}
            </ControlButton>
          </div>

          {status ? <div style={{ color: theme.text.secondary, fontSize: 12.5, lineHeight: 1.55 }}>{status}</div> : null}
        </div>
      </GlassCard>

      <DeleteOperationStatusCard shopId={shopId} refreshToken={refreshToken} />
    </div>
  );
}
