import React from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { getOnboardingState } from "@/lib/onboarding/state";
import { RunbookCard, RunbookContainer, RunbookSectionHeader } from "@/components/runbook/primitives";
import { runbookTheme } from "@/lib/ui/runbookTheme";

export const dynamic = "force-dynamic";

export default async function OnboardingCompletePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const state = user?.id ? await getOnboardingState(user.id) : null;
  const shopName = state?.shop_name?.trim() || null;

  return (
    <RunbookContainer maxWidth={760}>
      <RunbookSectionHeader
        eyebrow="RunBook Setup"
        title="You're all set"
        subtitle="Your shop has been created successfully."
      />

      <RunbookCard
        title="Setup complete"
        subtitle={
          shopName
            ? `Your shop "${shopName}" is ready. Return to RunBook Desktop to start using your system.`
            : "Return to RunBook Desktop to start using your system."
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          {shopName ? (
            <div style={{ color: runbookTheme.colors.text, fontSize: 13, fontWeight: 600 }}>
              Shop: {shopName}
            </div>
          ) : null}
          <div style={{ color: runbookTheme.colors.muted, fontSize: 12, lineHeight: 1.55 }}>
            This web setup is complete. Continue in RunBook Desktop to finish working in your shop environment.
          </div>
        </div>
      </RunbookCard>
    </RunbookContainer>
  );
}
