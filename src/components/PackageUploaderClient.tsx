"use client";

import React from "react";
import { controlTheme as t } from "@/components/control/controlTheme";
import FileUpload from "@/components/FileUpload";

type PackageChannel = "stable" | "beta";

const fieldStyle: React.CSSProperties = {
  minHeight: 38,
  padding: "0 11px",
  borderRadius: t.radius.sm,
  border: `1px solid ${t.color.softBorder}`,
  background: "rgba(7, 10, 15, 0.68)",
  color: t.color.text,
  outline: "none",
};

export default function PackageUploaderClient() {
  const [channel, setChannel] = React.useState<PackageChannel>("stable");
  const [version, setVersion] = React.useState("");
  const [notes, setNotes] = React.useState("");

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value === "beta" ? "beta" : "stable")}
          style={{ ...fieldStyle, minWidth: 150 }}
        >
          <option value="stable">stable</option>
          <option value="beta">beta</option>
        </select>

        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="version (e.g. 1.0.0)"
          style={{ ...fieldStyle, minWidth: 220 }}
        />

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="notes (optional)"
          style={{ ...fieldStyle, flex: "1 1 280px" }}
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

      <div style={{ fontSize: 12, color: t.color.textMuted }}>
        Tip: set the version first so uploads land under <code>{channel}/{version || "..."}</code>
      </div>
    </div>
  );
}
