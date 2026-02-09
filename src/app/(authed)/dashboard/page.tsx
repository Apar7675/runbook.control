import React from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        background: "rgba(255,255,255,0.03)",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.4, fontWeight: 900 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  shop_id: string | null;
  shop_name?: string | null;
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

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user ?? null;
  const email = user?.email ?? "—";

  const admin = supabaseAdmin();

  const [shopsCountRes, devicesCountRes, tokensCountRes, auditRes] = await Promise.all([
    admin.from("rb_shops").select("id", { count: "exact", head: true }),
    admin.from("rb_devices").select("id", { count: "exact", head: true }),
    admin.from("rb_device_tokens").select("id", { count: "exact", head: true }),
    admin
      .from("rb_audit_log")
      .select("id,created_at,actor_email,action,shop_id,target_type,target_id,rb_shops(name)")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const shopsCount = shopsCountRes.count ?? 0;
  const devicesCount = devicesCountRes.count ?? 0;
  const tokensCount = tokensCountRes.count ?? 0;

  const auditRows: AuditRow[] = (auditRes.data ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    actor_email: r.actor_email ?? null,
    action: r.action,
    shop_id: r.shop_id ?? null,
    shop_name: r?.rb_shops?.name ?? null,
    target_type: r.target_type ?? null,
    target_id: r.target_id ?? null,
  }));

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <h1 style={{ margin: 0 }}>Platform Overview</h1>

      <Card title="Session">
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Signed in as <span style={{ fontWeight: 900 }}>{email}</span> ·{" "}
          <span style={{ fontWeight: 900 }}>Platform Control</span>
        </div>
      </Card>

      <Card title="Counts">
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
      </Card>

      <Card title="Recent platform activity">
        {auditRes.error ? (
          <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: "pre-wrap" }}>
            Unable to load recent activity.
          </div>
        ) : auditRows.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.8 }}>No audit events yet.</div>
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
                    {r.shop_id ? (
                      <span style={{ fontWeight: 600, opacity: 0.75 }}>
                        {" "}
                        • {r.shop_name ?? r.shop_id}
                      </span>
                    ) : null}
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
      </Card>
    </div>
  );
}
