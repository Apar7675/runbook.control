"use client";

import React from "react";

type DeleteMode = "hard_delete" | "test_reset";

export default function DeleteShopButton({
  shopId,
  shopName,
}: {
  shopId: string;
  shopName: string;
}) {
  const [busy, setBusy] = React.useState(false);

  async function onDelete() {
    const confirmation = window.prompt(
      `Type the exact shop name to continue.\n\nShop: ${shopName}\n\nThis permanently removes the shop from Control authority.`
    );

    if (confirmation === null) return;

    if (confirmation.trim() !== shopName) {
      window.alert("The confirmation name did not match. No changes were made.");
      return;
    }

    const useTestReset = window.confirm(
      "Enable test reset mode?\n\nChoose OK to also clear bounded onboarding and reset residue for this shop.\n\nChoose Cancel for a production hard delete that preserves auth users."
    );

    const mode: DeleteMode = useTestReset ? "test_reset" : "hard_delete";
    const finalOk = window.confirm(
      mode === "test_reset"
        ? `Test reset ${shopName} now? This permanently deletes the shop, its shop-owned data, reset-safe onboarding residue, and can remove orphaned auth users.`
        : `Delete ${shopName} now? This permanently deletes the shop and its shop-owned data while preserving auth users.`
    );

    if (!finalOk) return;

    setBusy(true);
    try {
      const res = await fetch("/api/shops/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, confirmName: shopName, mode }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) {
        window.alert(payload.error ?? "Delete failed");
        return;
      }

      if (payload.summary?.mode === "test_reset") {
        window.alert(`Test reset finished for ${shopName}.`);
      }

      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" disabled={busy} onClick={onDelete} className="rb-button rb-button--danger" title="Delete or test-reset shop">
      {busy ? "Applying..." : "Delete / Reset"}
    </button>
  );
}
