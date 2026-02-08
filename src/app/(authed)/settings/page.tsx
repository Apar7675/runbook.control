import React from "react";
import GlassCard from "@/components/GlassCard";
import NoviceModeToggle from "@/components/NoviceModeToggle";
import EnableMFAClient from "@/components/EnableMFAClient";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const supabase = await supabaseServer();

  const { data: prefs } = await supabase.from("rb_user_prefs").select("*").maybeSingle();
  const noviceDismissed = Boolean((prefs as any)?.novice_dismissed);
  const noviceOn = !noviceDismissed;

  const sp = (await searchParams) ?? {};
  const mfaRequired = sp.mfa === "required";

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Settings</h1>

      <GlassCard title="Security">
        {/* @ts-expect-error server->client */}
        <EnableMFAClient required={mfaRequired} />
      </GlassCard>

      <GlassCard title="Preferences">
        {/* @ts-expect-error server->client */}
        <NoviceModeToggle initialOn={noviceOn} />
      </GlassCard>

      <GlassCard title="About">
        <div style={{ opacity: 0.8 }}>
          RunBook.Control — admin console for shop lifecycle, devices, updates, and audit.
        </div>
      </GlassCard>
    </div>
  );
}
