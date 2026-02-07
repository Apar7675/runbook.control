"use client";

import React from "react";

export default function DismissNoviceButton() {
  const [busy, setBusy] = React.useState(false);

  async function dismiss() {
    setBusy(true);
    try {
      const res = await fetch("/api/user/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novice_dismissed: true }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        alert(j.error ?? "Failed to dismiss");
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
      onClick={dismiss}
      style={{
        padding: "8px 12px",
        borderRadius: 12,
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.05)",
        cursor: busy ? "not-allowed" : "pointer",
      }}
      title="Hide Getting Started"
    >
      {busy ? "Saving…" : "Dismiss"}
    </button>
  );
}
