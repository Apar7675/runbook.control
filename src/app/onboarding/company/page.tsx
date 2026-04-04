import { redirect } from "next/navigation";
import CompanyOnboardingClient from "@/components/onboarding/CompanyOnboardingClient";
import { requireOnboardingRouteForCurrentUser } from "@/lib/onboarding/flow";

export const dynamic = "force-dynamic";

export default async function CompanyOnboardingPage() {
  const { redirectTo } = await requireOnboardingRouteForCurrentUser("/onboarding/company");
  if (redirectTo) {
    redirect(redirectTo);
  }

  return <CompanyOnboardingClient />;
}
