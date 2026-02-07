"use client";

import React from "react";

export default function NoviceModeToggle({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = React.useState(initialOn);
  const [busy, setBusy] = React.useState(false);

  async function setPref(nextOn: boolean) {
    setBusy(true);
    try {
      // novice on => dismissed = false
      const novice_dismissed = !nextOn;

      const res = await fetch("/api/user/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novice_dismissed }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        alert(j.error ?? "Failed to update preference");
        return;
      }

      setOn(nextOn);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div>
        <div style={{ fontWeight: 900 }}>Novice Mode</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          Shows the “Getting Started” checklist on Dashboard and Shop pages.
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => setPref(!on)}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          fontWeight: 900,
          border: "1px solid rgba(255,255,255,0.14)",
          background: on ? "rgba(139,140,255,0.18)" : "rgba(255,255,255,0.05)",
          cursor: busy ? "not-allowed" : "pointer",
          minWidth: 120,
        }}
        title="Toggle novice mode"
      >
        {busy ? "Saving…" : on ? "ON" : "OFF"}
      </button>
    </div>
  );
}
