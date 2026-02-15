import React from "react";
import GlassCard from "@/components/GlassCard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatformAdminAal2 } from "@/lib/authz";

export const dynamic = "force-dynamic";

function iso(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toISOString();
  } catch {
    return ts;
  }
}

function shortId(id?: string | null) {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
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
  if (!ts) return "—";
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return "—";
  const age = Date.now() - t;
  if (age < 0) return "—";
  return msToAge(age);
}

function pill(text: string, tone: "ok" | "warn" | "bad" | "info" = "info") {
  const style: React.CSSProperties =
    tone === "ok"
      ? { background: "rgba(80,220,140,0.16)", color: "#bff5d2" }
      : tone === "warn"
      ? { background: "rgba(255,180,80,0.16)", color: "#ffe4c6" }
      : tone === "bad"
      ? { background: "rgba(255,120,120,0.16)", color: "#ffd0d0" }
      : { background: "rgba(139,140,255,0.16)", color: "#cfd0ff" };

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,0.14)",
        ...style,
      }}
    >
      {text}
    </span>
  );
}

function boolChip(label: string, ok: boolean) {
  return pill(label, ok ? "ok" : "bad");
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
  // Enforce platform admin + AAL2
  const { user } = await requirePlatformAdminAal2();

  const admin = supabaseAdmin();

  // --- SUPABASE HEALTH + COUNTS ---
  const health: { ok: boolean; error?: string } = { ok: true };
  let shopsCount = 0;
  let devicesCount = 0;
  let tokensCount = 0;

  // devices slice (we compute stale/offline)
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
    // shops count
    {
      const r = await admin.from("rb_shops").select("id", { count: "exact", head: true });
      shopsCount = r.count ?? 0;
    }

    // devices (new schema first, fallback)
    {
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

        const v = (d.reported_version ?? null) as any;
        if (v) versions.set(String(v), (versions.get(String(v)) ?? 0) + 1);
      }
    }

    // tokens for those devices
    {
      const ids = devices.map((d) => d.id).filter(Boolean);
      if (ids.length) {
        const r = await admin
          .from("rb_device_tokens")
          .select("id,device_id,revoked_at,last_seen_at")
          .in("device_id", ids);
        if (r.error) throw new Error(r.error.message);
        tokens = (r.data ?? []) as any;
      }
      tokensCount = tokens.length;
    }

    // compute lastSeen = max(device.last_seen_at, token.last_seen_at)
    const tokLastByDevice = new Map<string, string>();
    for (const t of tokens) {
      if (!t.last_seen_at) continue;
      const prev = tokLastByDevice.get(t.device_id);
      if (!prev || String(t.last_seen_at) > prev) tokLastByDevice.set(t.device_id, String(t.last_seen_at));
    }

    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const d of devices) {
      const a = String(d.status ?? "").toLowerCase();
      if (a !== "active") continue; // stale/offline only matters for active fleet

      const tokTs = tokLastByDevice.get(d.id) ?? null;
      const devTs = (d.last_seen_at ?? null) as any;
      const best = tokTs ?? devTs ?? null;

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
      else if (age > 1 * day) stale24h++;
    }
  } catch (e: any) {
    health.ok = false;
    health.error = e?.message ?? String(e);
  }

  // --- AUDIT HEALTH ---
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
  } catch {
    // best-effort
  }

  // --- BILLING CONFIG (env presence) ---
  const supaUrlOk = safeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supaAnonOk = safeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supaSvcOk = safeEnv("SUPABASE_SERVICE_ROLE_KEY");

  const stripeKeyOk = safeEnv("STRIPE_SECRET_KEY");
  const stripePriceOk = safeEnv("STRIPE_PRICE_ID");
  const stripeWhOk = safeEnv("STRIPE_WEBHOOK_SECRET");

  const gateMode = process.env.RUNBOOK_BILLING_GATE_MODE ?? "hybrid";

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Control Status</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {boolChip("Supabase", health.ok)}
          {pill(`Gate: ${gateMode}`, "info")}
        </div>
      </div>

      <GlassCard title="Session">
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            user: <b>{user?.email ?? user?.id ?? "—"}</b>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {pill("platform admin: yes", "ok")}
            {pill("AAL2: yes", "ok")}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Configuration">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {boolChip("SUPABASE_URL", supaUrlOk)}
            {boolChip("SUPABASE_ANON", supaAnonOk)}
            {boolChip("SUPABASE_SERVICE", supaSvcOk)}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {boolChip("STRIPE_SECRET", stripeKeyOk)}
            {boolChip("STRIPE_PRICE", stripePriceOk)}
            {boolChip("STRIPE_WEBHOOK", stripeWhOk)}
          </div>
        </div>
      </GlassCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <GlassCard title="Supabase Health">
          {!health.ok ? (
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {pill("ERROR", "bad")} <span style={{ marginLeft: 8 }}>{health.error}</span>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                {pill(`Shops: ${shopsCount}`, "info")}
                {pill(`Devices: ${devicesCount}`, "info")}
                {pill(`Tokens: ${tokensCount}`, "info")}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                {pill(`Active devices: ${activeDevices}`, "ok")}
                {pill(`Disabled devices: ${disabledDevices}`, "warn")}
                {pill(`Stale >24h: ${stale24h}`, stale24h ? "warn" : "ok")}
                {pill(`Offline >7d: ${offline7d}`, offline7d ? "bad" : "ok")}
              </div>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Version samples (last 500 devices):{" "}
                {versions.size === 0 ? (
                  <b>—</b>
                ) : (
                  <span>
                    {[...versions.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([v, n]) => `${v} (${n})`)
                      .join(", ")}
                    {versions.size > 6 ? " …" : ""}
                  </span>
                )}
              </div>
            </div>
          )}
        </GlassCard>

        <GlassCard title="Audit Health">
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {pill(`Last event: ${lastAuditAction ?? "—"}`, "info")}
              {pill(`At: ${iso(lastAuditAt)}`, "info")}
              <span style={{ fontSize: 12, opacity: 0.75 }}>(~{ageFromIso(lastAuditAt)} ago)</span>
            </div>

            {recentAudit.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>No recent audit events.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {recentAudit.slice(0, 8).map((a: any) => (
                  <div
                    key={a.id}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.02)",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>{a.action}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        shop: {shortId(a.shop_id)} • target: {shortId(a.target_id)} • actor: {a.actor_email ?? "—"}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {iso(a.created_at)} <span style={{ opacity: 0.6 }}>({ageFromIso(a.created_at)} ago)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard title="Notes">
        <div style={{ fontSize: 12, opacity: 0.8, display: "grid", gap: 8 }}>
          <div>• This page is server-rendered and queries Supabase directly (service role) for fast, reliable truth.</div>
          <div>• If Supabase is down or keys are wrong, you’ll see it here immediately.</div>
          <div>• “Stale/Offline” only counts active devices (disabled devices are intentionally ignored).</div>
        </div>
      </GlassCard>
    </div>
  );
}
