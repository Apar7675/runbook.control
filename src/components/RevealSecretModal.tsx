"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function b64DecodeJson<T>(b64: string): T | null {
  try {
    const json = atob(b64);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export default function RevealSecretModal() {
  const sp = useSearchParams();
  const router = useRouter();

  const revealParam = sp.get("reveal") ?? "";
  const payload = useMemo(() => b64DecodeJson<any>(revealParam), [revealParam]);

  const [open, setOpen] = useState(!!payload);
  const [copied, setCopied] = useState<string | null>(null);

  // Immediately remove ?reveal= from URL after we render once
  useEffect(() => {
    if (!payload) return;
    // remove query param without navigation history pollution
    const url = new URL(window.location.href);
    url.searchParams.delete("reveal");
    window.history.replaceState({}, "", url.toString());
  }, [payload]);

  if (!payload || !open) return null;

  const deviceKey = String(payload.deviceKeyPlain ?? "");
  const activation = String(payload.activationPlain ?? "");
  const deviceId = String(payload.device_id ?? "");
  const shopId = String(payload.shop_id ?? "");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
        padding: 18,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 760,
          maxWidth: "100%",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(10,12,20,0.92)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#9fa3ff" }}>
            One-time Device Secrets (copy now)
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 800 }}
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          These values are shown once. If you lose them, you regenerate by creating a new activation token.
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Device ID: <code>{deviceId}</code> &nbsp; Shop ID: <code>{shopId}</code>
          </div>

          <Field
            label="Device Key (store on device securely)"
            value={deviceKey}
            onCopy={async () => {
              await copy(deviceKey);
              setCopied("Device Key copied");
              setTimeout(() => setCopied(null), 1200);
            }}
          />

          <Field
            label="Activation Token (one-time)"
            value={activation}
            onCopy={async () => {
              await copy(activation);
              setCopied("Activation Token copied");
              setTimeout(() => setCopied(null), 1200);
            }}
          />

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Device activation call:
            <div style={{ marginTop: 6 }}>
              <code style={{ display: "block", whiteSpace: "pre-wrap" }}>
                {`POST /api/device/activate
Content-Type: application/json

{"token":"${activation.slice(0, 18)}..."}
`}
              </code>
            </div>
          </div>

          {copied ? (
            <div style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
              {copied}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <code style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</code>
        <button type="button" onClick={onCopy} style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 900 }}>
          Copy
        </button>
      </div>
    </div>
  );
}
