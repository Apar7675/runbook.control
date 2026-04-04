import { redirect } from "next/navigation";
import { resolveOnboardingPathForCurrentUser } from "@/lib/onboarding/flow";

export const dynamic = "force-dynamic";

export default async function OnboardingRoot() {
  const { path } = await resolveOnboardingPathForCurrentUser();
  redirect(path);
}
