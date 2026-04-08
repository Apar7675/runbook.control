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
      router.replace("/login");
      router.refresh();
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} className="rb-button rb-button--ghost">
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
