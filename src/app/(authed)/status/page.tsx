import React from "react";
import { KeyValueGrid, NoteList, PageHeader, SectionBlock, StatusBadge } from "@/components/control/ui";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatformAdminAal2 } from "@/lib/authz";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";

function iso(ts?: string | null) {
  if (!ts) return "-";
  try {
    return formatDateTime(ts);
  } catch {
    return ts;
  }
}

function shortId(id?: string | null) {
  if (!id) return "-";
  return id.length > 10 ? `${id.slice(0, 8)}...` : id;
}

function msToAge(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d`;
  const w = Math.floor(d / 7);
  return `${w}w`;
}

function ageFromIso(ts?: string | null) {
  if (!ts) return "-";
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return "-";
  const age = Date.now() - t;
  if (age < 0) return "-";
  return msToAge(age);
}

function safeEnv(name: string) {
  const v = process.env[name];
  return !!(v && String(v).trim().length);
}

function isMissingColumnError(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("does not exist") && m.includes("column");
}

export default async function StatusPage() {
  const { user } = await requirePlatformAdminAal2();
  const admin = supabaseAdmin();

  const health: { ok: boolean; error?: string } = { ok: true };
  let shopsCount = 0;
  let devicesCount = 0;
  let tokensCount = 0;

  type DevRow = {
    id: string;
    shop_id: string | null;
    status: string | null;
    last_seen_at?: string | null;
    reported_version?: string | null;
  };
  type TokRow = { id: string; device_id: string; revoked_at: string | null; last_seen_at: string | null };

  let devices: DevRow[] = [];
  let tokens: TokRow[] = [];
  let stale24h = 0;
  let offline7d = 0;
  let activeDevices = 0;
  let disabledDevices = 0;
  const versions = new Map<string, number>();

  try {
    const shops = await admin.from("rb_shops").select("id", { count: "exact", head: true });
    shopsCount = shops.count ?? 0;

    const selectNew = "id,shop_id,status,last_seen_at,reported_version";
    const selectOld = "id,shop_id,status";
    const r = await admin.from("rb_devices").select(selectNew).order("created_at", { ascending: false }).limit(500);
    if (!r.error) {
      devices = (r.data ?? []) as any;
    } else if (isMissingColumnError(r.error.message)) {
      const r2 = await admin.from("rb_devices").select(selectOld).order("created_at", { ascending: false }).limit(500);
      if (r2.error) throw new Error(r2.error.message);
      devices = (r2.data ?? []) as any;
    } else {
      throw new Error(r.error.message);
    }

    devicesCount = devices.length;
    for (const d of devices) {
      const st = String(d.status ?? "").toLowerCase();
      if (st === "active") activeDevices++;
      else if (st === "disabled") disabledDevices++;
      const v = d.reported_version ?? null;
      if (v) versions.set(String(v), (versions.get(String(v)) ?? 0) + 1);
    }

    const ids = devices.map((d) => d.id).filter(Boolean);
    if (ids.length) {
      const tokenRes = await admin.from("rb_device_tokens").select("id,device_id,revoked_at,last_seen_at").in("device_id", ids);
      if (tokenRes.error) throw new Error(tokenRes.error.message);
      tokens = (tokenRes.data ?? []) as any;
    }
    tokensCount = tokens.length;

    const tokLastByDevice = new Map<string, string>();
    for (const t of tokens) {
      if (!t.last_seen_at) continue;
      const prev = tokLastByDevice.get(t.device_id);
      if (!prev || String(t.last_seen_at) > prev) tokLastByDevice.set(t.device_id, String(t.last_seen_at));
    }

    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const d of devices) {
      if (String(d.status ?? "").toLowerCase() !== "active") continue;
      const best = tokLastByDevice.get(d.id) ?? d.last_seen_at ?? null;
      if (!best) {
        offline7d++;
        continue;
      }
      const t = Date.parse(best);
      if (!Number.isFinite(t)) {
        offline7d++;
        continue;
      }
      const age = now - t;
      if (age > 7 * day) offline7d++;
      else if (age > day) stale24h++;
    }
  } catch (e: any) {
    health.ok = false;
    health.error = e?.message ?? String(e);
  }

  let lastAuditAt: string | null = null;
  let lastAuditAction: string | null = null;
  let recentAudit: any[] = [];
  try {
    const r = await admin
      .from("rb_audit_log")
      .select("id,created_at,action,shop_id,target_id,actor_email")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!r.error) {
      recentAudit = r.data ?? [];
      const first = recentAudit[0];
      if (first) {
        lastAuditAt = first.created_at ?? null;
        lastAuditAction = first.action ?? null;
      }
    }
  } catch {}

  const supaUrlOk = safeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supaAnonOk = safeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supaSvcOk = safeEnv("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKeyOk = safeEnv("STRIPE_SECRET_KEY");
  const stripePriceOk = safeEnv("STRIPE_PRICE_ID");
  const stripeWhOk = safeEnv("STRIPE_WEBHOOK_SECRET");
  const gateMode = process.env.RUNBOOK_BILLING_GATE_MODE ?? "hybrid";

  return (
    <div className="rb-page">
      <PageHeader eyebrow="Platform Status" title="Control Status" description="Live platform readiness, Supabase health, billing configuration, and recent system activity in one consistent control surface." />

      <div className="rb-autoGrid">
        <SectionBlock title="Session" description="Current admin session and required protection level.">
          <div className="rb-stack">
            <div className="rb-pageCopy">User: <strong>{user?.email ?? user?.id ?? "-"}</strong></div>
            <div className="rb-chipRow">
              <StatusBadge label="Platform Admin" tone="healthy" />
              <StatusBadge label="AAL2" tone="healthy" />
            </div>
          </div>
        </SectionBlock>

        <SectionBlock title="Configuration" description="Critical env-backed services that Control depends on.">
          <div className="rb-stack">
            <div className="rb-chipRow">
              <StatusBadge label="SUPABASE_URL" tone={supaUrlOk ? "healthy" : "critical"} />
              <StatusBadge label="SUPABASE_ANON" tone={supaAnonOk ? "healthy" : "critical"} />
              <StatusBadge label="SUPABASE_SERVICE" tone={supaSvcOk ? "healthy" : "critical"} />
            </div>
            <div className="rb-chipRow">
              <StatusBadge label="STRIPE_SECRET" tone={stripeKeyOk ? "healthy" : "critical"} />
              <StatusBadge label="STRIPE_PRICE" tone={stripePriceOk ? "healthy" : "critical"} />
              <StatusBadge label="STRIPE_WEBHOOK" tone={stripeWhOk ? "healthy" : "critical"} />
              <StatusBadge label={`Gate ${gateMode}`} tone="neutral" />
            </div>
          </div>
        </SectionBlock>
      </div>

      <div className="rb-splitGrid">
        <SectionBlock title="Supabase Health" description="Shops, devices, and fleet-health rollup." tone={health.ok ? "subtle" : "critical"}>
          {!health.ok ? (
            <div className="rb-stack">
              <div className="rb-chipRow"><StatusBadge label="Error" tone="critical" /></div>
              <div className="rb-pageCopy">{health.error}</div>
            </div>
          ) : (
            <div className="rb-stack">
              <KeyValueGrid
                items={[
                  { label: "Shops", value: shopsCount },
                  { label: "Devices", value: devicesCount },
                  { label: "Tokens", value: tokensCount },
                  { label: "Gate", value: gateMode },
                ]}
              />
              <div className="rb-chipRow">
                <StatusBadge label={`Active ${activeDevices}`} tone="healthy" />
                <StatusBadge label={`Disabled ${disabledDevices}`} tone="warning" />
                <StatusBadge label={`Stale ${stale24h}`} tone={stale24h ? "warning" : "healthy"} />
                <StatusBadge label={`Offline ${offline7d}`} tone={offline7d ? "critical" : "healthy"} />
              </div>
              <div className="rb-fine">
                Version samples (last 500 devices):{" "}
                {versions.size === 0
                  ? "-"
                  : [...versions.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([v, n]) => `${v} (${n})`)
                      .join(", ")}
              </div>
            </div>
          )}
        </SectionBlock>

        <SectionBlock title="Audit Health" description="Most recent platform actions and whether activity is flowing normally.">
          <div className="rb-stack">
            <div className="rb-chipRow">
              <StatusBadge label={lastAuditAction ?? "No Events"} tone={lastAuditAction ? "neutral" : "warning"} />
              <StatusBadge label={lastAuditAt ? ageFromIso(lastAuditAt) : "-"} tone="neutral" />
            </div>
            <div className="rb-pageCopy">Last event at {iso(lastAuditAt)}</div>
            {recentAudit.length === 0 ? (
              <div className="rb-fine">No recent audit events.</div>
            ) : (
              <div className="rb-listRows">
                {recentAudit.slice(0, 8).map((a: any) => (
                  <div key={a.id} className="rb-deviceRow">
                    <div className="rb-rowBetween" style={{ alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>{a.action}</div>
                      <div className="rb-fine">{iso(a.created_at)}</div>
                    </div>
                    <div className="rb-pageCopy">
                      Shop: <strong>{shortId(a.shop_id)}</strong> | Target: <strong>{shortId(a.target_id)}</strong> | Actor: <strong>{a.actor_email ?? "-"}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionBlock>
      </div>

      <SectionBlock title="Interpretation Notes" description="Keep the platform readout opinionated instead of turning it into a raw diagnostics dump.">
        <NoteList
          items={[
            "This page is server-rendered and queries Supabase directly with service-role authority for fast truth.",
            "If Supabase is down or keys are wrong, the error will surface here immediately.",
            "Stale and offline counts only include active devices. Disabled devices are intentionally excluded.",
          ]}
        />
      </SectionBlock>
    </div>
  );
}
