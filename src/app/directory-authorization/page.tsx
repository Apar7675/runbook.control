import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import DirectoryAuthorizationClient from "./DirectoryAuthorizationClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Access configuration only; no customer/vendor records or admin-role override.
export default async function DirectoryAuthorizationPage() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous === true) redirect("/login?next=/directory-authorization");
  return <DirectoryAuthorizationClient expectedUserId={data.user.id} />;
}
