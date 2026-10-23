import React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isPlatformAdmin } from "@/lib/authz";
import { CONTROL_REQUEST_PATH_HEADER, mfaReturnFromRequestPath } from "@/lib/auth/mfaReturn";
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

  if (!(await isPlatformAdmin(user.id))) redirect("/restricted");
  if (aal === "aal2") {
    const requestHeaders = await headers();
    redirect(mfaReturnFromRequestPath(requestHeaders.get(CONTROL_REQUEST_PATH_HEADER)));
  }

  return <>{children}</>;
}
