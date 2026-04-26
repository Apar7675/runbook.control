import React from "react";
import { ControlActionButtonV2, ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import ControlBadgeV2 from "@/components/control/v2/ControlBadgeV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import { ControlTableCellV2, ControlTableHeadCellV2, ControlTableV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { requirePlatformAdminAal2 } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";

type StatusScope = "access" | "config" | "database" | "devices" | "audit" | "billing";
type StatusSeverity = "ok" | "warn" | "critical" | "neutral";

type StatusRow = {
  id: string;
  scope: StatusScope;
  component: string;
  severity: StatusSeverity;
  status: string;
  signal: string;
  detail: string;
  observed_at: string | null;
  source: string;
};

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function badgeTone(severity: StatusSeverity): "success" | "warning" | "danger" | "neutral" {
  if (severity === "ok") return "success";
  if (severity === "warn") return "warning";
  if (severity === "critical") return "danger";
  return "neutral";
}

function severityLabel(severity: StatusSeverity) {
  if (severity === "ok") return "OK";
  if (severity === "warn") return "Warning";
  if (severity === "critical") return "Critical";
  return "Info";
}

function severityRank(severity: StatusSeverity) {
  if (severity === "critical") return 0;
  if (severity === "warn") return 1;
  if (severity === "neutral") return 2;
  return 3;
}

function observedAtRank(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

function formatObservedAt(value: string | null) {
  if (!value) return "-";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

function shortAge(value: string | null) {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  const delta = Date.now() - time;
  if (delta < 0) return "";
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function safeEnv(name: string) {
  const value = process.env[name];
  return Boolean(value && String(value).trim().length);
}

function isMissingColumnError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("does not exist") && normalized.includes("column");
}

function auditSeverity(action: string): StatusSeverity {
  const normalized = action.toLowerCase();
  if (normalized.includes("failed") || normalized.includes("error")) return "critical";
  if (normalized.includes("warning")) return "warn";
  return "neutral";
}

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const scopeFilter = firstParam(params.scope).trim().toLowerCase();
  const severityFilter = firstParam(params.severity).trim().toLowerCase();
  const query = firstParam(params.q).trim().toLowerCase();

  const { user } = await requirePlatformAdminAal2();
  const admin = supabaseAdmin();

  let shopsCount = 0;
  let devicesCount = 0;
  let tokensCount = 0;
  let stale24h = 0;
  let offline7d = 0;
  let activeDevices = 0;
  let disabledDevices = 0;
  let recentAudit: Array<{ id: string; created_at: string | null; action: string | null; shop_id: string | null; target_id: string | null; actor_email: string | null }> = [];
  let statusRows: StatusRow[] = [];
  let loadError = "";

  try {
    type DeviceRow = {
      id: string;
      shop_id: string | null;
      status: string | null;
      last_seen_at?: string | null;
      reported_version?: string | null;
    };
    type TokenRow = {
      device_id: string;
      last_seen_at: string | null;
    };

    let devices: DeviceRow[] = [];
    let tokens: TokenRow[] = [];

    const shopsResult = await admin.from("rb_shops").select("id", { count: "exact", head: true });
    if (shopsResult.error) throw new Error(shopsResult.error.message);
    shopsCount = shopsResult.count ?? 0;

    const recentDeviceSelect = "id,shop_id,status,last_seen_at,reported_version";
    const fallbackDeviceSelect = "id,shop_id,status";
    const deviceResult = await admin.from("rb_devices").select(recentDeviceSelect).order("created_at", { ascending: false }).limit(500);
    if (!deviceResult.error) {
      devices = (deviceResult.data ?? []) as DeviceRow[];
    } else if (isMissingColumnError(deviceResult.error.message)) {
      const fallbackDeviceResult = await admin.from("rb_devices").select(fallbackDeviceSelect).order("created_at", { ascending: false }).limit(500);
      if (fallbackDeviceResult.error) throw new Error(fallbackDeviceResult.error.message);
      devices = (fallbackDeviceResult.data ?? []) as DeviceRow[];
    } else {
      throw new Error(deviceResult.error.message);
    }

    devicesCount = devices.length;

    const deviceIds = devices.map((device) => device.id).filter(Boolean);
    if (deviceIds.length > 0) {
      const tokenResult = await admin.from("rb_device_tokens").select("device_id,last_seen_at").in("device_id", deviceIds);
      if (tokenResult.error) throw new Error(tokenResult.error.message);
      tokens = (tokenResult.data ?? []) as TokenRow[];
    }
    tokensCount = tokens.length;

    const latestTokenSeenByDevice = new Map<string, string>();
    for (const token of tokens) {
      if (!token.last_seen_at) continue;
      const previous = latestTokenSeenByDevice.get(token.device_id);
      if (!previous || token.last_seen_at > previous) latestTokenSeenByDevice.set(token.device_id, token.last_seen_at);
    }

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    for (const device of devices) {
      const normalizedStatus = String(device.status ?? "").toLowerCase();
      if (normalizedStatus === "active") activeDevices++;
      if (normalizedStatus === "disabled") disabledDevices++;
      if (normalizedStatus !== "active") continue;

      const bestSeenAt = latestTokenSeenByDevice.get(device.id) ?? device.last_seen_at ?? null;
      if (!bestSeenAt) {
        offline7d++;
        continue;
      }

      const seenAtMs = Date.parse(bestSeenAt);
      if (!Number.isFinite(seenAtMs)) {
        offline7d++;
        continue;
      }

      const age = now - seenAtMs;
      if (age > 7 * oneDayMs) offline7d++;
      else if (age > oneDayMs) stale24h++;
    }

    const auditResult = await admin
      .from("rb_audit_log")
      .select("id,created_at,action,shop_id,target_id,actor_email")
      .order("created_at", { ascending: false })
      .limit(12);
    if (auditResult.error) throw new Error(auditResult.error.message);
    recentAudit = (auditResult.data ?? []) as typeof recentAudit;

    const latestAudit = recentAudit[0] ?? null;
    const gateMode = process.env.RUNBOOK_BILLING_GATE_MODE ?? "hybrid";

    statusRows = [
      {
        id: "session-platform-admin",
        scope: "access",
        component: "Platform admin session",
        severity: "ok",
        status: "Verified",
        signal: user.email ?? user.id ?? "Signed in",
        detail: "AAL2 platform-admin access is required and was verified on the server.",
        observed_at: null,
        source: "requirePlatformAdminAal2()",
      },
      {
        id: "config-supabase-url",
        scope: "config",
        component: "SUPABASE_URL",
        severity: safeEnv("NEXT_PUBLIC_SUPABASE_URL") ? "ok" : "critical",
        status: safeEnv("NEXT_PUBLIC_SUPABASE_URL") ? "Present" : "Missing",
        signal: "Environment",
        detail: "Control depends on the public Supabase URL for authenticated application paths.",
        observed_at: null,
        source: "process.env.NEXT_PUBLIC_SUPABASE_URL",
      },
      {
        id: "config-supabase-anon",
        scope: "config",
        component: "SUPABASE_ANON_KEY",
        severity: safeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "ok" : "critical",
        status: safeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "Present" : "Missing",
        signal: "Environment",
        detail: "The public anon key is required for browser-authenticated Supabase access.",
        observed_at: null,
        source: "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY",
      },
      {
        id: "config-supabase-service",
        scope: "config",
        component: "SUPABASE_SERVICE_ROLE_KEY",
        severity: safeEnv("SUPABASE_SERVICE_ROLE_KEY") ? "ok" : "critical",
        status: safeEnv("SUPABASE_SERVICE_ROLE_KEY") ? "Present" : "Missing",
        signal: "Environment",
        detail: "Server-authoritative admin routes require the Supabase service role key.",
        observed_at: null,
        source: "process.env.SUPABASE_SERVICE_ROLE_KEY",
      },
      {
        id: "config-stripe-secret",
        scope: "billing",
        component: "STRIPE_SECRET_KEY",
        severity: safeEnv("STRIPE_SECRET_KEY") ? "ok" : "critical",
        status: safeEnv("STRIPE_SECRET_KEY") ? "Present" : "Missing",
        signal: "Environment",
        detail: "Stripe sync and checkout operations depend on the secret key.",
        observed_at: null,
        source: "process.env.STRIPE_SECRET_KEY",
      },
      {
        id: "config-stripe-price",
        scope: "billing",
        component: "STRIPE_PRICE_ID",
        severity: safeEnv("STRIPE_PRICE_ID") ? "ok" : "warn",
        status: safeEnv("STRIPE_PRICE_ID") ? "Present" : "Missing",
        signal: `Gate ${gateMode}`,
        detail: "Billing checkout flows expect a configured Stripe price id.",
        observed_at: null,
        source: "process.env.STRIPE_PRICE_ID",
      },
      {
        id: "config-stripe-webhook",
        scope: "billing",
        component: "STRIPE_WEBHOOK_SECRET",
        severity: safeEnv("STRIPE_WEBHOOK_SECRET") ? "ok" : "warn",
        status: safeEnv("STRIPE_WEBHOOK_SECRET") ? "Present" : "Missing",
        signal: "Environment",
        detail: "Webhook handling requires a configured Stripe webhook secret.",
        observed_at: null,
        source: "process.env.STRIPE_WEBHOOK_SECRET",
      },
      {
        id: "database-shops",
        scope: "database",
        component: "rb_shops",
        severity: "ok",
        status: "Reachable",
        signal: `${shopsCount} shop${shopsCount === 1 ? "" : "s"}`,
        detail: "Exact shop count from the current Control authority view.",
        observed_at: null,
        source: "supabaseAdmin().from('rb_shops').select(...count...)",
      },
      {
        id: "devices-sample",
        scope: "devices",
        component: "rb_devices recent slice",
        severity: "ok",
        status: "Reachable",
        signal: `${devicesCount} sampled / 500 max`,
        detail: `${activeDevices} active, ${disabledDevices} disabled devices in the recent status slice.`,
        observed_at: null,
        source: "supabaseAdmin().from('rb_devices').select(...).limit(500)",
      },
      {
        id: "devices-tokens",
        scope: "devices",
        component: "rb_device_tokens",
        severity: "ok",
        status: "Reachable",
        signal: `${tokensCount} token${tokensCount === 1 ? "" : "s"}`,
        detail: "Recent device token heartbeat rows for the sampled devices.",
        observed_at: null,
        source: "supabaseAdmin().from('rb_device_tokens').select(...).in(...)",
      },
      {
        id: "devices-stale",
        scope: "devices",
        component: "Active devices stale >24h",
        severity: stale24h > 0 ? "warn" : "ok",
        status: stale24h > 0 ? "Review needed" : "No stale devices",
        signal: `${stale24h} device${stale24h === 1 ? "" : "s"}`,
        detail: "Active devices older than 24 hours since the most recent token or device heartbeat.",
        observed_at: null,
        source: "Derived from rb_devices + rb_device_tokens recent slice",
      },
      {
        id: "devices-offline",
        scope: "devices",
        component: "Active devices offline >7d",
        severity: offline7d > 0 ? "critical" : "ok",
        status: offline7d > 0 ? "Action needed" : "No offline devices",
        signal: `${offline7d} device${offline7d === 1 ? "" : "s"}`,
        detail: "Active devices with no recent heartbeat inside the seven-day window.",
        observed_at: null,
        source: "Derived from rb_devices + rb_device_tokens recent slice",
      },
      {
        id: "audit-recency",
        scope: "audit",
        component: "Recent audit activity",
        severity: latestAudit ? "ok" : "warn",
        status: latestAudit ? "Observed" : "No recent rows",
        signal: latestAudit?.action ?? "No recent audit event",
        detail: latestAudit
          ? `Latest audit row from ${latestAudit.actor_email ?? "system"} ${shortAge(latestAudit.created_at) || ""}`.trim()
          : "No recent audit rows were returned from rb_audit_log.",
        observed_at: latestAudit?.created_at ?? null,
        source: "supabaseAdmin().from('rb_audit_log').select(...).limit(12)",
      },
      ...recentAudit.map((entry) => ({
        id: `audit-${entry.id}`,
        scope: "audit" as const,
        component: entry.action ?? "Audit event",
        severity: auditSeverity(entry.action ?? ""),
        status: entry.actor_email ? "User event" : "System event",
        signal: [entry.actor_email ?? "system", entry.shop_id ?? "-", entry.target_id ?? "-"].join(" | "),
        detail: `shop ${entry.shop_id ?? "-"} target ${entry.target_id ?? "-"} actor ${entry.actor_email ?? "system"}`,
        observed_at: entry.created_at ?? null,
        source: "supabaseAdmin().from('rb_audit_log').select(...).limit(12)",
      })),
    ];
  } catch (error: any) {
    loadError = error?.message ?? "Unable to load Control status.";
    statusRows = [
      {
        id: "status-load-failure",
        scope: "database",
        component: "Status load",
        severity: "critical",
        status: "Failed",
        signal: "Server error",
        detail: loadError,
        observed_at: new Date().toISOString(),
        source: "Status page server load",
      },
    ];
  }

  const filteredRows = statusRows
    .filter((row) => {
      if (scopeFilter && scopeFilter !== "all" && row.scope !== scopeFilter) return false;
      if (severityFilter && severityFilter !== "all" && row.severity !== severityFilter) return false;
      if (!query) return true;
      return [row.component, row.status, row.signal, row.detail, row.scope, row.source]
        .some((value) => value.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      const severityDelta = severityRank(a.severity) - severityRank(b.severity);
      if (severityDelta !== 0) return severityDelta;
      const observedDelta = observedAtRank(b.observed_at) - observedAtRank(a.observed_at);
      if (observedDelta !== 0) return observedDelta;
      const scopeDelta = a.scope.localeCompare(b.scope);
      if (scopeDelta !== 0) return scopeDelta;
      return a.component.localeCompare(b.component);
    });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Status / Audit</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Control status log</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>
            Server-rendered operator log for Control state, configuration, billing gates, device freshness, and recent audit activity.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ControlActionLinkV2 href="/audit">Open audit</ControlActionLinkV2>
          <ControlActionLinkV2 href="/billing-access" tone="primary">Open billing access</ControlActionLinkV2>
        </div>
      </div>

      <form method="get" style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 2fr) repeat(3, minmax(0, 1fr))", gap: 8 }}>
          <ControlInputV2 name="q" defaultValue={firstParam(params.q)} placeholder="Search component, signal, detail" />
          <ControlSelectV2 name="scope" defaultValue={scopeFilter || "all"}>
            <option value="all">All scopes</option>
            <option value="access">Access</option>
            <option value="config">Config</option>
            <option value="billing">Billing</option>
            <option value="database">Database</option>
            <option value="devices">Devices</option>
            <option value="audit">Audit</option>
          </ControlSelectV2>
          <ControlSelectV2 name="severity" defaultValue={severityFilter || "all"}>
            <option value="all">All severities</option>
            <option value="ok">OK</option>
            <option value="warn">Warning</option>
            <option value="critical">Critical</option>
            <option value="neutral">Info</option>
          </ControlSelectV2>
          <div style={{ display: "flex", gap: 8 }}>
            <ControlActionButtonV2 type="submit" tone="primary">
              Apply
            </ControlActionButtonV2>
            <ControlActionLinkV2 href="/status">Clear</ControlActionLinkV2>
          </div>
        </div>
        <div style={{ fontSize: 12, color: t.color.textQuiet }}>
          {filteredRows.length} row{filteredRows.length === 1 ? "" : "s"} shown from {statusRows.length}.
          {loadError ? ` Load error: ${loadError}` : ""}
        </div>
      </form>

      <ControlTableWrapV2>
        <ControlTableV2 minWidth={1120}>
          <thead>
            <tr>
              <ControlTableHeadCellV2>Observed</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Scope</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Component</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Status</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Signal</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Detail</ControlTableHeadCellV2>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>
                  No status rows matched the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id}>
                  <ControlTableCellV2>
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={{ color: t.color.text }}>{formatObservedAt(row.observed_at)}</div>
                      <div style={{ fontSize: 11.5, color: t.color.textQuiet }}>{shortAge(row.observed_at) || "-"}</div>
                    </div>
                  </ControlTableCellV2>
                  <ControlTableCellV2>
                    <div style={{ textTransform: "capitalize", color: t.color.text }}>{row.scope}</div>
                  </ControlTableCellV2>
                  <ControlTableCellV2>
                    <div style={{ fontWeight: 700, color: t.color.text }}>{row.component}</div>
                  </ControlTableCellV2>
                  <ControlTableCellV2>
                    <div style={{ display: "grid", gap: 4 }}>
                      <ControlBadgeV2 label={severityLabel(row.severity)} tone={badgeTone(row.severity)} />
                      <div style={{ color: t.color.text }}>{row.status}</div>
                    </div>
                  </ControlTableCellV2>
                  <ControlTableCellV2>{row.signal}</ControlTableCellV2>
                  <ControlTableCellV2>{row.detail}</ControlTableCellV2>
                </tr>
              ))
            )}
          </tbody>
        </ControlTableV2>
      </ControlTableWrapV2>
    </div>
  );
}
