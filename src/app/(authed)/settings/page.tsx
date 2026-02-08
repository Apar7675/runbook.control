import React from "react";
import GlassCard from "@/components/GlassCard";
import NoviceModeToggle from "@/components/NoviceModeToggle";
import EnableMFAClient from "@/components/EnableMFAClient";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Record<string, string>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await supabaseServer();

  const { data: prefs } = await supabase.from("rb_user_prefs").select("*").maybeSingle();
  const noviceDismissed = Boolean((prefs as any)?.novice_dismissed);
  const noviceOn = !noviceDismissed;

  // Keep your current behavior: allow querystring override
  const sp = searchParams ?? {};
  const mfaRequired = sp.mfa === "required";

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Settings</h1>

      <GlassCard title="Security">
        <EnableMFAClient required={mfaRequired} />
      </GlassCard>

      <GlassCard title="Preferences">
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
