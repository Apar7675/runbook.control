"use client";

import React, { useEffect, useMemo, useState } from "react";
import SetupLaunchButton from "@/components/onboarding/SetupLaunchButton";
import { RunbookButton, RunbookCard, RunbookStatusIndicator } from "@/components/runbook/primitives";
import { runbookTheme } from "@/lib/ui/runbookTheme";

type SetupStatusPayload = {
  ok: true;
  employee_count: number;
  workstation_count: number;
  onboarding_state: {
    shop_id: string | null;
  } | null;
  validation_result: {
    valid: boolean;
    reason: "OK" | "STALE_COMPLETION";
  };
  billing_access_ok: boolean;
  system_ready: boolean;
  can_launch: boolean;
  reasons: string[];
  shop_id: string | null;
  resolved_step: string;
};

type SetupStatusClientProps = {
  initialStatus: SetupStatusPayload;
};

function StepRow({
  title,
  complete,
  detail,
  href,
  actionLabel,
}: {
  title: string;
  complete: boolean;
  detail: string;
  href: string;
  actionLabel: string;
}) {
  const statusTone = complete ? "success" : title === "System Readiness" ? "warning" : "danger";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <RunbookStatusIndicator status={complete ? "complete" : "incomplete"} tone={statusTone} label={complete ? "Complete" : "Pending"} />
          <div style={{ color: runbookTheme.colors.text, fontSize: 14, fontWeight: 600 }}>{title}</div>
        </div>
        <div style={{ color: runbookTheme.colors.muted, fontSize: 12, lineHeight: 1.5 }}>{detail}</div>
      </div>
      <RunbookButton href={href} tone="ghost">
        {actionLabel}
      </RunbookButton>
    </div>
  );
}

export default function SetupStatusClient({ initialStatus }: SetupStatusClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");

  async function refreshStatus() {
    const res = await fetch("/api/onboarding/setup-status", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as SetupStatusPayload | { ok?: false; error?: string } | null;
    if (!res.ok || !data || (data as any).ok !== true) {
      setMessage((data as any)?.error ?? "We could not re-check setup status.");
      return;
    }

    setMessage("");
    setStatus(data as SetupStatusPayload);
  }

  useEffect(() => {
    function handleFocus() {
      refreshStatus();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        refreshStatus();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const returnTo = encodeURIComponent("/onboarding/setup");
  const peopleHref = status.shop_id
    ? `/people?shop=${encodeURIComponent(status.shop_id)}&return_to=${returnTo}`
    : `/people?return_to=${returnTo}`;
  const devicesHref = status.shop_id ? `/shops/${status.shop_id}/devices?return_to=${returnTo}` : `/devices?return_to=${returnTo}`;
  const billingHref = status.shop_id ? `/shops/${status.shop_id}/billing?return_to=${returnTo}` : `/billing-access?return_to=${returnTo}`;

  const steps = useMemo(
    () => [
      {
        title: "Add Team Members (Optional)",
        complete: status.employee_count >= 1,
        detail:
          status.employee_count >= 1
            ? `${Math.max(status.employee_count - 1, 0)} additional team member${Math.max(status.employee_count - 1, 0) === 1 ? "" : "s"} added`
            : "Your admin employee will be created automatically. Add more team members any time.",
        href: peopleHref,
        actionLabel: "Open People",
      },
      {
        title: "Optional: Register Workstation",
        complete: status.workstation_count >= 1,
        detail:
          status.workstation_count >= 1
            ? `${status.workstation_count} workstation${status.workstation_count === 1 ? "" : "s"} registered`
            : "No workstation registered yet. You can finish onboarding and come back to this later.",
        href: devicesHref,
        actionLabel: "Open Devices",
      },
      {
        title: "System Readiness",
        complete: status.system_ready,
        detail: status.system_ready
          ? "Billing and access ready"
          : status.validation_result.reason === "STALE_COMPLETION"
          ? "System not ready - onboarding state needs recovery"
          : !status.billing_access_ok
          ? "System not ready - billing or access needs review"
          : "System not ready",
        href: billingHref,
        actionLabel: "Review Billing & Access",
      },
    ],
    [billingHref, devicesHref, peopleHref, status.billing_access_ok, status.employee_count, status.system_ready, status.validation_result.valid, status.workstation_count]
  );
  return (
    <RunbookCard
      title="Finish setup"
      subtitle="Complete this final checklist to open your shops."
      tone="default"
    >
      <div style={{ display: "grid", gap: 0 }}>
        {steps.map((step, index) => (
          <div key={step.title} style={index === steps.length - 1 ? { borderBottom: "none" } : undefined}>
            <StepRow
              title={step.title}
              complete={step.complete}
              detail={step.detail}
              href={step.href}
              actionLabel={step.actionLabel}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          marginTop: 10,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {!status.can_launch ? (
          <div style={{ color: runbookTheme.colors.muted, fontSize: 12, lineHeight: 1.5 }}>
            {status.reasons[0] ?? "Finish the remaining setup items to continue."}
          </div>
        ) : (
          <div style={{ color: runbookTheme.colors.muted, fontSize: 12, lineHeight: 1.5 }}>
            Everything is in place. Open your shops when you&apos;re ready.
          </div>
        )}

        {message ? <div style={{ color: runbookTheme.colors.muted2, fontSize: 11, lineHeight: 1.45 }}>{message}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <SetupLaunchButton disabled={!status.can_launch} />
        </div>
      </div>
    </RunbookCard>
  );
}
