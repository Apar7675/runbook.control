"use client";

import React from "react";
import GlassCard from "@/components/GlassCard";
import { ControlButton, ControlInput, ControlSelect, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { formatDateTime } from "@/lib/ui/dates";
import { theme } from "@/lib/ui/theme";

type BillingSnapshot = {
  shop: {
    trial_ends_at?: string | null;
    grace_ends_at?: string | null;
    manual_billing_status?: string | null;
    entitlement_override?: string | null;
    manual_billing_override?: boolean | null;
  };
  access: {
    display_status: string;
  };
};

type AccessActionPayload =
  | { action: "extend_trial"; days: number; note: string }
  | { action: "extend_grace"; days: number; note: string }
  | { action: "set_entitlement_override"; override: "allow" | "restricted" | null; note: string }
  | { action: "clear_overrides"; note: string };

function previewDate(existingIso: string | null | undefined, days: number) {
  const now = Date.now();
  const existingMs = existingIso ? Date.parse(existingIso) : Number.NaN;
  const baseline = Number.isFinite(existingMs) && existingMs > now ? existingMs : now;
  const next = new Date(baseline + days * 24 * 60 * 60 * 1000).toISOString();
  return formatDateTime(next);
}

export default function BillingAccessOverrideCard({
  snapshot,
  busy,
  message,
  onAction,
}: {
  snapshot: BillingSnapshot | null;
  busy: boolean;
  message: string;
  onAction: (payload: AccessActionPayload) => Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [customTrialDays, setCustomTrialDays] = React.useState("14");
  const [customGraceDays, setCustomGraceDays] = React.useState("7");
  const [overrideValue, setOverrideValue] = React.useState("normal");

  React.useEffect(() => {
    setOverrideValue(snapshot?.shop.entitlement_override ?? "normal");
  }, [snapshot?.shop.entitlement_override]);

  const noteReady = note.trim().length > 0;
  const currentTrialEndsAt = snapshot?.shop.trial_ends_at ?? null;
  const currentGraceEndsAt = snapshot?.shop.grace_ends_at ?? null;
  const customTrialDaysNumber = Number.parseInt(customTrialDays, 10);
  const customGraceDaysNumber = Number.parseInt(customGraceDays, 10);

  return (
    <GlassCard
      title="Access / Entitlement Overrides"
      subtitle="These actions change Control access only. They do not pause, resume, or reprice Stripe subscriptions."
      tone="warning"
    >
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge label={snapshot?.access.display_status ?? "Loading"} tone={toneFromStatus(snapshot?.access.display_status ?? "warning")} />
          <StatusBadge
            label={snapshot?.shop.manual_billing_override ? `manual ${snapshot.shop.manual_billing_status ?? "override"}` : "manual override off"}
            tone={snapshot?.shop.manual_billing_override ? "warning" : "neutral"}
          />
          <StatusBadge
            label={snapshot?.shop.entitlement_override ? `entitlement ${snapshot.shop.entitlement_override}` : "normal entitlement logic"}
            tone={snapshot?.shop.entitlement_override ? "warning" : "neutral"}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, color: theme.text.secondary }}>Operator note</div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Why are you extending access or changing the override?"
            style={{
              width: "100%",
              borderRadius: theme.radius.md,
              border: theme.border.accentSoft,
              background: theme.bg.panelInset,
              color: theme.text.primary,
              padding: "12px 14px",
              resize: "vertical",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 24px rgba(0,0,0,0.18)",
            }}
          />
          <div style={{ fontSize: 12, color: theme.text.quiet }}>
            Notes are required so audit history explains why the access change happened.
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Extend access window</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 10, padding: 14, borderRadius: 18, border: theme.border.muted, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 12, color: theme.text.secondary }}>Current trial end</div>
              <div style={{ fontWeight: 800 }}>{currentTrialEndsAt ? formatDateTime(currentTrialEndsAt) : "Not set"}</div>
              <div style={{ fontSize: 12, color: theme.text.quiet }}>+30 days would move access to {previewDate(currentTrialEndsAt, 30)}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ControlButton onClick={() => void onAction({ action: "extend_trial", days: 30, note: note.trim() })} disabled={busy || !noteReady}>
                  {busy ? "Working..." : "Extend 30 Days"}
                </ControlButton>
                <ControlButton onClick={() => void onAction({ action: "extend_trial", days: 60, note: note.trim() })} disabled={busy || !noteReady}>
                  {busy ? "Working..." : "Extend 60 Days"}
                </ControlButton>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, padding: 14, borderRadius: 18, border: theme.border.muted, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 12, color: theme.text.secondary }}>Custom trial extension</div>
              <ControlInput
                type="number"
                min="1"
                max="3650"
                value={customTrialDays}
                onChange={(event) => setCustomTrialDays(event.target.value)}
              />
              <div style={{ fontSize: 12, color: theme.text.quiet }}>
                {Number.isFinite(customTrialDaysNumber) && customTrialDaysNumber > 0
                  ? `${customTrialDaysNumber} days would move access to ${previewDate(currentTrialEndsAt, customTrialDaysNumber)}`
                  : "Enter a valid number of days."}
              </div>
              <ControlButton
                onClick={() => void onAction({ action: "extend_trial", days: customTrialDaysNumber, note: note.trim() })}
                disabled={busy || !noteReady || !Number.isFinite(customTrialDaysNumber) || customTrialDaysNumber < 1}
              >
                {busy ? "Working..." : "Apply Custom Trial Extension"}
              </ControlButton>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Grace and manual allow / restrict behavior</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 10, padding: 14, borderRadius: 18, border: theme.border.muted, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 12, color: theme.text.secondary }}>Current grace end</div>
              <div style={{ fontWeight: 800 }}>{currentGraceEndsAt ? formatDateTime(currentGraceEndsAt) : "Not set"}</div>
              <ControlInput
                type="number"
                min="1"
                max="3650"
                value={customGraceDays}
                onChange={(event) => setCustomGraceDays(event.target.value)}
              />
              <div style={{ fontSize: 12, color: theme.text.quiet }}>
                {Number.isFinite(customGraceDaysNumber) && customGraceDaysNumber > 0
                  ? `${customGraceDaysNumber} days would move grace to ${previewDate(currentGraceEndsAt, customGraceDaysNumber)}`
                  : "Enter a valid number of days."}
              </div>
              <ControlButton
                onClick={() => void onAction({ action: "extend_grace", days: customGraceDaysNumber, note: note.trim() })}
                disabled={busy || !noteReady || !Number.isFinite(customGraceDaysNumber) || customGraceDaysNumber < 1}
              >
                {busy ? "Working..." : "Apply Grace Period"}
              </ControlButton>
            </div>

            <div style={{ display: "grid", gap: 10, padding: 14, borderRadius: 18, border: theme.border.muted, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 12, color: theme.text.secondary }}>Entitlement override</div>
              <ControlSelect value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)}>
                <option value="normal">Normal logic</option>
                <option value="allow">Manual allow</option>
                <option value="restricted">Manual restrict</option>
              </ControlSelect>
              <div style={{ fontSize: 12, color: theme.text.quiet }}>
                This sits above automatic evaluation and is the clearest manual allow / restrict control the current model supports.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ControlButton
                  onClick={() =>
                    void onAction({
                      action: "set_entitlement_override",
                      override: overrideValue === "normal" ? null : (overrideValue as "allow" | "restricted"),
                      note: note.trim(),
                    })
                  }
                  disabled={busy || !noteReady}
                >
                  {busy ? "Working..." : "Save Override"}
                </ControlButton>
                <ControlButton
                  tone="danger"
                  onClick={() => void onAction({ action: "clear_overrides", note: note.trim() })}
                  disabled={busy || !noteReady}
                >
                  {busy ? "Working..." : "Clear Manual Overrides"}
                </ControlButton>
              </div>
              <div style={{ fontSize: 12, color: theme.text.quiet }}>
                Clearing overrides returns access logic to normal evaluation. Existing trial and grace dates stay on the shop record.
              </div>
            </div>
          </div>
        </div>

        {message ? <div style={{ fontSize: 13, color: theme.text.secondary }}>{message}</div> : null}
      </div>
    </GlassCard>
  );
}
