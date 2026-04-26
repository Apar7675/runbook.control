import { supabaseAdmin } from "@/lib/supabase/admin";

function text(value: unknown) {
  return String(value ?? "").trim();
}

type ShopAuthUserSummary = {
  user_id: string;
  email: string | null;
  shop_membership_count: number;
  other_shop_count: number;
  employee_count_in_shop: number;
  only_this_shop: boolean;
};

export async function getShopAuthUsers(shopId: string) {
  const admin = supabaseAdmin();

  const [memberRows, employeeRows, onboardingRows] = await Promise.all([
    admin.from("rb_shop_members").select("user_id").eq("shop_id", shopId),
    admin.from("employees").select("auth_user_id").eq("shop_id", shopId).not("auth_user_id", "is", null),
    admin.from("rb_onboarding_state").select("user_id").eq("shop_id", shopId),
  ]);

  if (memberRows.error) throw new Error(memberRows.error.message);
  if (employeeRows.error) throw new Error(employeeRows.error.message);
  if (onboardingRows.error) throw new Error(onboardingRows.error.message);

  const candidateIds = new Set<string>();

  for (const row of memberRows.data ?? []) {
    const value = text((row as any).user_id);
    if (value) candidateIds.add(value);
  }

  for (const row of employeeRows.data ?? []) {
    const value = text((row as any).auth_user_id);
    if (value) candidateIds.add(value);
  }

  for (const row of onboardingRows.data ?? []) {
    const value = text((row as any).user_id);
    if (value) candidateIds.add(value);
  }

  const userIds = [...candidateIds];
  if (userIds.length === 0) {
    return {
      all: [] as ShopAuthUserSummary[],
      only_this_shop: [] as ShopAuthUserSummary[],
      multiple_shops: [] as ShopAuthUserSummary[],
    };
  }

  const [allMemberships, shopEmployees] = await Promise.all([
    admin.from("rb_shop_members").select("shop_id,user_id").in("user_id", userIds),
    admin.from("employees").select("shop_id,auth_user_id").eq("shop_id", shopId).in("auth_user_id", userIds),
  ]);

  if (allMemberships.error) throw new Error(allMemberships.error.message);
  if (shopEmployees.error) throw new Error(shopEmployees.error.message);

  const membershipMap = new Map<string, Set<string>>();
  for (const row of allMemberships.data ?? []) {
    const userId = text((row as any).user_id);
    const membershipShopId = text((row as any).shop_id);
    if (!userId || !membershipShopId) continue;
    const bucket = membershipMap.get(userId) ?? new Set<string>();
    bucket.add(membershipShopId);
    membershipMap.set(userId, bucket);
  }

  const employeeCountMap = new Map<string, number>();
  for (const row of shopEmployees.data ?? []) {
    const userId = text((row as any).auth_user_id);
    if (!userId) continue;
    employeeCountMap.set(userId, (employeeCountMap.get(userId) ?? 0) + 1);
  }

  const emailMap = new Map<string, string | null>();
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);

    const users = (data as any)?.users ?? [];
    for (const user of users) {
      const id = text(user?.id);
      if (!id || !candidateIds.has(id)) continue;
      emailMap.set(id, text(user?.email) || null);
    }

    if (users.length < 200) break;
  }

  const all = userIds.map((userId) => {
    const memberships = membershipMap.get(userId) ?? new Set<string>();
    const otherShopCount = [...memberships].filter((memberShopId) => memberShopId !== shopId).length;
    return {
      user_id: userId,
      email: emailMap.get(userId) ?? null,
      shop_membership_count: memberships.size,
      other_shop_count: otherShopCount,
      employee_count_in_shop: employeeCountMap.get(userId) ?? 0,
      only_this_shop: memberships.size <= 1 && otherShopCount === 0,
    };
  });

  return {
    all,
    only_this_shop: all.filter((row) => row.only_this_shop),
    multiple_shops: all.filter((row) => !row.only_this_shop),
  };
}
