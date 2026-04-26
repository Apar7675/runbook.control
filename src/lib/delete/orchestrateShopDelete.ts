import { writeAudit } from "@/lib/audit/writeAudit";
import {
  completeDeleteOperation,
  createDeleteOperation,
  failDeleteOperation,
  findLatestDeleteOperation,
  normalizeDeleteResult,
  partialFailDeleteOperation,
  updateDeleteOperation,
} from "@/lib/delete/operations";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";
import { getShopAuthUsers } from "@/lib/shops/authUsers";
import { deleteShopAvatars, deleteSupportBundles } from "@/lib/shops/storageCleanup";
import { getStripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type DeleteLogLevel = "info" | "warn" | "error";

type DeleteLogEntry = {
  at: string;
  step: string;
  level: DeleteLogLevel;
  message: string;
  meta?: Record<string, unknown>;
};

type DeleteSnapshot = {
  shop: {
    id: string;
    name: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    deletion_status: string | null;
    deletion_started_at: string | null;
  };
  memberships: {
    count: number;
    user_ids: string[];
  };
  employees: {
    count: number;
    ids: string[];
    auth_user_ids: string[];
  };
  devices: {
    count: number;
    ids: string[];
    workstation_count: number;
    desktop_count: number;
  };
  support_bundle_count: number;
  auth_user_summary: {
    total: number;
    only_this_shop: number;
    multiple_shops: number;
  };
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function booleanFromEnv(name: string, fallback: boolean) {
  const raw = text(process.env[name]).toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cloneResult<T extends Record<string, unknown>>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isMissingStripeObject(error: unknown) {
  const message = text((error as any)?.message).toLowerCase();
  const code = text((error as any)?.code).toLowerCase();
  return code === "resource_missing" || message.includes("no such");
}

async function issueCleanupCommand(args: {
  targetApp: "desktop" | "mobile" | "workstation";
  action: "purge_shop_data" | "revoke_shop_access" | "clear_local_trust" | "reset_pairing";
  reason: string;
  shopId: string;
  shopName: string;
  authUserId?: string | null;
  employeeId?: string | null;
  deviceId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const admin = supabaseAdmin();
  const { error } = await admin.rpc("rb_issue_remote_cleanup_command", {
    p_target_app: args.targetApp,
    p_action: args.action,
    p_reason: args.reason,
    p_shop_id: args.shopId,
    p_shop_name: args.shopName,
    p_auth_user_id: args.authUserId ?? null,
    p_employee_id: args.employeeId ?? null,
    p_device_id: args.deviceId ?? null,
    p_payload: args.payload ?? {},
  });

  if (error) throw new Error(error.message);
}

async function buildDeleteSnapshot(shopId: string) {
  const admin = supabaseAdmin();
  const [shopRow, membershipRows, employeeRows, deviceRows, supportBundles, authUsers] = await Promise.all([
    admin
      .from("rb_shops")
      .select("id,name,stripe_customer_id,stripe_subscription_id,deletion_status,deletion_started_at")
      .eq("id", shopId)
      .maybeSingle(),
    admin.from("rb_shop_members").select("user_id").eq("shop_id", shopId),
    admin.from("employees").select("id,auth_user_id").eq("shop_id", shopId),
    admin.from("rb_devices").select("id,device_type").eq("shop_id", shopId),
    admin.from("rb_support_bundles").select("id", { count: "exact", head: true }).eq("shop_id", shopId),
    getShopAuthUsers(shopId),
  ]);

  if (shopRow.error) throw new Error(shopRow.error.message);
  if (membershipRows.error) throw new Error(membershipRows.error.message);
  if (employeeRows.error) throw new Error(employeeRows.error.message);
  if (deviceRows.error) throw new Error(deviceRows.error.message);
  if (supportBundles.error) throw new Error(supportBundles.error.message);

  const shop = shopRow.data;
  if (!shop?.id) return null;

  const memberIds = (membershipRows.data ?? [])
    .map((row: any) => text(row?.user_id))
    .filter(Boolean);

  const employees = (employeeRows.data ?? []) as any[];
  const devices = (deviceRows.data ?? []) as any[];

  return {
    shop: {
      id: text((shop as any).id),
      name: text((shop as any).name),
      stripe_customer_id: text((shop as any).stripe_customer_id) || null,
      stripe_subscription_id: text((shop as any).stripe_subscription_id) || null,
      deletion_status: text((shop as any).deletion_status) || null,
      deletion_started_at: text((shop as any).deletion_started_at) || null,
    },
    memberships: {
      count: memberIds.length,
      user_ids: memberIds,
    },
    employees: {
      count: employees.length,
      ids: employees.map((row) => text(row?.id)).filter(Boolean),
      auth_user_ids: employees.map((row) => text(row?.auth_user_id)).filter(Boolean),
    },
    devices: {
      count: devices.length,
      ids: devices.map((row) => text(row?.id)).filter(Boolean),
      workstation_count: devices.filter((row) => text(row?.device_type).toLowerCase() === "workstation").length,
      desktop_count: devices.filter((row) => text(row?.device_type).toLowerCase() !== "workstation").length,
    },
    support_bundle_count: supportBundles.count ?? 0,
    auth_user_summary: {
      total: authUsers.all.length,
      only_this_shop: authUsers.only_this_shop.length,
      multiple_shops: authUsers.multiple_shops.length,
    },
  } satisfies DeleteSnapshot;
}

async function freezeShop(args: {
  shopId: string;
  operationId: string;
}) {
  const admin = supabaseAdmin();
  const startedAt = nowIso();

  const { error: shopError } = await admin
    .from("rb_shops")
    .update({
      deletion_status: "deleting",
      deletion_started_at: startedAt,
      deletion_operation_id: args.operationId,
    })
    .eq("id", args.shopId);

  if (shopError) throw new Error(shopError.message);

  const { error: deviceError } = await admin
    .from("rb_devices")
    .update({ status: "disabled" })
    .eq("shop_id", args.shopId);

  if (deviceError) throw new Error(deviceError.message);

  return { started_at: startedAt, device_status: "disabled" };
}

async function queueRemoteCleanup(snapshot: DeleteSnapshot) {
  const shopId = snapshot.shop.id;
  const shopName = snapshot.shop.name;
  const admin = supabaseAdmin();

  const [memberRows, employeeRows, deviceRows] = await Promise.all([
    admin.from("rb_shop_members").select("user_id").eq("shop_id", shopId).not("user_id", "is", null),
    admin.from("employees").select("id,auth_user_id").eq("shop_id", shopId),
    admin.from("rb_devices").select("id,device_type").eq("shop_id", shopId),
  ]);

  if (memberRows.error) throw new Error(memberRows.error.message);
  if (employeeRows.error) throw new Error(employeeRows.error.message);
  if (deviceRows.error) throw new Error(deviceRows.error.message);

  let issued = 0;

  for (const row of memberRows.data ?? []) {
    const userId = text((row as any)?.user_id);
    if (!userId) continue;

    await issueCleanupCommand({
      targetApp: "desktop",
      action: "purge_shop_data",
      reason: "shop_deleted",
      shopId,
      shopName,
      authUserId: userId,
      payload: { scope: "shop", authority: "control" },
    });
    issued += 1;

    await issueCleanupCommand({
      targetApp: "mobile",
      action: "purge_shop_data",
      reason: "shop_deleted",
      shopId,
      shopName,
      authUserId: userId,
      payload: { scope: "shop", authority: "control" },
    });
    issued += 1;
  }

  for (const row of employeeRows.data ?? []) {
    const employeeId = text((row as any)?.id);
    const authUserId = text((row as any)?.auth_user_id);
    if (!employeeId || !authUserId) continue;

    await issueCleanupCommand({
      targetApp: "desktop",
      action: "revoke_shop_access",
      reason: "shop_deleted",
      shopId,
      shopName,
      authUserId,
      employeeId,
      payload: { scope: "employee", authority: "control" },
    });
    issued += 1;

    await issueCleanupCommand({
      targetApp: "mobile",
      action: "revoke_shop_access",
      reason: "shop_deleted",
      shopId,
      shopName,
      authUserId,
      employeeId,
      payload: { scope: "employee", authority: "control" },
    });
    issued += 1;
  }

  for (const row of deviceRows.data ?? []) {
    const deviceId = text((row as any)?.id);
    const deviceType = text((row as any)?.device_type).toLowerCase() || "desktop";
    if (!deviceId) continue;

    await issueCleanupCommand({
      targetApp: deviceType === "workstation" ? "workstation" : "desktop",
      action: deviceType === "workstation" ? "reset_pairing" : "purge_shop_data",
      reason: "shop_deleted",
      shopId,
      shopName,
      deviceId,
      payload: { scope: "device", authority: "control", device_type: deviceType },
    });
    issued += 1;
  }

  return { issued };
}

async function cleanupSingleShopAuthUser(args: {
  userId: string;
  email: string | null;
  shopId: string;
  shopName: string;
  actorUserId: string;
}) {
  const admin = supabaseAdmin();

  const { data: platformAdminRow, error: platformAdminError } = await admin
    .from("rb_control_admins")
    .select("user_id")
    .eq("user_id", args.userId)
    .maybeSingle();

  if (platformAdminError) throw new Error(platformAdminError.message);

  const protectedPlatformAdmin = !!platformAdminRow?.user_id || isPlatformAdminEmail(args.email);
  if (protectedPlatformAdmin) {
    await writeAudit({
      actor_user_id: args.actorUserId,
      actor_kind: "user",
      action: "shop.delete.auth_user_kept_platform_admin",
      target_type: "user",
      target_id: args.userId,
      shop_id: args.shopId,
      meta: {
        email: args.email ?? null,
        reason: "platform_admin_protection",
      },
    });

    return {
      deleted: false,
      skipped: true,
      reason: "platform_admin_protection",
    };
  }

  const deleteSpecs = [
    { table: "rb_control_admins", column: "user_id" },
    { table: "rb_user_prefs", column: "user_id" },
    { table: "rb_trusted_devices", column: "user_id" },
    { table: "rb_profiles", column: "id" },
    { table: "rb_onboarding_codes", column: "user_id" },
    { table: "rb_onboarding_state", column: "user_id" },
  ];

  for (const spec of deleteSpecs) {
    const { error } = await admin.from(spec.table).delete().eq(spec.column, args.userId);
    if (error) throw new Error(`${spec.table}: ${error.message}`);
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(args.userId);
  if (deleteUserError && !/not found/i.test(text(deleteUserError.message))) {
    throw new Error(deleteUserError.message);
  }

  await writeAudit({
    actor_user_id: args.actorUserId,
    actor_kind: "user",
    action: "shop.delete.auth_user_deleted",
    target_type: "user",
    target_id: args.userId,
    shop_id: args.shopId,
    meta: {
      email: args.email ?? null,
      delete_missing_user_treated_as_success: !!deleteUserError,
    },
  });

  return {
    deleted: true,
    skipped: false,
    reason: deleteUserError ? "already_deleted" : "deleted",
  };
}

async function cleanupAuthUsers(args: {
  shopId: string;
  shopName: string;
  actorUserId: string;
}) {
  const authUsers = await getShopAuthUsers(args.shopId);
  const decisions: Array<Record<string, unknown>> = [];

  for (const row of authUsers.all) {
    const base = {
      user_id: row.user_id,
      email: row.email,
      other_shop_count: row.other_shop_count,
      shop_membership_count: row.shop_membership_count,
      employee_count_in_shop: row.employee_count_in_shop,
      only_this_shop: row.only_this_shop,
    };

    if (!row.only_this_shop) {
      await writeAudit({
        actor_user_id: args.actorUserId,
        actor_kind: "user",
        action: "shop.delete.auth_user_retained_multi_shop",
        target_type: "user",
        target_id: row.user_id,
        shop_id: args.shopId,
        meta: base,
      });

      decisions.push({
        ...base,
        decision: "retain_auth_user",
        reason: "multi_shop_membership",
        core_delete_action: "remove_membership_and_employee_rows_only",
      });
      continue;
    }

    const cleanup = await cleanupSingleShopAuthUser({
      userId: row.user_id,
      email: row.email,
      shopId: args.shopId,
      shopName: args.shopName,
      actorUserId: args.actorUserId,
    });

    decisions.push({
      ...base,
      decision: cleanup.deleted ? "delete_auth_user" : "retain_auth_user",
      reason: cleanup.reason,
    });
  }

  return {
    all: authUsers.all,
    decisions,
    summary: {
      total: authUsers.all.length,
      only_this_shop: authUsers.only_this_shop.length,
      multiple_shops: authUsers.multiple_shops.length,
      deleted_auth_users: decisions.filter((row) => row.decision === "delete_auth_user").length,
      retained_auth_users: decisions.filter((row) => row.decision === "retain_auth_user").length,
    },
  };
}

async function cleanupBilling(args: {
  shopId: string;
  shopName: string;
  actorUserId: string;
  operationId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}) {
  const result: Record<string, unknown> = {
    subscription: null,
    customer: null,
  };

  const subscriptionId = text(args.stripeSubscriptionId) || null;
  const customerId = text(args.stripeCustomerId) || null;

  if (!subscriptionId && !customerId) {
    result.subscription = { status: "skipped", reason: "no_stripe_links" };
    result.customer = { status: "skipped", reason: "no_stripe_links" };
    return result;
  }

  const stripe = getStripe();

  if (subscriptionId) {
    try {
      const canceled = await stripe.subscriptions.cancel(subscriptionId);
      result.subscription = {
        status: "canceled",
        id: canceled.id,
        stripe_status: canceled.status,
      };
    } catch (error: any) {
      if (isMissingStripeObject(error)) {
        result.subscription = {
          status: "already_missing",
          id: subscriptionId,
        };
      } else {
        throw new Error(`stripe subscription cleanup failed: ${text(error?.message) || "unknown error"}`);
      }
    }
  } else {
    result.subscription = { status: "skipped", reason: "no_subscription_id" };
  }

  if (customerId) {
    try {
      const customer = await stripe.customers.update(customerId, {
        metadata: {
          runbook_deleted: "true",
          runbook_deleted_at: nowIso(),
          runbook_deleted_shop_id: args.shopId,
          runbook_delete_operation_id: args.operationId,
        },
      });

      result.customer = {
        status: "marked_inactive",
        id: customer.id,
      };
    } catch (error: any) {
      if (isMissingStripeObject(error)) {
        result.customer = {
          status: "already_missing",
          id: customerId,
        };
      } else {
        throw new Error(`stripe customer cleanup failed: ${text(error?.message) || "unknown error"}`);
      }
    }
  } else {
    result.customer = { status: "skipped", reason: "no_customer_id" };
  }

  await writeAudit({
    actor_user_id: args.actorUserId,
    actor_kind: "user",
    action: "shop.delete.billing_cleanup",
    target_type: "shop",
    target_id: args.shopId,
    shop_id: args.shopId,
    meta: result,
  });

  return result;
}

export async function orchestrateShopDelete(args: {
  shopId: string;
  confirmName: string;
  actorUserId: string;
}) {
  const admin = supabaseAdmin();
  const resultJson: Record<string, any> = {
    phase: "starting",
    logs: [] as DeleteLogEntry[],
  };

  let operationId = "";
  let operationShopName: string | null = null;

  const log = (step: string, level: DeleteLogLevel, message: string, meta?: Record<string, unknown>) => {
    (resultJson.logs as DeleteLogEntry[]).push({
      at: nowIso(),
      step,
      level,
      message,
      ...(meta ? { meta } : {}),
    });
  };

  const persist = async (status?: "running" | "failed" | "partial_failed" | "completed") => {
    if (!operationId) return;
    await updateDeleteOperation(operationId, {
      ...(status ? { status } : {}),
      result_json: cloneResult(resultJson),
    });
  };

  const existingOperation = await findLatestDeleteOperation(args.shopId);
  const initialSnapshot = await buildDeleteSnapshot(args.shopId);

  if (!initialSnapshot?.shop?.id) {
    if (existingOperation?.status === "completed") {
      return {
        ok: true,
        already_deleted: true,
        operation: normalizeDeleteResult(existingOperation),
        result: existingOperation.result_json ?? {},
      };
    }

    const operation = await createDeleteOperation({
      shopId: args.shopId,
      shopName: null,
      actorUserId: args.actorUserId,
      resultJson: {
        phase: "already_deleted",
        logs: [
          {
            at: nowIso(),
            step: "start",
            level: "info",
            message: "Shop was already absent before wipe started.",
          },
        ],
      },
    });

    const completed = await completeDeleteOperation(String(operation.id), {
      phase: "already_deleted",
      already_deleted: true,
      logs: [
        {
          at: nowIso(),
          step: "start",
          level: "info",
          message: "Shop was already absent before wipe started.",
        },
      ],
    });

    return {
      ok: true,
      already_deleted: true,
      operation: normalizeDeleteResult(completed),
      result: completed.result_json ?? {},
    };
  }

  operationShopName = initialSnapshot.shop.name;
  const operation = await createDeleteOperation({
    shopId: args.shopId,
    shopName: operationShopName,
    actorUserId: args.actorUserId,
    resultJson: {
      phase: "created",
      snapshot: initialSnapshot,
      logs: [],
    },
  });
  operationId = text(operation.id);

  resultJson.snapshot = initialSnapshot;
  resultJson.operation_id = operationId;
  resultJson.shop = initialSnapshot.shop;
  log("validate", "info", "Delete operation created.", {
    operation_id: operationId,
    shop_name: operationShopName,
  });

  try {
    if (text(args.confirmName) !== initialSnapshot.shop.name) {
      log("validate", "error", "Confirmation name did not match.", {
        provided: text(args.confirmName),
        expected: initialSnapshot.shop.name,
      });

      const failed = await failDeleteOperation(
        operationId,
        {
          message: "confirmation name did not match",
          provided: text(args.confirmName),
          expected: initialSnapshot.shop.name,
        },
        cloneResult({
          ...resultJson,
          phase: "validation_failed",
        })
      );

      return {
        ok: false,
        already_deleted: false,
        operation: normalizeDeleteResult(failed),
        error: "confirmation name did not match",
      };
    }

    resultJson.phase = "freezing_shop";
    const frozen = await freezeShop({
      shopId: args.shopId,
      operationId,
    });
    resultJson.freeze = frozen;
    log("freeze", "info", "Shop marked deleting and devices disabled.", frozen);
    await persist("running");

    resultJson.phase = "snapshotting_dependencies";
    const liveSnapshot = await buildDeleteSnapshot(args.shopId);
    resultJson.snapshot_after_freeze = liveSnapshot;
    log("snapshot", "info", "Dependency snapshot captured after freeze.", {
      auth_users: liveSnapshot?.auth_user_summary ?? null,
      devices: liveSnapshot?.devices?.count ?? 0,
      employees: liveSnapshot?.employees?.count ?? 0,
      memberships: liveSnapshot?.memberships?.count ?? 0,
    });

    try {
      const cleanupQueue = await queueRemoteCleanup(liveSnapshot ?? initialSnapshot);
      resultJson.remote_cleanup = cleanupQueue;
      log("snapshot", "info", "Remote cleanup commands queued.", cleanupQueue);
    } catch (error: any) {
      resultJson.remote_cleanup = {
        status: "failed",
        message: text(error?.message) || "Remote cleanup queue failed",
      };
      log("snapshot", "warn", "Remote cleanup queue failed; continuing wipe.", resultJson.remote_cleanup);
    }
    await persist("running");

    resultJson.phase = "deleting_storage";
    let avatarCleanup;
    let supportBundleCleanup;
    try {
      avatarCleanup = await deleteShopAvatars(args.shopId);
      supportBundleCleanup = await deleteSupportBundles(args.shopId);
      resultJson.storage = {
        avatars: avatarCleanup,
        support_bundles: supportBundleCleanup,
      };
      log("storage", "info", "Shop-owned storage deleted.", {
        avatar_count: avatarCleanup.count,
        support_bundle_count: supportBundleCleanup.count,
      });
      await writeAudit({
        actor_user_id: args.actorUserId,
        actor_kind: "user",
        action: "shop.delete.storage_cleanup",
        target_type: "shop",
        target_id: args.shopId,
        shop_id: args.shopId,
        meta: resultJson.storage,
      });
      await persist("running");
    } catch (error: any) {
      resultJson.storage = {
        status: "deferred",
        message: text(error?.message) || "storage cleanup failed",
        note: "Storage cleanup is best-effort and must not block authoritative shop deletion.",
      };
      log("storage", "warn", "Storage cleanup failed; continuing authoritative delete.", {
        message: text(error?.message) || "storage cleanup failed",
      });
      await writeAudit({
        actor_user_id: args.actorUserId,
        actor_kind: "user",
        action: "shop.delete.storage_cleanup_deferred",
        target_type: "shop",
        target_id: args.shopId,
        shop_id: args.shopId,
        meta: asRecord(resultJson.storage),
      });
      await persist("running");
    }

    resultJson.phase = "resolving_auth_users";
    try {
      const authCleanup = await cleanupAuthUsers({
        shopId: args.shopId,
        shopName: initialSnapshot.shop.name,
        actorUserId: args.actorUserId,
      });
      resultJson.auth_cleanup = authCleanup;
      log("auth", "info", "Auth user decisions completed.", authCleanup.summary);
      await persist("running");
    } catch (error: any) {
      log("auth", "error", "Auth cleanup failed.", {
        message: text(error?.message) || "auth cleanup failed",
      });
      const failed = await failDeleteOperation(
        operationId,
        {
          message: text(error?.message) || "Auth cleanup failed",
          phase: "auth",
        },
        cloneResult({
          ...resultJson,
          phase: "auth_failed",
        })
      );

      return {
        ok: false,
        already_deleted: false,
        operation: normalizeDeleteResult(failed),
        error: text(error?.message) || "Auth cleanup failed",
      };
    }

    resultJson.phase = "deleting_business_data";
    try {
      const { data, error } = await admin.rpc("rb_delete_shop_business_data", {
        p_shop_id: args.shopId,
      });
      if (error) throw new Error(error.message);

      resultJson.business_data = data ?? null;
      log("business_data", "info", "Business data cleanup completed.", asRecord(data));
      await writeAudit({
        actor_user_id: args.actorUserId,
        actor_kind: "user",
        action: "shop.delete.business_data_cleanup",
        target_type: "shop",
        target_id: args.shopId,
        shop_id: args.shopId,
        meta: asRecord(data),
      });
      await persist("running");
    } catch (error: any) {
      log("business_data", "error", "Business data cleanup failed.", {
        message: text(error?.message) || "business data cleanup failed",
      });

      const failed = await partialFailDeleteOperation(
        operationId,
        {
          message: text(error?.message) || "Business data cleanup failed",
          phase: "business_data",
        },
        cloneResult({
          ...resultJson,
          phase: "business_data_failed",
        })
      );

      return {
        ok: false,
        already_deleted: false,
        operation: normalizeDeleteResult(failed),
        error: text(error?.message) || "Business data cleanup failed",
      };
    }

    resultJson.phase = "billing_cleanup";
    const allowBillingFailure = booleanFromEnv("RUNBOOK_DELETE_ALLOW_BILLING_FAILURE", true);
    try {
      const billing = await cleanupBilling({
        shopId: args.shopId,
        shopName: initialSnapshot.shop.name,
        actorUserId: args.actorUserId,
        operationId,
        stripeCustomerId: initialSnapshot.shop.stripe_customer_id,
        stripeSubscriptionId: initialSnapshot.shop.stripe_subscription_id,
      });
      resultJson.billing = billing;
      log("billing", "info", "Billing cleanup finished.", asRecord(billing));
      await persist("running");
    } catch (error: any) {
      resultJson.billing = {
        status: "failed",
        message: text(error?.message) || "Billing cleanup failed",
        allow_continue: allowBillingFailure,
      };
      log("billing", allowBillingFailure ? "warn" : "error", "Billing cleanup failed.", asRecord(resultJson.billing));
      await writeAudit({
        actor_user_id: args.actorUserId,
        actor_kind: "user",
        action: "shop.delete.billing_cleanup_failed",
        target_type: "shop",
        target_id: args.shopId,
        shop_id: args.shopId,
        meta: asRecord(resultJson.billing),
      });

      if (!allowBillingFailure) {
        const failed = await failDeleteOperation(
          operationId,
          {
            message: text(error?.message) || "Billing cleanup failed",
            phase: "billing",
          },
          cloneResult({
            ...resultJson,
            phase: "billing_failed",
          })
        );

        return {
          ok: false,
          already_deleted: false,
          operation: normalizeDeleteResult(failed),
          error: text(error?.message) || "Billing cleanup failed",
        };
      }

      await persist("running");
    }

    resultJson.phase = "deleting_core_data";
    try {
      const { data, error } = await admin.rpc("rb_delete_shop_core_data", {
        p_shop_id: args.shopId,
      });
      if (error) throw new Error(error.message);

      resultJson.core_cleanup = data ?? null;
      log("core_data", "info", "Core shop rows deleted.", asRecord(data));
      await persist("running");
    } catch (error: any) {
      log("core_data", "error", "Core data cleanup failed.", {
        message: text(error?.message) || "core data cleanup failed",
      });

      const failed = await partialFailDeleteOperation(
        operationId,
        {
          message: text(error?.message) || "Core data cleanup failed",
          phase: "core_data",
        },
        cloneResult({
          ...resultJson,
          phase: "core_data_failed",
        })
      );

      return {
        ok: false,
        already_deleted: false,
        operation: normalizeDeleteResult(failed),
        error: text(error?.message) || "Core data cleanup failed",
      };
    }

    resultJson.phase = "completed";
    resultJson.completed_at = nowIso();
    await writeAudit({
      actor_user_id: args.actorUserId,
      actor_kind: "user",
      action: "shop.delete.completed",
      target_type: "shop",
      target_id: args.shopId,
      shop_id: args.shopId,
      meta: {
        operation_id: operationId,
        billing: resultJson.billing ?? null,
        auth_summary: resultJson.auth_cleanup?.summary ?? null,
      },
    });

    const completed = await completeDeleteOperation(operationId, cloneResult(resultJson));
    return {
      ok: true,
      already_deleted: false,
      operation: normalizeDeleteResult(completed),
      result: completed.result_json ?? {},
    };
  } catch (error: any) {
    log("finalize", "error", "Unhandled delete failure.", {
      message: text(error?.message) || "Delete failed",
    });

    if (!operationId) {
      throw error;
    }

    const failed = await failDeleteOperation(
      operationId,
      {
        message: text(error?.message) || "Delete failed",
        phase: text(resultJson.phase) || "unknown",
      },
      cloneResult({
        ...resultJson,
        phase: "failed",
      })
    );

    return {
      ok: false,
      already_deleted: false,
      operation: normalizeDeleteResult(failed),
      error: text(error?.message) || "Delete failed",
    };
  }
}
