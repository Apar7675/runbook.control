import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import GlassCard from "@/components/GlassCard";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  created_at: string;
  shop_id: string | null;
  shop_name?: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  meta: any;
};

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

function buildUrl(base: string, sp: URLSearchParams) {
  const q = sp.toString();
  return q ? `${base}?${q}` : base;
}

async function getBaseUrlFromHeaders() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function rbFetchJson(absUrl: string) {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const res = await fetch(absUrl, {
    cache: "no-store",
    headers: {
      // forward auth cookies so requirePlatformAdminAal2() works
      cookie,
    },
  });

  const txt = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(txt) };
  } catch {
    return { ok: res.ok, status: res.status, data: { ok: false, error: txt } };
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const spIn = await searchParams;

  const sp = new URLSearchParams();

  // Match your API route query params:
  // limit, before, shop_id, action, actor_email, target_id
  const limit = typeof spIn.limit === "string" ? spIn.limit : "";
  const before = typeof spIn.before === "string" ? spIn.before : "";
  const shop_id = typeof spIn.shop_id === "string" ? spIn.shop_id : "";
  const action = typeof spIn.action === "string" ? spIn.action : "";
  const target_id = typeof spIn.target_id === "string" ? spIn.target_id : "";
  const actor_email = typeof spIn.actor_email === "string" ? spIn.actor_email : "";

  if (limit) sp.set("limit", limit);
  if (before) sp.set("before", before);
  if (shop_id) sp.set("shop_id", shop_id);
  if (action) sp.set("action", action);
  if (target_id) sp.set("target_id", target_id);
  if (actor_email) sp.set("actor_email", actor_email);

  const base = await getBaseUrlFromHeaders();
  const listUrlAbs = buildUrl(`${base}/api/audit/list`, sp);

  // Export is a normal browser download; keep it relative (browser has cookies)
  const exportUrlRel = buildUrl(`/api/audit/export`, sp);

  const r = await rbFetchJson(listUrlAbs);
  const payload: any = r.data;

  const rows: AuditRow[] = payload?.ok ? (payload.rows ?? []) : [];

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Audit Log</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={exportUrlRel}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              color: "#e6e8ef",
              fontWeight: 900,
            }}
          >
            Export CSV →
          </Link>
        </div>
      </div>

      <GlassCard title="Filters">
        <form style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input name="shop_id" defaultValue={shop_id} placeholder="shop_id (uuid)" style={{ padding: "10px 12px", borderRadius: 12 }} />
            <input name="action" defaultValue={action} placeholder="action (e.g. device_token.issue)" style={{ padding: "10px 12px", borderRadius: 12 }} />
            <input name="target_id" defaultValue={target_id} placeholder="target_id (device/token uuid)" style={{ padding: "10px 12px", borderRadius: 12 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input name="actor_email" defaultValue={actor_email} placeholder="actor_email" style={{ padding: "10px 12px", borderRadius: 12 }} />
            <input name="before" defaultValue={before} placeholder="before (ISO) pagination" style={{ padding: "10px 12px", borderRadius: 12 }} />
            <input name="limit" defaultValue={limit || "200"} placeholder="limit (max 500)" style={{ padding: "10px 12px", borderRadius: 12 }} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
              Apply
            </button>
            <Link
              href="/audit"
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                color: "#e6e8ef",
                fontWeight: 900,
              }}
            >
              Clear
            </Link>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Export uses the same filters.</div>
          </div>
        </form>
      </GlassCard>

      <GlassCard title={`Events (${rows.length})`}>
        {!r.ok || !payload?.ok ? (
          <div style={{ opacity: 0.85, fontSize: 12 }}>
            {`Failed to load audit: ${payload?.error ?? `HTTP ${r.status}`}`}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No audit events found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  {["Time", "Shop", "Action", "Target", "Actor", "Meta"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 10px",
                        fontSize: 12,
                        opacity: 0.8,
                        borderBottom: "1px solid rgba(255,255,255,0.10)",
                        position: "sticky",
                        top: 0,
                        background: "rgba(10,12,18,0.85)",
                        backdropFilter: "blur(6px)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const target = `${a.target_type ?? "—"}:${shortId(a.target_id)}`;
                  const actor = a.actor_email ?? shortId(a.actor_user_id);
                  return (
                    <tr key={a.id}>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                        <div style={{ fontWeight: 900 }}>{iso(a.created_at)}</div>
                        <div style={{ opacity: 0.65 }}>id: {shortId(a.id)}</div>
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                        {a.shop_id ? (
                          <Link href={`/shops/${a.shop_id}`} style={{ color: "#cfd0ff", textDecoration: "none", fontWeight: 900 }}>
                            {a.shop_name ?? shortId(a.shop_id)}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {a.shop_id ? <div style={{ opacity: 0.6, fontSize: 11 }}>{shortId(a.shop_id)}</div> : null}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                        {a.action}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                        {a.target_id ? (
                          <Link href={`/audit?target_id=${encodeURIComponent(a.target_id)}`} style={{ color: "#e6e8ef", textDecoration: "none" }}>
                            {target}
                          </Link>
                        ) : (
                          target
                        )}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                        {actor}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", opacity: 0.85 }}>
                          {a.meta ? JSON.stringify(a.meta, null, 2) : "—"}
                        </pre>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
