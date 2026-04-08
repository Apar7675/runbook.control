import { supabaseAdmin } from "@/lib/supabase/admin";

export type ShopDeleteMode = "hard_delete" | "test_reset";

export type DeletedUserAction = {
  userId: string;
  action: "preserved" | "deleted";
  reason: string;
};

export type ShopDeleteSummary = {
  shopId: string;
  shopName: string;
  mode: ShopDeleteMode;
  deletedUsers: DeletedUserAction[];
  trialResetApplied: boolean;
};

type ShopRecord = {
  id: string;
  name: string;
};

type ShopDeleteInput = {
  actorUserId: string;
  shopId: string;
  confirmName: string;
  mode: ShopDeleteMode;
};

type CandidateUsers = {
  rbShopMemberUserIds: string[];
  legacyShopMemberUserIds: string[];
  employeeAuthUserIds: string[];
};

type UserCleanupDecision = {
  userId: string;
  deleteAuthUser: boolean;
  reason: string;
};

const SHOP_SCOPED_DELETE_TABLES = [
  "chat_blocks",
  "chat_threads",
  "message_reactions",
  "conversations",
  "time_events",
  "time_off_requests",
  "time_off_balances",
  "time_off_policy",
  "timeclock_settings",
  "holiday_calendar",
  "push_tokens",
  "messaging_roster",
  "employee_roles",
  "shop_members",
] as const;

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function isMissingTableError(message: string) {
  const text = String(message ?? "").toLowerCase();
  return text.includes("could not find the table") || text.includes("relation") && text.includes("does not exist");
}

async function deleteByShopId(table: string, shopId: string) {
  const admin = supabaseAdmin();
  const { error } = await admin.from(table).delete().eq("shop_id", shopId);
  if (error) {
    throw new Error(`[${table}] ${error.message}`);
  }
}

async function deleteLegacyBusinessData(shopId: string) {
  const admin = supabaseAdmin();

  const { error: componentsError } = await admin.from("components").delete().eq("shop_id", shopId);
  if (componentsError) {
    throw new Error(`[components] ${componentsError.message}`);
  }

  const { error: purchaseOrdersError } = await admin.from("purchase_orders").delete().eq("shop_id", shopId);
  if (purchaseOrdersError) {
    throw new Error(`[purchase_orders] ${purchaseOrdersError.message}`);
  }
}

async function loadShopOrThrow(shopId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("rb_shops").select("id,name").eq("id", shopId).maybeSingle<ShopRecord>();

  if (error) {
    throw new Error(`[rb_shops] ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("shop not found");
  }

  return data;
}

async function collectCandidateUsers(shopId: string): Promise<CandidateUsers> {
  const admin = supabaseAdmin();

  const [{ data: rbShopMembers, error: rbShopMembersError }, { data: legacyShopMembers, error: legacyShopMembersError }, { data: employees, error: employeesError }] =
    await Promise.all([
      admin.from("rb_shop_members").select("user_id").eq("shop_id", shopId),
      admin.from("shop_members").select("user_id").eq("shop_id", shopId),
      admin.from("employees").select("auth_user_id").eq("shop_id", shopId).not("auth_user_id", "is", null),
    ]);

  if (rbShopMembersError) {
    throw new Error(`[rb_shop_members] ${rbShopMembersError.message}`);
  }
  if (legacyShopMembersError) {
    throw new Error(`[shop_members] ${legacyShopMembersError.message}`);
  }
  if (employeesError) {
    throw new Error(`[employees] ${employeesError.message}`);
  }

  return {
    rbShopMemberUserIds: uniqueStrings((rbShopMembers ?? []).map((row: any) => row.user_id)),
    legacyShopMemberUserIds: uniqueStrings((legacyShopMembers ?? []).map((row: any) => row.user_id)),
    employeeAuthUserIds: uniqueStrings((employees ?? []).map((row: any) => row.auth_user_id)),
  };
}

async function deleteEmployeeRows(shopId: string) {
  const admin = supabaseAdmin();
  const { error } = await admin.from("employees").delete().eq("shop_id", shopId);
  if (error) {
    throw new Error(`[employees] ${error.message}`);
  }
}

async function deleteShopRoot(shopId: string) {
  const admin = supabaseAdmin();
  const { error } = await admin.from("rb_shops").delete().eq("id", shopId);
  if (error) {
    throw new Error(`[rb_shops] ${error.message}`);
  }
}

async function clearTestResetHistory(shopId: string, resetUserIds: string[]) {
  const admin = supabaseAdmin();

  if (resetUserIds.length > 0) {
    const { error: onboardingStateError } = await admin.from("rb_onboarding_state").delete().in("user_id", resetUserIds);
    if (onboardingStateError && !isMissingTableError(onboardingStateError.message)) {
      throw new Error(`[rb_onboarding_state] ${onboardingStateError.message}`);
    }

    const { error: onboardingCodesError } = await admin.from("rb_onboarding_codes").delete().in("user_id", resetUserIds);
    if (onboardingCodesError && !isMissingTableError(onboardingCodesError.message)) {
      throw new Error(`[rb_onboarding_codes] ${onboardingCodesError.message}`);
    }
  }

  const { error: historyError } = await admin.from("rb_trial_usage_history").delete().eq("source_shop_id", shopId);
  if (historyError && !isMissingTableError(historyError.message)) {
    throw new Error(`[rb_trial_usage_history] ${historyError.message}`);
  }
}

async function hasOtherShopLinks(userId: string) {
  const admin = supabaseAdmin();

  const [{ data: controlMembership }, { data: legacyMembership }, { data: employeeLink }, { data: platformAdmin }] = await Promise.all([
    admin.from("rb_shop_members").select("id").eq("user_id", userId).limit(1).maybeSingle(),
    admin.from("shop_members").select("id").eq("user_id", userId).limit(1).maybeSingle(),
    admin.from("employees").select("id").eq("auth_user_id", userId).limit(1).maybeSingle(),
    admin.from("rb_control_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);

  if (platformAdmin?.user_id) {
    return { linked: true, reason: "platform_admin" as const };
  }

  if (controlMembership?.id) {
    return { linked: true, reason: "rb_shop_member" as const };
  }

  if (legacyMembership?.id) {
    return { linked: true, reason: "shop_member" as const };
  }

  if (employeeLink?.id) {
    return { linked: true, reason: "employee_auth_link" as const };
  }

  return { linked: false, reason: "orphaned" as const };
}

async function planAuthUserCleanup(candidateUserIds: string[], mode: ShopDeleteMode) {
  if (mode !== "test_reset") {
    return candidateUserIds.map((userId) => ({
      userId,
      deleteAuthUser: false,
      reason: "hard_delete_preserves_auth_users",
    }));
  }

  const decisions: UserCleanupDecision[] = [];
  for (const userId of candidateUserIds) {
    const linkState = await hasOtherShopLinks(userId);
    decisions.push({
      userId,
      deleteAuthUser: !linkState.linked,
      reason: linkState.linked ? linkState.reason : "orphaned_test_reset_user",
    });
  }

  return decisions;
}

async function applyAuthUserCleanup(decisions: UserCleanupDecision[]) {
  const admin = supabaseAdmin();
  const results: DeletedUserAction[] = [];

  for (const decision of decisions) {
    if (!decision.deleteAuthUser) {
      results.push({
        userId: decision.userId,
        action: "preserved",
        reason: decision.reason,
      });
      continue;
    }

    const { error } = await admin.auth.admin.deleteUser(decision.userId);
    if (error) {
      throw new Error(`[auth.users] ${error.message}`);
    }

    results.push({
      userId: decision.userId,
      action: "deleted",
      reason: decision.reason,
    });
  }

  return results;
}

export async function deleteShopLifecycle(input: ShopDeleteInput): Promise<ShopDeleteSummary> {
  const shop = await loadShopOrThrow(input.shopId);

  if (shop.name !== input.confirmName) {
    throw new Error("confirmation name did not match");
  }

  const candidates = await collectCandidateUsers(input.shopId);
  const candidateUserIds = uniqueStrings([
    ...candidates.rbShopMemberUserIds,
    ...candidates.legacyShopMemberUserIds,
    ...candidates.employeeAuthUserIds,
  ]);

  const admin = supabaseAdmin();
  const { error: auditError } = await admin.from("rb_audit").insert({
    shop_id: input.shopId,
    actor_user_id: input.actorUserId,
    actor_kind: "user",
    action: input.mode === "test_reset" ? "shop.test_reset" : "shop.deleted",
    entity_type: "shop",
    entity_id: input.shopId,
    details: {
      name: shop.name,
      mode: input.mode,
      candidate_user_ids: candidateUserIds,
    },
  });
  if (auditError) {
    throw new Error(`[rb_audit] ${auditError.message}`);
  }

  for (const table of SHOP_SCOPED_DELETE_TABLES) {
    await deleteByShopId(table, input.shopId);
  }

  await deleteLegacyBusinessData(input.shopId);
  await deleteEmployeeRows(input.shopId);
  await deleteShopRoot(input.shopId);

  if (input.mode === "test_reset") {
    await clearTestResetHistory(input.shopId, candidateUserIds);
  }

  const authCleanupPlan = await planAuthUserCleanup(candidateUserIds, input.mode);
  const deletedUsers = await applyAuthUserCleanup(authCleanupPlan);

  return {
    shopId: shop.id,
    shopName: shop.name,
    mode: input.mode,
    deletedUsers,
    trialResetApplied: input.mode === "test_reset",
  };
}
