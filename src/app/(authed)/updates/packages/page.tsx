import React from "react";
import GlassCard from "@/components/GlassCard";
import FileUpload from "@/components/FileUpload";
import { supabaseServer } from "@/lib/supabase/server";

export default async function UpdatePackagesPage() {
  const supabase = await supabaseServer();

  const { data: pkgs, error } = await supabase
    .from("rb_update_packages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Update Packages</h1>

      <GlassCard title="Upload Package">
        <PackageUploader />
      </GlassCard>

      <GlassCard title="Existing Packages">
        {pkgs.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No packages uploaded yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {pkgs.map((p: any) => (
              <div
                key={p.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontWeight: 900 }}>
                  {p.channel} — {p.version}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Path: <code>{p.file_path}</code>
                </div>
                {p.notes ? (
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    {p.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

/* -------- client uploader -------- */

function PackageUploader() {
  // @ts-expect-error server -> client boundary
  return <PackageUploaderClient />;
}

function PackageUploaderClient() {
  "use client";

  const [channel, setChannel] = React.useState<"stable" | "beta">("stable");
  const [version, setVersion] = React.useState("");
  const [notes, setNotes] = React.useState("");

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as any)}
          style={{ padding: 10, borderRadius: 12, minWidth: 160 }}
        >
          <option value="stable">stable</option>
          <option value="beta">beta</option>
        </select>

        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="version (e.g. 1.0.0)"
          style={{ padding: 10, borderRadius: 12, minWidth: 220 }}
        />

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="notes (optional)"
          style={{ padding: 10, borderRadius: 12, minWidth: 320 }}
        />
      </div>

      <FileUpload
        bucket="rb-updates"
        pathPrefix={`${channel}/${version || "unversioned"}`}
        accept=".zip,application/zip"
        label="Choose ZIP to upload"
        onUploaded={async ({ path }) => {
          await fetch("/api/updates/package", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel,
              version,
              notes: notes || null,
              path,
            }),
          });

          window.location.reload();
        }}
      />

      <div style={{ fontSize: 12, opacity: 0.65 }}>
        Tip: set the version first so uploads land under{" "}
        <code>{channel}/{version || "…"}</code>
      </div>
    </div>
  );
}
