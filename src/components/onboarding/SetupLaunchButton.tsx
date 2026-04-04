"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { RunbookButton } from "@/components/runbook/primitives";
import { runbookTheme } from "@/lib/ui/runbookTheme";

export default function SetupLaunchButton({
  disabled,
}: {
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");

  async function launch() {
    if (disabled) {
      setStatus("Finish the required setup checks before launching into the dashboard.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setStatus(data?.error ?? "We could not complete onboarding.");
        return;
      }

      router.push(data?.redirect_to ?? "/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <RunbookButton
        onClick={launch}
        disabled={busy || disabled}
        tone="primary"
        style={{ width: "fit-content", minWidth: 208, justifySelf: "end" }}
      >
        {busy ? "Launching..." : "Launch Into Dashboard"}
      </RunbookButton>
      {status ? (
        <div style={{ color: runbookTheme.colors.muted, ...runbookTheme.type.body }}>
          {status}
        </div>
      ) : null}
    </div>
  );
}
