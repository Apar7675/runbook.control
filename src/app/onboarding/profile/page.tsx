import { redirect } from "next/navigation";
import ProfileOnboardingClient from "@/components/onboarding/ProfileOnboardingClient";
import { requireOnboardingRouteForCurrentUser } from "@/lib/onboarding/flow";

export const dynamic = "force-dynamic";

export default async function ProfileOnboardingPage() {
  const { redirectTo } = await requireOnboardingRouteForCurrentUser("/onboarding/profile");
  if (redirectTo) {
    redirect(redirectTo);
  }

  return <ProfileOnboardingClient />;
}
