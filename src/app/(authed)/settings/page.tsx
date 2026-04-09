import React from "react";
import { PageHeader, SectionBlock } from "@/components/control/ui";
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

  const sp = searchParams ?? {};
  const mfaRequired = sp.mfa === "required";

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Keep this page simple: security first, preferences second, and product context last."
      />

      <SectionBlock title="Security" description="Protect Control access before changing anything else.">
        <EnableMFAClient required={mfaRequired} />
      </SectionBlock>

      <SectionBlock title="Preferences" description="Choose how much guidance Control should show by default.">
        <NoviceModeToggle initialOn={noviceOn} />
      </SectionBlock>

      <SectionBlock title="About" description="A short reminder of what Control is for.">
        <div style={{ opacity: 0.8 }}>
          RunBook.Control - admin console for shop lifecycle, devices, updates, and audit.
        </div>
      </SectionBlock>
    </div>
  );
}
