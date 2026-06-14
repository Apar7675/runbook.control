import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";
import { readLocalDeviceIdentity } from "@/lib/device/localIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatSbError(error: any) {
  if (!error) return "Unknown error";
  const msg = String(error.message ?? error ?? "");
  const code = error.code ? ` code=${String(error.code)}` : "";
  const details = error.details ? ` details=${String(error.details)}` : "";
  const hint = error.hint ? ` hint=${String(error.hint)}` : "";
  return `${msg}${code}${details}${hint}`;
}

function tryExtractMissingColumn(msg: string): string | null {
  const text = String(msg ?? "");
  const relationMatch = text.match(/column\s+"([^"]+)"\s+of\s+relation/i);
  if (relationMatch?.[1]) return relationMatch[1];

  const schemaCacheMatch = text.match(/could not find the\s+'([^']+)'\s+column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const qualifiedColumnMatch = text.match(/column\s+([a-z0-9_]+\.){0,2}([a-z0-9_]+)\s+does not exist/i);
  if (qualifiedColumnMatch?.[2]) return qualifiedColumnMatch[2];

  return null;
}

async function loadExistingDevice(admin: ReturnType<typeof supabaseAdmin>, deviceId: string) {
  let columns = ["id", "shop_id", "status", "device_role", "replaced_by_device_id", "replaced_at"];

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await admin
      .from("rb_devices")
      .select(columns.join(","))
      .eq("id", deviceId)
      .maybeSingle();

    if (!error) return data as any;

    const missing = tryExtractMissingColumn(formatSbError(error));
    if (missing && columns.includes(missing)) {
      columns = columns.filter((entry) => entry !== missing);
      continue;
    }

    throw new Error(formatSbError(error));
  }

  throw new Error("Device lookup failed after stripping missing columns.");
}

async function updateDeviceWithAutoStrip(admin: ReturnType<typeof supabaseAdmin>, deviceId: string, values: Record<string, any>) {
  let patch = { ...values };

  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await admin
      .from("rb_devices")
      .update(patch)
      .eq("id", deviceId);

    if (!error) return;

    const missing = tryExtractMissingColumn(formatSbError(error));
    if (missing && Object.prototype.hasOwnProperty.call(patch, missing)) {
      const rest = { ...patch };
      delete rest[missing];
      patch = rest;
      continue;
    }

    throw new Error(formatSbError(error));
  }

  throw new Error("Device update failed after stripping missing columns.");
}

async function insertDeviceWithAutoStrip(admin: ReturnType<typeof supabaseAdmin>, values: Record<string, any>) {
  let payload = { ...values };

  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await admin
      .from("rb_devices")
      .insert(payload);

    if (!error) return;

    const missing = tryExtractMissingColumn(formatSbError(error));
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
      const rest = { ...payload };
      delete rest[missing];
      payload = rest;
      continue;
    }

    throw new Error(formatSbError(error));
  }

  throw new Error("Device registration failed after stripping missing columns.");
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shop_id = String(body.shop_id ?? "").trim();
    const device_id = String(body.device_id ?? "").trim();
    const localIdentity = readLocalDeviceIdentity(body);

    if (!shop_id) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!device_id) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: mem } = await admin
      .from("rb_shop_members")
      .select("role")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mem) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const existing = await loadExistingDevice(admin, device_id);

    if (existing?.id) {
      if (String(existing.shop_id ?? "").trim() !== shop_id) {
        return NextResponse.json({ ok: false, error: "Device already belongs to another shop." }, { status: 403 });
      }

      if (String(existing.status ?? "").trim().toLowerCase() === "replaced") {
        return NextResponse.json({
          ok: false,
          error: "device_replaced",
          replaced_by_device_id: existing.replaced_by_device_id ?? null,
          replaced_at: existing.replaced_at ?? null,
        }, { status: 403 });
      }

      await updateDeviceWithAutoStrip(admin, device_id, { status: "active", device_type: "desktop", ...localIdentity });

      return NextResponse.json({ ok: true, existing: true, device_id, shop_id, status: "active", device_role: String(existing.device_role ?? "").trim() });
    }

    await insertDeviceWithAutoStrip(admin, {
      id: device_id,
      shop_id,
      name: `Desktop ${device_id.slice(0, 8)}`,
      device_type: "desktop",
      status: "active",
      ...localIdentity,
    });

    return NextResponse.json({ ok: true, existing: false, device_id, shop_id, status: "active", device_role: "" });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
