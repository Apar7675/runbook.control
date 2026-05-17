"use client";

import { useState } from "react";
import { controlTheme as t } from "@/components/control/controlTheme";
import { supabaseBrowser } from "@/lib/supabase/client";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

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
    } catch (e: unknown) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        border: `1px solid ${t.color.softBorder}`,
        background: "rgba(7, 10, 15, 0.34)",
        borderRadius: t.radius.md,
        padding: 12,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13, color: t.color.text }}>{label}</div>

      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
        style={{ color: t.color.textSecondary, fontSize: 12.5 }}
      />

      {busy ? <div style={{ fontSize: 12, color: t.color.textMuted }}>Uploading...</div> : null}
      {msg ? <div style={{ fontSize: 12, color: t.color.textSecondary }}>{msg}</div> : null}
    </div>
  );
}
