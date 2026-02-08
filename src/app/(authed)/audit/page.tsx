"use client";

import React, { useEffect, useMemo, useState } from "react";
import GlassCard from "@/components/GlassCard";
import { safeFetch } from "@/lib/http/safeFetch";

type AuditRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  shop_id: string | null;
  shop_name?: string | null;
  meta: any | null;
};

type AuditResp = { ok: true; rows: AuditRow[] } | { ok?: false; error?: string };

export const dynamic = "force-dynamic";

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [shopId, setShopId] = useState("");
  const [action, setAction] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [targetId, setTargetId] = useState("");

  const [limit, setLimit] = useState(200);
  const [before, setBefore] = useState<string>("");

  const canLoadMore = useMemo(() => rows.length > 0, [rows]);

  function formatFetchErr(prefix: string, r: any) {
    return `${prefix}: [${r.status}] ${r.error}`;
  }

  function buildQuery(nextBefore?: string) {
    const sp = new URLSearchParams();
    sp.set("limit", String(limit));

    const b = (nextBefore ?? before).trim();
    if (b) sp.set("before", b);

    if (shopId.trim()) sp.set("shop_id", shopId.trim());
    if (action.trim()) sp.set("action", action.trim());
    if (actorEmail.trim()) sp.set("actor_email", actorEmail.trim());
    if (targetId.trim()) sp.set("target_id", targetId.trim());

    return `/api/audit/list?${sp.toString()}`;
  }

  function buildExportUrl() {
    const sp = new URLSearchParams();

    if (shopId.trim()) sp.set("shop", shopId.trim());

    const qParts = [action.trim(), actorEmail.trim(), targetId.trim()].filter(Boolean);
    if (qParts.length) sp.set("q", qParts.join(" "));

    const exportLimit = Math.min(Math.max(limit, 200), 5000);
    sp.set("limit", String(exportLimit));

    return `/api/audit/export?${sp.toString()}`;
  }

  async function load(reset: boolean) {
    setLoading(true);
    setStatus("");

    const url = buildQuery(reset ? "" : undefined);

    const r = await safeFetch<AuditResp>(url, {
      credentials: "include",
      cache: "no-store",
    });

    if (!r.ok) {
      setStatus(formatFetchErr("Audit", r));
      setLoading(false);
      return;
    }

    const j: any = r.data;
    if (!j?.ok) {
      setStatus(j?.error ?? "Failed to load audit log");
      setLoading(false);
      return;
    }

    const next: AuditRow[] = j.rows ?? [];

    if (reset) {
      setRows(next);
      const last = next[next.length - 1];
      setBefore(last?.created_at ?? "");
    } else {
      setRows((prev) => {
        const merged = [...prev, ...next];
        const last = merged[merged.length - 1];
        setBefore(last?.created_at ?? "");
        return merged;
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function prettyMeta(meta: any) {
    if (!meta) return "";
    try {
      return JSON.stringify(meta, null, 2);
    } catch {
      return String(meta);
    }
  }

  function exportCsv() {
    setStatus("");
    window.location.href = buildExportUrl();
  }

  function shopLabel(r: AuditRow) {
    if (r.shop_name && r.shop_name.trim()) return r.shop_name.trim();
    if (r.shop_id) return r.shop_id;
    return "—";
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Audit Log</h1>

        <button
          onClick={exportCsv}
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}
          title="Downloads CSV using /api/audit/export with current filters"
        >
          Export CSV
        </button>
      </div>

      <GlassCard title="Filters">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            placeholder="shop_id (optional)"
            style={{ padding: 10, borderRadius: 12, minWidth: 260 }}
          />
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="action contains (optional)"
            style={{ padding: 10, borderRadius: 12, minWidth: 220 }}
          />
          <input
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
            placeholder="actor email contains (optional)"
            style={{ padding: 10, borderRadius: 12, minWidth: 240 }}
          />
          <input
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="target_id contains (optional)"
            style={{ padding: 10, borderRadius: 12, minWidth: 240 }}
          />

          <select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ padding: 10, borderRadius: 12 }}
          >
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="300">300</option>
            <option value="500">500</option>
          </select>

          <button
            onClick={() => load(true)}
            style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}
            disabled={loading}
          >
            Apply
          </button>

          <button
            onClick={() => {
              setShopId("");
              setAction("");
              setActorEmail("");
              setTargetId("");
              setBefore("");
              load(true);
            }}
            style={{ padding: "10px 14px", borderRadius: 12 }}
            disabled={loading}
          >
            Clear
          </button>
        </div>

        {status ? (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>{status}</div>
        ) : null}
      </GlassCard>

      <GlassCard title={`Events (${rows.length})`}>
        {loading && rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No audit events found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>
                    {r.action}
                    {r.shop_id ? <span style={{ fontWeight: 600, opacity: 0.75 }}> • shop {shopLabel(r)}</span> : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{new Date(r.created_at).toISOString()}</div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  actor: <span style={{ fontWeight: 900 }}>{r.actor_email ?? r.actor_user_id ?? "—"}</span>
                </div>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  target:{" "}
                  <span style={{ fontWeight: 900 }}>
                    {r.target_type ?? "—"} {r.target_id ?? ""}
                  </span>
                  <span style={{ opacity: 0.65 }}> • event {r.id}</span>
                </div>

                {r.meta ? (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.85, fontWeight: 900 }}>meta</summary>
                    <pre style={{ margin: "10px 0 0", fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>
{prettyMeta(r.meta)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={() => load(false)}
            disabled={loading || !canLoadMore}
            style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}
          >
            Load more
          </button>

          <button onClick={() => load(true)} disabled={loading} style={{ padding: "10px 14px", borderRadius: 12 }}>
            Refresh
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
