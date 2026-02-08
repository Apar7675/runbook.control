import React from "react";
import GlassCard from "@/components/GlassCard";
import { supabaseServer } from "@/lib/supabase/server";
import PackageUploaderClient from "@/components/PackageUploaderClient";

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
        <PackageUploaderClient />
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
                {p.notes ? <div style={{ marginTop: 6, opacity: 0.85 }}>{p.notes}</div> : null}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
