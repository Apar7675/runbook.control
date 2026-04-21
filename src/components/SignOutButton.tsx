"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { theme } from "@/lib/ui/theme";

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
        minHeight: 40,
        padding: "9px 14px",
        borderRadius: theme.radius.md,
        border: "1px solid rgba(255,255,255,0.12)",
        background: busy
          ? "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.05))"
          : "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04))",
        color: theme.text.primary,
        boxShadow: theme.shadow.button,
        cursor: busy ? "not-allowed" : "pointer",
        fontWeight: 800,
        letterSpacing: 0.14,
        opacity: busy ? 0.84 : 1,
      }}
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
