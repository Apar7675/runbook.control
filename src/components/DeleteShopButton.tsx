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
    const typed = window.prompt(
      `Type the EXACT shop name to permanently delete:\n\n"${shopName}"\n\nThis deletes members/devices/policies/bundles/audit for this shop.`,
      ""
    );

    if (typed !== shopName) return;

    setBusy(true);
    try {
      const res = await fetch("/api/shops/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, confirmName: typed }),
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
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        cursor: busy ? "not-allowed" : "pointer",
      }}
      title="Delete shop"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
