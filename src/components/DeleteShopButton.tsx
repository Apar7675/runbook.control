"use client";

import React from "react";

export default function DeleteShopButton({
  shopId,
  shopName,
}: {
  shopId: string;
  shopName: string;
}) {
  const [busy, setBusy] = React.useState(false);

  async function onDelete() {
    const ok = window.confirm(`Delete shop "${shopName}" now? This cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch("/api/shops/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, confirmName: shopName }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        alert(j.error ?? "Delete failed");
        return;
      }

      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onDelete}
      style={{
        padding: "8px 12px",
        borderRadius: 12,
        fontWeight: 900,
        border: "1px solid rgba(255,120,120,0.22)",
        background: "rgba(120,24,24,0.35)",
        color: "#ffd6d6",
        cursor: busy ? "not-allowed" : "pointer",
      }}
      title="Delete shop"
    >
      {busy ? "Deleting..." : "Delete Shop"}
    </button>
  );
}
