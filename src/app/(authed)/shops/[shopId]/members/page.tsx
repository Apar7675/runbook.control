import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopMembersRedirect({ params }: Props) {
  const { shopId } = await params;
  redirect(`/shops/${shopId}`);
}
