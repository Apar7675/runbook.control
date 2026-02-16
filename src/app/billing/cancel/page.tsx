// CREATE NEW FILE: src/app/billing/cancel/page.tsx
"use client";

import React from "react";

export default function BillingCancelPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#07081a", color: "rgba(255,255,255,0.92)", padding: 24 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", paddingTop: 40 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>RunBook Billing</h1>
        <p style={{ opacity: 0.8, marginTop: 10 }}>Checkout was canceled. No charges were made.</p>

        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div style={{ fontWeight: 900 }}>Canceled</div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Close this tab and return to RunBook Desktop to try again.
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
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
        </div>
      </div>
    </div>
  );
}
