import React from "react";
import GlassCard from "@/components/GlassCard";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  shop_id: string | null;
  target_type: string | null;
  target_id: string | null;
};

function iso(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toISOString();
  } catch {
    return ts;
  }
}

export default async function StatusPage() {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentAAL = (aalData?.currentLevel as string | null) ?? "aal1";
  const nextAAL = (aalData?.nextLevel as string | null) ?? null;

  let isPlatformAdmin = false;
  if (user) {
    const { data: row } = await supabase
      .from("rb_control_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    isPlatformAdmin = !!row;
  }

  const [
    shopsCountRes,
    devicesCountRes,
    tokensCountRes,
    auditRes,
  ] = await Promise.all([
    admin.from("rb_shops").select("id", { count: "exact", head: true }),
    admin.from("rb_devices").select("id", { count: "exact", head: true }),
    admin.from("rb_device_tokens").select("id", { count: "exact", head: true }),
    admin
      .from("rb_audit_log")
      .select("id,created_at,actor_email,action,shop_id,target_type,target_id")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const shopsCount = shopsCountRes.count ?? 0;
  const devicesCount = devicesCountRes.count ?? 0;
  const tokensCount = tokensCountRes.count ?? 0;

  const auditRows = (auditRes.data ?? []) as AuditRow[];

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Control Status</h1>

      <GlassCard title="Session">
        {userErr ? (
          <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>
            auth error: {String((userErr as any)?.message ?? userErr)}
          </div>
        ) : !user ? (
          <div style={{ opacity: 0.8 }}>Not authenticated.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              user: <span style={{ fontWeight: 900 }}>{user.email ?? user.id}</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              platform admin:{" "}
              <span style={{ fontWeight: 900 }}>{isPlatformAdmin ? "yes" : "no"}</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              AAL: <span style={{ fontWeight: 900 }}>{currentAAL}</span>
              {nextAAL ? <span style={{ opacity: 0.7 }}> (next: {nextAAL})</span> : null}
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard title="Counts">
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 180 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Shops</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{shopsCount}</div>
          </div>
          <div style={{ minWidth: 180 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Devices</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{devicesCount}</div>
          </div>
          <div style={{ minWidth: 180 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Device tokens</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{tokensCount}</div>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Recent audit (last 20)">
        {auditRes.error ? (
          <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>
            audit error: {String((auditRes.error as any)?.message ?? auditRes.error)}
          </div>
        ) : auditRows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No audit events found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {auditRows.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>
                    {r.action}
                    {r.shop_id ? <span style={{ fontWeight: 600, opacity: 0.75 }}> • shop {r.shop_id}</span> : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{iso(r.created_at)}</div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  actor: <span style={{ fontWeight: 900 }}>{r.actor_email ?? "—"}</span>
                </div>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  target:{" "}
                  <span style={{ fontWeight: 900 }}>
                    {r.target_type ?? "—"} {r.target_id ?? ""}
                  </span>
                  <span style={{ opacity: 0.65 }}> • event {r.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
