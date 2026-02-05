"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

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
      // Always go back to login; refresh to re-evaluate authed layout/middleware
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
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.18)",
        background: busy ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)",
        cursor: busy ? "not-allowed" : "pointer",
        fontWeight: 600,
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
