import React from "react";
import EnableMFAClient from "@/components/EnableMFAClient";
import NoviceModeToggle from "@/components/NoviceModeToggle";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip from "@/components/control/ControlStatusChip";
import { controlTheme as t } from "@/components/control/controlTheme";
import { loadSettingsViews } from "@/lib/control/settingsViews";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function policyBlock({
  title,
  description,
  source,
  stateLabel,
  stateTone,
  children,
}: {
  title: string;
  description: string;
  source: string;
  stateLabel: string;
  stateTone: "success" | "warning" | "danger" | "neutral" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: 16,
        borderRadius: t.radius.md,
        border: `1px solid ${t.color.softBorder}`,
        background: "rgba(7, 10, 15, 0.34)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.text, fontWeight: 800 }}>{title}</div>
          <div style={{ color: t.color.textSecondary, fontSize: 13, lineHeight: 1.55 }}>{description}</div>
          <div style={{ color: t.color.textMuted, fontSize: 12 }}>Source: {source}</div>
        </div>
        <ControlStatusChip label={stateLabel} tone={stateTone} />
      </div>
      <div>{children}</div>
    </div>
  );
}

function kv(label: string, value: React.ReactNode) {
  return (
    <div
      key={label}
      style={{
        display: "grid",
        gap: 6,
        padding: 12,
        borderRadius: t.radius.md,
        border: `1px solid ${t.color.softBorder}`,
        background: "rgba(16, 23, 34, 0.52)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.72, textTransform: "uppercase", color: t.color.textMuted }}>{label}</div>
      <div style={{ color: t.color.textSecondary, fontSize: 13, lineHeight: 1.55 }}>{value}</div>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const mfaRequired = firstParam(params.mfa) === "required";
  const data = await loadSettingsViews();

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ControlPageHeader
        eyebrow="Settings"
        title="Settings / Policies"
        description="Control policy and admin settings surface. Real save actions stay limited to features already backed by schema or API; everything else is marked read-only or not surfaced."
        actions={<ControlActionLink href="/status">Open diagnostics</ControlActionLink>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <ControlMetricCard label="General" value={data.noviceOn ? "Novice on" : "Novice off"} meta="User preference persisted in rb_user_prefs." tone="neutral" />
        <ControlMetricCard label="Security" value={data.currentAal.toUpperCase()} meta={data.mfaRequired ? "Platform-admin sessions require MFA/AAL2." : "MFA is available from this page."} tone={data.currentAal === "aal2" ? "success" : "warning"} />
        <ControlMetricCard label="Update Policy" value={String(data.policies.update.totalPolicies)} meta={`${data.policies.update.minimumCount} minimum rules and ${data.policies.update.pinnedCount} pinned rules surfaced.`} tone={data.policies.update.totalPolicies > 0 ? "info" : "neutral"} />
        <ControlMetricCard label="Mobile Policy" value={String(data.policies.mobile.enabledShops)} meta={`${data.policies.mobile.pendingReviewModeCount} shop${data.policies.mobile.pendingReviewModeCount === 1 ? "" : "s"} use pending-review mobile failure mode.`} tone={data.policies.mobile.enabledShops > 0 ? "info" : "neutral"} />
        <ControlMetricCard label="Webhooks / Billing" value={data.policies.webhooks.stripeWebhookConfigured ? "Configured" : "Missing"} meta={`${data.policies.billing.fullAccess} full-access shops, ${data.policies.billing.restricted} restricted shops.`} tone={data.policies.webhooks.stripeWebhookConfigured ? "success" : "warning"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
        <ControlPanel
          title="General"
          description="User-facing preferences and current Control session state."
        >
          <div style={{ display: "grid", gap: 14 }}>
            {policyBlock({
              title: "Preferences",
              description: "Novice mode is a real persisted preference that controls onboarding and guidance emphasis.",
              source: "rb_user_prefs + /api/user/prefs",
              stateLabel: "Active",
              stateTone: "success",
              children: <NoviceModeToggle initialOn={data.noviceOn} />,
            })}
            {policyBlock({
              title: "Session Context",
              description: "Control role and session state are derived from the authenticated server session and authorized scope.",
              source: "getViewerContext() + Supabase auth session",
              stateLabel: data.context.isPlatformAdmin ? "Platform admin" : "Member session",
              stateTone: data.context.isPlatformAdmin ? "info" : "neutral",
              children: (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  {kv("Session email", data.context.email ?? "Not surfaced")}
                  {kv("Authorized shops", String(data.context.shops.length))}
                </div>
              ),
            })}
          </div>
        </ControlPanel>

        <ControlPanel
          title="Security"
          description="Security actions shown here are real. Policy notes stay explicit about what Control currently enforces."
        >
          <div style={{ display: "grid", gap: 14 }}>
            {policyBlock({
              title: "MFA",
              description: "Platform admins must satisfy AAL2. The MFA enrollment and verify flow on this page is real and already backed by Supabase auth.",
              source: "Supabase auth.mfa + /mfa route",
              stateLabel: data.currentAal === "aal2" ? "AAL2 active" : "Needs AAL2",
              stateTone: data.currentAal === "aal2" ? "success" : "warning",
              children: <EnableMFAClient required={mfaRequired || data.mfaRequired} />,
            })}
            {policyBlock({
              title: "Security Posture",
              description: "Control enforces MFA for platform-admin paths through server-side authorization guards.",
              source: "requirePlatformAdminAal2() + layout/session gates",
              stateLabel: "Read only",
              stateTone: "info",
              children: (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  {kv("Current AAL", data.currentAal.toUpperCase())}
                  {kv("Platform-admin MFA rule", data.mfaRequired ? "Required" : "Not required")}
                </div>
              ),
            })}
          </div>
        </ControlPanel>
      </div>

      <ControlPanel
        title="Policies"
        description="Policy surfaces are grouped by what Control currently enforces and whether that policy is editable here, editable elsewhere, or not yet surfaced."
      >
        <div style={{ display: "grid", gap: 14 }}>
          {policyBlock({
            title: "Device Policy",
            description: "Device validation currently enforces minimum and pinned versions during token validation. This page surfaces that behavior but does not create a fake save control.",
            source: "rb_update_policy + /api/device/validate-token",
            stateLabel: data.policies.update.totalPolicies > 0 ? "Active" : "Not surfaced",
            stateTone: data.policies.update.totalPolicies > 0 ? "success" : "neutral",
            children: (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                {kv("Shop policies", String(data.policies.update.totalPolicies))}
                {kv("Minimum rules", String(data.policies.update.minimumCount))}
                {kv("Pinned rules", String(data.policies.update.pinnedCount))}
                {kv("Action", <ControlActionLink href="/updates">Open updates</ControlActionLink>)}
              </div>
            ),
          })}

          {policyBlock({
            title: "Update Policy",
            description: "Control stores package metadata and shop rollout rules. Package uploads are real; policy editing remains shop-scoped today.",
            source: "rb_update_packages + rb_update_policy + /updates/packages",
            stateLabel: "Mixed",
            stateTone: "info",
            children: (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                {kv("Packages", String(data.policies.update.packagesCount))}
                {kv("Channels", data.policies.update.channels.length > 0 ? data.policies.update.channels.join(", ") : "Not surfaced")}
                {kv("Policy editing", "Shop-scoped")}
                {kv("Action", <ControlActionLink href="/updates/packages">Upload package</ControlActionLink>)}
              </div>
            ),
          })}

          {policyBlock({
            title: "Mobile Policy",
            description: "Mobile timeclock policy exists today, but editing remains shop-scoped so this page stays read-only for the policy itself.",
            source: "rb_shops mobile_timeclock fields + /shops/[shopId]/policy",
            stateLabel: data.policies.mobile.enabledShops > 0 ? "Shop-scoped" : "Not surfaced",
            stateTone: data.policies.mobile.enabledShops > 0 ? "info" : "neutral",
            children: (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                {kv("Enabled shops", String(data.policies.mobile.enabledShops))}
                {kv("Policy modes", data.policies.mobile.policyModes.length > 0 ? data.policies.mobile.policyModes.join(", ") : "Not surfaced")}
                {kv("Pending review mode", String(data.policies.mobile.pendingReviewModeCount))}
                {kv("Action", data.context.shops[0] ? <ControlActionLink href={`/shops/${data.context.shops[0].id}/policy`}>Open shop policy</ControlActionLink> : "Not surfaced")}
              </div>
            ),
          })}

          {policyBlock({
            title: "Trial / Billing Policy",
            description: "Billing and entitlement outcomes are active and real, but mutation remains on dedicated billing surfaces rather than generic settings toggles.",
            source: "rb_shops billing fields + entitlement/access logic",
            stateLabel: "Read only here",
            stateTone: "warning",
            children: (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                {kv("Trialing shops", String(data.policies.billing.trialing))}
                {kv("Restricted shops", String(data.policies.billing.restricted))}
                {kv("Full access shops", String(data.policies.billing.fullAccess))}
                {kv("Action", <ControlActionLink href="/billing-access">Open billing</ControlActionLink>)}
              </div>
            ),
          })}
        </div>
      </ControlPanel>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
        <ControlPanel
          title="Webhooks"
          description="Webhook visibility is real where environment or event data is surfaced. No fake save toggles are introduced."
        >
          {policyBlock({
            title: "Stripe Webhooks",
            description: "Webhook processing depends on configured secrets and the optional webhook event table.",
            source: "process.env + rb_webhook_events when available",
            stateLabel: data.policies.webhooks.stripeWebhookConfigured ? "Configured" : "Missing secret",
            stateTone: data.policies.webhooks.stripeWebhookConfigured ? "success" : "warning",
            children: (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {kv("Webhook secret", data.policies.webhooks.stripeWebhookConfigured ? "Present" : "Missing")}
                {kv("Event table", data.policies.webhooks.webhookEventsAvailable ? "Available" : "Not surfaced")}
                {kv("Stored events", data.policies.webhooks.webhookEventCount === null ? "Not surfaced" : String(data.policies.webhooks.webhookEventCount))}
              </div>
            ),
          })}
        </ControlPanel>

        <ControlPanel
          title="Developer / Diagnostics"
          description="These diagnostics are visible here, but the deeper operational surface remains the dedicated status page."
          actions={<ControlActionLink href="/status">Open status page</ControlActionLink>}
        >
          {policyBlock({
            title: "Environment Diagnostics",
            description: "Useful for admin troubleshooting without implying that this page persists configuration changes.",
            source: "process.env + existing status surfaces",
            stateLabel: "Read only",
            stateTone: "neutral",
            children: (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {kv("Service role", data.policies.diagnostics.serviceRolePresent ? "Present" : "Missing")}
                {kv("Stripe secret", data.policies.diagnostics.stripeSecretPresent ? "Present" : "Missing")}
                {kv("Stripe price id", data.policies.diagnostics.stripePricePresent ? "Present" : "Missing")}
              </div>
            ),
          })}
        </ControlPanel>
      </div>
    </div>
  );
}
