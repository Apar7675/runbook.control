"use client";

import React from "react";
import FileUpload from "@/components/FileUpload";

export default function PackageUploaderClient() {
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
        Tip: set the version first so uploads land under <code>{channel}/{version || "…"}</code>
      </div>
    </div>
  );
}
