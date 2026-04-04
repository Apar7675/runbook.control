import React from "react";
import { redirect } from "next/navigation";
import SetupStatusClient from "@/components/onboarding/SetupStatusClient";
import { RunbookContainer, RunbookSectionHeader } from "@/components/runbook/primitives";
import { runbookTheme } from "@/lib/ui/runbookTheme";
import { loadSetupStatus, requireOnboardingRouteForCurrentUser } from "@/lib/onboarding/flow";

export const dynamic = "force-dynamic";

export default async function OnboardingSetupPage() {
  const { state, redirectTo } = await requireOnboardingRouteForCurrentUser("/onboarding/setup");
  if (redirectTo) redirect(redirectTo);

  const status = await loadSetupStatus(state?.shop_id ?? null);

  return (
    <RunbookContainer maxWidth={760}>
      <RunbookSectionHeader
        eyebrow="Welcome to RunBook"
        title="Finish setup"
        subtitle="You are on the final step. Add your first employee, register a workstation, and confirm the system is ready before launching into the dashboard."
        actions={
          <>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 28,
                padding: "6px 10px",
                borderRadius: 14,
                border: "1px solid rgba(126,171,217,0.26)",
                background: "rgba(17,27,40,0.78)",
                color: runbookTheme.colors.info,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Premium Setup
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 28,
                padding: "6px 10px",
                borderRadius: 14,
                border: "1px solid rgba(226,174,88,0.24)",
                background: "rgba(34,27,18,0.78)",
                color: runbookTheme.colors.warning,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Trial
            </span>
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 18,
          border: runbookTheme.border.panel,
          background: "linear-gradient(180deg, rgba(13,21,33,0.74), rgba(10,18,32,0.76))",
          boxShadow: runbookTheme.shadow.floating,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {[
            { label: "Account", complete: true, current: false },
            { label: "Shop", complete: true, current: false },
            { label: "Finish", complete: false, current: true },
          ].map((step, index) => (
            <div
              key={step.label}
              style={{
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: step.current ? "1px solid rgba(126,171,217,0.42)" : step.complete ? "1px solid rgba(86,199,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                    background: step.current
                      ? "rgba(27,48,79,0.92)"
                      : step.complete
                      ? "rgba(26,67,48,0.82)"
                      : "rgba(20,28,40,0.78)",
                    color: step.current ? "#F5F8FD" : step.complete ? runbookTheme.colors.success : runbookTheme.colors.muted2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ color: step.current ? runbookTheme.colors.text : runbookTheme.colors.muted, fontSize: 11, fontWeight: step.current ? 700 : 600 }}>
                  Step {index + 1}
                </div>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 999,
                  background: step.current
                    ? runbookTheme.gradients.focusBar
                    : step.complete
                    ? "linear-gradient(180deg, rgba(86,199,140,0.78), rgba(63,155,108,0.78))"
                    : "rgba(255,255,255,0.08)",
                }}
              />
              <div style={{ color: step.current ? runbookTheme.colors.text : runbookTheme.colors.muted2, fontSize: 12, fontWeight: step.current ? 700 : 600 }}>
                {step.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 18,
            border: runbookTheme.border.panel,
            background: "linear-gradient(180deg, rgba(13,21,33,0.76), rgba(10,18,32,0.78))",
            boxShadow: runbookTheme.shadow.floating,
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ color: runbookTheme.colors.text, fontSize: 14, fontWeight: 600 }}>What&apos;s next</div>
            <div style={{ color: runbookTheme.colors.muted2, fontSize: 10.5, lineHeight: 1.45 }}>
              This final step confirms the shop is ready for daily use.
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {[
              "Add your first employee record",
              "Register the first workstation for the shop",
              "Confirm access and readiness before launch",
            ].map((item) => (
              <div key={item} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    marginTop: 5,
                    background: runbookTheme.colors.info,
                    boxShadow: "0 0 8px rgba(126,171,217,0.22)",
                  }}
                />
                <div style={{ color: runbookTheme.colors.muted, fontSize: 12, lineHeight: 1.5 }}>{item}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ color: runbookTheme.colors.text, fontSize: 14, fontWeight: 600 }}>What you&apos;ll enter</div>
            <div style={{ color: runbookTheme.colors.muted, fontSize: 12, lineHeight: 1.5 }}>
              You&apos;ll enter the first employee and workstation details in the next screens, then return here to launch.
            </div>
          </div>
        </div>

        <SetupStatusClient
          initialStatus={{
            ok: true,
            employee_count: status.employee_count,
            workstation_count: status.workstation_count,
            onboarding_state: status.onboarding_state,
            validation_result: status.validation_result,
            billing_access_ok: status.billing_access_ok,
            system_ready: status.system_ready,
            can_launch: status.can_launch,
            reasons: status.reasons,
            shop_id: status.shopId,
            resolved_step: "/onboarding/setup",
          }}
        />
      </div>
    </RunbookContainer>
  );
}
