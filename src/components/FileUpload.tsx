"use client";

import React, { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function FileUpload({
  bucket,
  pathPrefix,
  onUploaded,
  accept,
  label,
}: {
  bucket: "rb-updates" | "rb-support-bundles";
  pathPrefix: string; // e.g. "stable/1.2.3" or "shop/<id>"
  accept?: string;
  label: string;
  onUploaded: (args: { path: string }) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);

    try {
      const supabase = supabaseBrowser();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${pathPrefix}/${Date.now()}_${safeName}`;

      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

      if (error) {
        setMsg(error.message);
        setBusy(false);
        return;
      }

      await onUploaded({ path });
      setMsg(`Uploaded: ${path}`);
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 8 }}>{label}</div>

      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />

      {busy ? <div style={{ marginTop: 10, opacity: 0.8 }}>Uploading…</div> : null}
      {msg ? <div style={{ marginTop: 10, opacity: 0.85 }}>{msg}</div> : null}
    </div>
  );
}
