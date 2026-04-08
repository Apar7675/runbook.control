"use client";

import React from "react";

export default function NoviceModeToggle({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = React.useState(initialOn);
  const [busy, setBusy] = React.useState(false);

  async function setPref(nextOn: boolean) {
    setBusy(true);
    try {
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
    <div className="rb-sectionSurface">
      <div className="rb-rowBetween" style={{ alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900 }}>Novice Mode</div>
          <div className="rb-fine" style={{ marginTop: 4 }}>
            Shows the "Getting Started" checklist on Dashboard and Shop pages.
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => setPref(!on)}
          className={on ? "rb-button rb-button--primary" : "rb-button rb-button--ghost"}
          title="Toggle novice mode"
        >
          {busy ? "Saving..." : on ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
