import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShopDevicesPage({ params, searchParams }: Props) {
  const { shopId } = await params;
  const query = (await searchParams) ?? {};
  const returnTo = typeof query.return_to === "string" ? query.return_to : "";
  redirect(returnTo ? `/shops/${shopId}?tab=devices&return_to=${encodeURIComponent(returnTo)}` : `/shops/${shopId}?tab=devices`);
}
