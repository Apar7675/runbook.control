"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[signout] error", error);
      }
    } finally {
      router.replace("/login");
      router.refresh();
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      style={{
        minHeight: 30,
        padding: "5px 10px",
        borderRadius: t.radius.sm,
        border: `1px solid ${t.color.border}`,
        background: busy ? t.color.surfaceMuted : t.color.surfaceAlt,
        color: t.color.text,
        cursor: busy ? "not-allowed" : "pointer",
        fontWeight: 700,
        fontSize: 12,
        opacity: busy ? 0.84 : 1,
      }}
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
