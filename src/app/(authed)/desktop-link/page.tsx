import Link from "next/link";
import React from "react";
import { supabaseServer } from "@/lib/supabase/server";
import GlassCard from "@/components/GlassCard";

export const dynamic = "force-dynamic";

export default async function DesktopLinkPage() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const accessToken = session?.access_token ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 980 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Desktop Link</h1>
        <div style={{ opacity: 0.78 }}>
          Copy this session token into RunBook Desktop Settings so Desktop can call Control bootstrap and provisioning APIs.
        </div>
      </div>

      <GlassCard title="Current Session">
        <div style={{ display: "grid", gap: 12 }}>
          <div><b>User:</b> {user?.email ?? "Unknown"}</div>
          <div><b>Control Base URL:</b> {baseUrl}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            In Desktop, go to Settings, paste the base URL into <b>Control Base URL</b> and paste the token below into <b>Control Access Token</b>.
          </div>
          <textarea
            readOnly
            value={accessToken}
            style={{
              width: "100%",
              minHeight: 180,
              resize: "vertical",
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.04)",
              color: "#e6e8ef",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          />
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            This is a live bearer token for your current session. Treat it like a password.
          </div>
        </div>
      </GlassCard>

      <GlassCard title="How To Link">
        <div style={{ display: "grid", gap: 8, lineHeight: 1.5 }}>
          <div>1. Keep Control open and signed in.</div>
          <div>2. Copy the token from this page.</div>
          <div>3. In Desktop Settings, paste:</div>
          <div>Base URL: <code>{baseUrl}</code></div>
          <div>Control Access Token: the token from above</div>
          <div>4. Click <b>Link To Control</b>.</div>
          <div>5. Desktop will create or link the shop and store the returned <code>ShopId</code>.</div>
        </div>
      </GlassCard>

      <div style={{ fontSize: 12, opacity: 0.72 }}>
        Back to <Link href="/shops">All Shops</Link>
      </div>
    </div>
  );
}
