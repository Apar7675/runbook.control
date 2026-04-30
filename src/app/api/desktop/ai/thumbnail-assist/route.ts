import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";
import { getShopEntitlement } from "@/lib/billing/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60 * 60 * 1000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeTier(value: unknown) {
  const tier = String(value ?? "").trim().toLowerCase();
  return tier === "pro" ? "pro" : "standard";
}

function imageBytesFromDataUrl(value: unknown) {
  const dataUrl = String(value ?? "").trim();
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) throw new Error("source_image_data_url must be a PNG data URL.");

  const b64 = dataUrl.slice(prefix.length);
  const bytes = Buffer.from(b64, "base64");
  const maxBytes = parsePositiveInt(process.env.RUNBOOK_THUMBNAIL_AI_MAX_IMAGE_BYTES, 6_000_000);
  if (bytes.length <= 0) throw new Error("Thumbnail AI source image is empty.");
  if (bytes.length > maxBytes) throw new Error("Thumbnail AI source image is too large.");
  return bytes;
}

function checkRateLimit(shopId: string, deviceId: string) {
  const limit = parsePositiveInt(process.env.RUNBOOK_THUMBNAIL_AI_REQUESTS_PER_HOUR, 30);
  const key = `${shopId}:${deviceId}`;
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (current.count >= limit) {
    throw new Error("Thumbnail AI Assist hourly limit reached. Try again later.");
  }

  current.count += 1;
}

async function checkPersistedRateLimit(admin: ReturnType<typeof supabaseAdmin>, shopId: string, deviceId: string) {
  const shopLimit = parsePositiveInt(process.env.RUNBOOK_THUMBNAIL_AI_SHOP_REQUESTS_PER_HOUR, 120);
  const deviceLimit = parsePositiveInt(process.env.RUNBOOK_THUMBNAIL_AI_REQUESTS_PER_HOUR, 30);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  try {
    const shopCount = await admin
      .from("rb_ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("feature", "desktop.thumbnail_ai_assist")
      .gte("created_at", since);

    if (shopCount.error) throw shopCount.error;
    if ((shopCount.count ?? 0) >= shopLimit) {
      throw new Error("Thumbnail AI Assist shop hourly limit reached. Try again later.");
    }

    const deviceCount = await admin
      .from("rb_ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("device_id", deviceId)
      .eq("feature", "desktop.thumbnail_ai_assist")
      .gte("created_at", since);

    if (deviceCount.error) throw deviceCount.error;
    if ((deviceCount.count ?? 0) >= deviceLimit) {
      throw new Error("Thumbnail AI Assist hourly limit reached. Try again later.");
    }
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? "");
    if (/limit reached/i.test(msg)) throw e;
    checkRateLimit(shopId, deviceId);
  }
}

async function requireActiveDevice(admin: ReturnType<typeof supabaseAdmin>, shopId: string, deviceId: string) {
  const { data: device, error } = await admin
    .from("rb_devices")
    .select("id,shop_id,status")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!device?.id) return { ok: false, error: "Device not registered for this shop." };
  if (String(device.shop_id ?? "").trim() !== shopId) return { ok: false, error: "Device not registered for this shop." };
  if (String(device.status ?? "").trim().toLowerCase() !== "active") return { ok: false, error: "Device inactive." };
  return { ok: true as const };
}

function buildPrompt(userNotes: string) {
  let prompt =
    "Using this exact cropped view, create a clean solid-looking metal part preview from the technical drawing image. " +
    "Keep the same orientation, same camera angle, same side/profile view, and same silhouette. " +
    "Do not rotate it, do not convert it to an isometric or perspective 3D view, and do not invent new geometry. " +
    "Make it read like a solid machined metal piece with subtle shading while preserving the original view. " +
    "Draw a restrained black outline along all visible exterior edges, about 30 percent lighter/thinner than a heavy technical outline, so the part stays clear at thumbnail size without looking over-traced. " +
    "Remove drafting clutter, but do not add text, dimensions, or extra features. Transparent background.";

  const notes = userNotes.trim();
  if (notes.length > 0) prompt += " User notes: " + notes.slice(0, 1000);
  return prompt;
}

function parseUsage(root: any) {
  const usage = root?.usage ?? {};
  const inputDetails = usage?.input_tokens_details ?? {};
  const outputDetails = usage?.output_tokens_details ?? {};
  const totalInputTokens = Number(usage?.input_tokens ?? 0) || 0;
  const totalOutputTokens = Number(usage?.output_tokens ?? 0) || 0;
  const imageInputTokens = Number(inputDetails?.image_tokens ?? inputDetails?.input_image_tokens ?? 0) || 0;
  const textOutputTokens = Number(outputDetails?.text_tokens ?? outputDetails?.response_tokens ?? 0) || 0;
  const outputImageTokens = Number(outputDetails?.image_tokens ?? outputDetails?.output_image_tokens ?? 0) || 0;
  const textInputTokens = Math.max(0, Number(inputDetails?.text_tokens ?? inputDetails?.prompt_tokens ?? 0) || (totalInputTokens - imageInputTokens));

  return {
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    text_input_tokens: textInputTokens,
    image_input_tokens: imageInputTokens,
    text_output_tokens: textOutputTokens,
    output_image_tokens: Math.max(0, outputImageTokens || (totalOutputTokens - textOutputTokens)),
  };
}

function estimateCostUsd(usage: ReturnType<typeof parseUsage>, tier: string) {
  const pro = tier === "pro";
  const textInputRate = pro ? 5.0 : 2.0;
  const imageInputRate = pro ? 10.0 : 2.5;
  const imageOutputRate = pro ? 40.0 : 8.0;
  return (
    (usage.text_input_tokens / 1_000_000) * textInputRate +
    (usage.image_input_tokens / 1_000_000) * imageInputRate +
    (usage.output_image_tokens / 1_000_000) * imageOutputRate
  );
}

async function writeUsageLog(admin: ReturnType<typeof supabaseAdmin>, row: Record<string, any>) {
  try {
    await admin.from("rb_ai_usage_events").insert(row);
  } catch {
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const shopId = String(body.shop_id ?? "").trim();
    const deviceId = String(body.device_id ?? "").trim();

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!deviceId) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });

    const tier = normalizeTier(body.tier);
    const imageBytes = imageBytesFromDataUrl(body.source_image_data_url);
    const userNotes = String(body.user_notes ?? "").trim();
    const admin = supabaseAdmin();

    const { data: mem, error: memError } = await admin
      .from("rb_shop_members")
      .select("role")
      .eq("shop_id", shopId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memError) throw new Error(memError.message);
    if (!mem) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const deviceCheck = await requireActiveDevice(admin, shopId, deviceId);
    if (!deviceCheck.ok) return NextResponse.json({ ok: false, error: deviceCheck.error }, { status: 403 });

    const entitlement = await getShopEntitlement(shopId);
    if (!entitlement.allowed || entitlement.restricted) {
      return NextResponse.json({ ok: false, error: entitlement.reason, entitlement }, { status: 402 });
    }

    await checkPersistedRateLimit(admin, shopId, deviceId);

    const model = tier === "pro"
      ? (process.env.RUNBOOK_THUMBNAIL_AI_PRO_MODEL ?? "gpt-image-1").trim() || "gpt-image-1"
      : (process.env.RUNBOOK_THUMBNAIL_AI_STANDARD_MODEL ?? "gpt-image-1-mini").trim() || "gpt-image-1-mini";

    const form = new FormData();
    form.append("model", model);
    form.append("size", "1024x1024");
    form.append("background", "transparent");
    form.append("quality", "high");
    form.append("prompt", buildPrompt(userNotes));
    form.append("image", new Blob([imageBytes], { type: "image/png" }), "thumbnail.png");

    const openAiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env("OPENAI_API_KEY")}`,
      },
      body: form,
    });

    const text = await openAiResponse.text();
    if (!openAiResponse.ok) {
      return NextResponse.json(
        { ok: false, error: `OpenAI Thumbnail AI Assist failed (${openAiResponse.status}).` },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(text);
    const first = Array.isArray(parsed?.data) ? parsed.data[0] : null;
    const b64Json = typeof first?.b64_json === "string" ? first.b64_json : "";
    if (!b64Json) throw new Error("Thumbnail AI Assist returned no image data.");

    const usage = parseUsage(parsed);
    const estimatedCostUsd = estimateCostUsd(usage, tier);

    await writeUsageLog(admin, {
      shop_id: shopId,
      user_id: user.id,
      device_id: deviceId,
      feature: "desktop.thumbnail_ai_assist",
      provider: "openai",
      model,
      response_id: String(parsed?.id ?? ""),
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      estimated_cost_usd: estimatedCostUsd,
      page_count: 1,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      provider: "openai",
      model,
      response_id: String(parsed?.id ?? ""),
      b64_json: b64Json,
      usage,
      estimated_cost_usd: estimatedCostUsd,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /limit reached/i.test(msg) ? 429 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
