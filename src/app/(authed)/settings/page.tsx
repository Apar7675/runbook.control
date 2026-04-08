import React from "react";
import NoviceModeToggle from "@/components/NoviceModeToggle";
import EnableMFAClient from "@/components/EnableMFAClient";
import { NoteList, PageHeader, SectionBlock } from "@/components/control/ui";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await supabaseServer();
  const { data: prefs } = await supabase.from("rb_user_prefs").select("*").maybeSingle();
  const noviceDismissed = Boolean((prefs as any)?.novice_dismissed);
  const noviceOn = !noviceDismissed;
  const sp = (await searchParams) ?? {};
  const mfaRequired = sp.mfa === "required";

  return (
    <div className="rb-page">
      <PageHeader eyebrow="Settings" title="Settings" description="Security, preferences, and admin posture live here with the same high-readability structure used across Control." />
      <SectionBlock title="Security" description="High-risk account controls should stay clear and visually separated.">
        <EnableMFAClient required={mfaRequired} />
      </SectionBlock>
      <SectionBlock title="Preferences" description="Keep everyday admin preferences easy to scan and quick to adjust.">
        <NoviceModeToggle initialOn={noviceOn} />
      </SectionBlock>
      <SectionBlock title="RunBook Posture" description="Control should read like part of the RunBook product family, not a separate admin utility.">
        <NoteList
          items={[
            "Control is the premium command surface for shop lifecycle, devices, updates, billing authority, security, and audit.",
            "Shared shell, cards, spacing, and status language now govern this page the same way they govern the rest of Control.",
            "Future polish can deepen settings content, but it should not create its own styling vocabulary again.",
          ]}
        />
      </SectionBlock>
    </div>
  );
}
