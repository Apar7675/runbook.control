import { getViewerContext as getCompanyViewer } from "@/lib/control/summary";
import { notFound as companyNotFound } from "next/navigation";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopAuditPage({ params }: Props) {
  const { shopId } = await params;
  const companyViewer = await getCompanyViewer();
  if (!companyViewer.shops.some((company) => company.id === shopId)) companyNotFound();
  redirect(`/shops/${shopId}?tab=activity`);
}
