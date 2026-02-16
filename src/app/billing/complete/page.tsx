// CREATE NEW FILE: src/app/billing/complete/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type SyncResp =
  | { ok: true; shop?: { id: string; name?: string | null; billing_status?: string | null } }
  | { ok: false; error?: string };

export default function BillingCompletePage() {
  const params = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    []
  );

  const shop_id = params.get("shop_id") ?? "";
  const session_id = params.get("session_id") ?? "";

  const [state, setState] = useState<"working" | "ok" | "err">("working");
  const [msg, setMsg] = useState<string>("Finalizing your trial…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!shop_id || !session_id) {
          setState("err");
          setMsg("Missing shop_id or session_id in URL.");
          return;
        }

        const res = await fetch("/api/billing/sync-from-checkout-return", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shop_id, session_id }),
        });

        const json = (await res.json().catch(() => ({}))) as SyncResp;
        if (cancelled) return;

        if (!res.ok || !json || (json as any).ok !== true) {
          const err = (json as any)?.error ? String((json as any).error) : `Sync failed (${res.status})`;
          setState("err");
          setMsg(err);
          return;
        }

        const bs = (json as any)?.shop?.billing_status ? String((json as any).shop.billing_status) : "active";
        setState("ok");
        setMsg(`✅ Trial started (${bs}). You can close this tab and return to RunBook Desktop.`);
      } catch (e: any) {
        if (cancelled) return;
        setState("err");
        setMsg(String(e?.message ?? e));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [shop_id, session_id]);

  return (
    <div style={{ minHeight: "100vh", background: "#07081a", color: "rgba(255,255,255,0.92)", padding: 24 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", paddingTop: 40 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>RunBook Billing</h1>
        <p style={{ opacity: 0.8, marginTop: 10 }}>{msg}</p>

        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {state === "working" && <div style={{ fontWeight: 900 }}>Working…</div>}
          {state === "ok" && <div style={{ fontWeight: 900 }}>Complete</div>}
          {state === "err" && <div style={{ fontWeight: 900 }}>Needs attention</div>}
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Desktop checkout does not automatically sign your browser into Control. This page finalizes activation.
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => window.close()}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              fontWeight: 900,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Close this tab
          </button>

          <a
            href="/login"
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(120,90,255,0.35)",
              border: "1px solid rgba(170,160,255,0.35)",
              color: "white",
              textDecoration: "none",
              fontWeight: 900,
              fontSize: 12,
            }}
          >
            Open Control (login)
          </a>
        </div>
      </div>
    </div>
  );
}
