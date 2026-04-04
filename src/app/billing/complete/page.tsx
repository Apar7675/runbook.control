"use client";

import React, { useEffect, useState } from "react";

type SyncResp =
  | { ok: true; shop?: { id: string; name?: string | null; billing_status?: string | null }; entitlement?: { status: string; allowed: boolean; restricted: boolean; reason: string; grace_active: boolean } }
  | { ok: false; error?: string };

export default function BillingCompletePage() {
  const [paramsReady, setParamsReady] = useState(false);
  const [shopId, setShopId] = useState("");
  const [sessionId, setSessionId] = useState("");

  const [state, setState] = useState<"working" | "ok" | "err">("working");
  const [msg, setMsg] = useState<string>("Finalizing your trial...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShopId(params.get("shop_id") ?? "");
    setSessionId(params.get("session_id") ?? "");
    setParamsReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!paramsReady) return;
        if (!shopId || !sessionId) {
          setState("err");
          setMsg("Missing shop_id or session_id in URL.");
          return;
        }

        const res = await fetch("/api/billing/sync-from-checkout-return", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shop_id: shopId, session_id: sessionId }),
        });

        const json = (await res.json().catch(() => ({}))) as SyncResp;
        if (cancelled) return;

        if (!res.ok || !json || (json as any).ok !== true) {
          const err = (json as any)?.error ? String((json as any).error) : `Sync failed (${res.status})`;
          setState("err");
          setMsg(err);
          return;
        }

        const lifecycle = (json as any)?.shop?.billing_status ? String((json as any).shop.billing_status) : "unknown";
        setState("ok");
        setMsg(`Checkout synced. Lifecycle=${lifecycle}. You can close this tab and return to RunBook Desktop.`);
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
  }, [paramsReady, shopId, sessionId]);

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
          {state === "working" && <div style={{ fontWeight: 900 }}>Working...</div>}
          {state === "ok" && <div style={{ fontWeight: 900 }}>Complete</div>}
          {state === "err" && <div style={{ fontWeight: 900 }}>Needs attention</div>}
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Desktop checkout does not automatically sign your browser into Control. This page finalizes activation.
          </div>
        </div>
      </div>
    </div>
  );
}
