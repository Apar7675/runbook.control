// REPLACE ENTIRE FILE: src/app/(authed)/dashboard/page.tsx

import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user ?? null;

  const email = user?.email ?? "";

  // Recent shops: keep your existing membership model (RLS should allow this)
  const { data: shops, error: shopsErr } = await supabase
    .from("rb_shops")
    .select("id,name,created_at")
    .order("created_at", { ascending: false })
    .limit(6);

  // Recent devices: use service role because rb_devices is locked down
  let devices: any[] = [];
  try {
    const admin = supabaseAdmin();
    const { data: devs, error: devErr } = await admin
      .from("rb_devices")
      .select("id,name,status,created_at")
      .order("created_at", { ascending: false })
      .limit(6);

    if (!devErr) devices = devs ?? [];
  } catch {
    // If service key missing, dashboard still renders; devices panel will be empty.
    devices = [];
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <h1 style={{ margin: 0 }}>Dashboard</h1>

      <Card title="Signed in">
        <div style={{ fontWeight: 900, fontSize: 16 }}>{email || "—"}</div>
      </Card>

      <Card title="Recent">
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>SHOPS</div>
            {shopsErr ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Unable to load shops.</div>
            ) : (shops ?? []).length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>No shops yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                {(shops ?? []).slice(0, 2).map((s: any) => (
                  <div
                    key={s.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{s.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>Shop ID: {String(s.id).slice(0, 8)}…</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>DEVICES</div>
            {devices.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                No devices yet (or service key not configured).
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                {devices.slice(0, 1).map((d: any) => (
                  <div
                    key={d.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{d.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>
                      Status: {d.status} • {String(d.id).slice(0, 8)}…
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="All pages">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          {[
            { title: "Shops", href: "/shops", desc: "Create/manage shops (top-level container)." },
            { title: "Create Shop", href: "/shops/new", desc: "Start a new shop (bootstrap admin + policy)." },
            { title: "Devices", href: "/devices", desc: "Register devices, tokens, disable/delete." },
            { title: "Updates", href: "/updates", desc: "Set policy per shop (stable/beta/min/pinned)." },
            { title: "Audit Log", href: "/audit", desc: "Everything that happened (filter + export)." },
            { title: "Settings", href: "/settings", desc: "Preferences, novice mode toggle." },
          ].map((x) => (
            <Link
              key={x.href}
              href={x.href}
              style={{
                textDecoration: "none",
                color: "#e6e8ef",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: 14,
                background: "rgba(255,255,255,0.02)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 900 }}>{x.title}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{x.desc}</div>
              <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 900 }}>Open →</div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
