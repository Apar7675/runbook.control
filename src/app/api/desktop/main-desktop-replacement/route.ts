import { NextResponse } from "next/server";
import { assertUuid } from "@/lib/authz";
import { writeAudit } from "@/lib/audit/writeAudit";
import { requireSessionUser } from "@/lib/desktopAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const normalized = text(value);
  return normalized || null;
}

function nullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("restore_generation must be an integer");
  return parsed;
}

async function requireShopDeviceManager(admin: ReturnType<typeof supabaseAdmin>, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("id,role,is_active")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const role = text(data?.role).toLowerCase();
  if (!data?.id || (role !== "owner" && role !== "admin")) {
    throw new Error("Access denied");
  }
}

function statusForError(message: string) {
  if (/not authenticated/i.test(message)) return 401;
  if (/access denied/i.test(message)) return 403;
  if (/must be a uuid|missing|required|integer/i.test(message)) return 400;
  if (/new_device_not_registered/i.test(message)) return 409;
  return 500;
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const shopId = text(body.shop_id);
    const newDeviceId = text(body.new_device_id);

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!newDeviceId) return NextResponse.json({ ok: false, error: "Missing new_device_id" }, { status: 400 });
    assertUuid("shop_id", shopId);
    assertUuid("new_device_id", newDeviceId);

    const oldRestoreGeneration = nullableInteger(body.old_restore_generation);
    const newRestoreGeneration = nullableInteger(body.new_restore_generation);
    const admin = supabaseAdmin();

    await requireShopDeviceManager(admin, shopId, user.id);

    const { data, error } = await admin.rpc("rb_register_main_desktop_replacement", {
      p_shop_id: shopId,
      p_old_active_primary_desktop_id: nullableText(body.old_active_primary_desktop_id),
      p_old_active_primary_local_install_id: nullableText(body.old_active_primary_local_install_id),
      p_old_active_primary_machine_fingerprint: nullableText(body.old_active_primary_machine_fingerprint),
      p_old_active_primary_computer_name: nullableText(body.old_active_primary_computer_name),
      p_old_restore_generation: oldRestoreGeneration,
      p_new_device_id: newDeviceId,
      p_new_local_install_id: nullableText(body.new_local_install_id),
      p_new_machine_fingerprint: nullableText(body.new_machine_fingerprint),
      p_new_computer_name: nullableText(body.new_computer_name),
      p_new_restore_generation: newRestoreGeneration,
    });

    if (error) throw new Error(error.message);

    const result = (data ?? {}) as Record<string, unknown>;

    try {
      await writeAudit({
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "device.main_desktop_replaced",
        target_type: "device",
        target_id: newDeviceId,
        shop_id: shopId,
        meta: {
          old_device_id: result.old_device_id ?? null,
          old_device_marked_replaced: result.old_device_marked_replaced === true,
          new_device_id: newDeviceId,
          old_restore_generation: oldRestoreGeneration,
          new_restore_generation: newRestoreGeneration,
          warnings: Array.isArray(result.warnings) ? result.warnings : [],
        },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      shop_id: shopId,
      old_device_marked_replaced: result.old_device_marked_replaced === true,
      old_device_id: text(result.old_device_id),
      old_device_name: text(result.old_device_name),
      new_device_primary: result.new_device_primary === true,
      new_device_id: newDeviceId,
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: statusForError(message) });
  }
}
