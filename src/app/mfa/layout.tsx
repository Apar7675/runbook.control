// REPLACE ENTIRE FILE: src/app/mfa/layout.tsx

import React from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MfaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user ?? null;

  if (!user) redirect("/login");

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";

  const { data: row } = await supabase
    .from("rb_control_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const isPlatformAdmin = !!row;

  if (!isPlatformAdmin) redirect("/dashboard");
  if (aal === "aal2") redirect("/dashboard");

  return <>{children}</>;
}
