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

function estimateCostUsd(inputTokens: number, outputTokens: number) {
  const inputPer1M = 0.15;
  const outputPer1M = 0.60;
  return (inputTokens / 1_000_000) * inputPer1M + (outputTokens / 1_000_000) * outputPer1M;
}

function requireImageDataUrls(value: unknown) {
  if (!Array.isArray(value)) throw new Error("image_data_urls must be an array.");

  const maxPages = parsePositiveInt(process.env.RUNBOOK_PO_AI_MAX_PAGES, 16);
  const maxBytes = parsePositiveInt(process.env.RUNBOOK_PO_AI_MAX_REQUEST_BYTES, 28_000_000);
  const urls = value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0)
    .slice(0, maxPages);

  if (urls.length === 0) throw new Error("At least one PO page image is required.");

  let approxBytes = 0;
  for (const url of urls) {
    if (!url.startsWith("data:image/png;base64,")) {
      throw new Error("PO page images must be PNG data URLs.");
    }
    approxBytes += Buffer.byteLength(url, "utf8");
  }

  if (approxBytes > maxBytes) {
    throw new Error("PO image payload is too large.");
  }

  return urls;
}

function checkRateLimit(shopId: string, deviceId: string) {
  const limit = parsePositiveInt(process.env.RUNBOOK_PO_AI_REQUESTS_PER_HOUR, 30);
  const key = `${shopId}:${deviceId}`;
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (current.count >= limit) {
    throw new Error("PO AI extraction hourly limit reached. Try again later.");
  }

  current.count += 1;
}

async function checkPersistedRateLimit(admin: ReturnType<typeof supabaseAdmin>, shopId: string, deviceId: string) {
  const shopLimit = parsePositiveInt(process.env.RUNBOOK_PO_AI_SHOP_REQUESTS_PER_HOUR, 120);
  const deviceLimit = parsePositiveInt(process.env.RUNBOOK_PO_AI_REQUESTS_PER_HOUR, 30);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  try {
    const shopCount = await admin
      .from("rb_ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("feature", "desktop.po_extract")
      .gte("created_at", since);

    if (shopCount.error) throw shopCount.error;
    if ((shopCount.count ?? 0) >= shopLimit) {
      throw new Error("PO AI extraction shop hourly limit reached. Try again later.");
    }

    const deviceCount = await admin
      .from("rb_ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("device_id", deviceId)
      .eq("feature", "desktop.po_extract")
      .gte("created_at", since);

    if (deviceCount.error) throw deviceCount.error;
    if ((deviceCount.count ?? 0) >= deviceLimit) {
      throw new Error("PO AI extraction hourly limit reached. Try again later.");
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

function buildPrompt() {
  return `Extract a machine shop purchase order (PO) into strict JSON.
Return ONLY valid JSON.

CRITICAL REQUIREMENTS (DO NOT VIOLATE):
- For each line item, description must include ALL text the PO provides for that line item.
- Do NOT summarize, do NOT paraphrase. Capture wording as-is.
- Preserve line breaks where they exist (use \\n inside the JSON string).
- Some POs have multi-page descriptions. If a description continues onto later pages and does NOT repeat the part number,
  append that continuation text to the correct existing line item's description. Do NOT create extra line items just to hold text.
- Never truncate the beginning of a description. If in doubt, include more.

IMPORTANT:
- The PO 'customer' is the company that ISSUED the PO / is BUYING (often shown as 'Ship To' or buyer name in header).
- The 'supplier' is the vendor receiving the PO (often shown as 'Purchase From').
- Do NOT confuse 'Purchase From' with the customer/buyer.

ABOUT DUE / REQUIRED DATES:
- The due/required date may be labeled as: Due Date, Required Date, Req Date, Need By, Deliver By, Delivery Date, Requested Delivery, Promise Date, Ship By, Dock Date, Arrival.
- If a single date repeats for MOST line items, set header.dueDate to that date (and still keep line item dueDate where present).
- If there are many different line due dates and no single dominant date, header.dueDate may be null.
- For EACH line item, actively look for a line-specific due/required date near that row and put it in lineItems[].dueDate when present.
- Do not drop a line-specific due date just because header.dueDate also exists.

JSON:
{
  "issuerCompany": string|null,
  "supplierCompany": string|null,
  "header": {
    "poNumber": string|null,
    "customer": string|null,
    "poDate": string|null,
    "dueDate": string|null,
    "billToAddress": string|null,
    "shipToName": string|null,
    "shipToAddress": string|null,
    "terms": string|null,
    "shipVia": string|null,
    "fob": string|null,
    "notes": string|null
  },
  "lineItems": [
    {
      "partNumber": string|null,
      "description": string|null,
      "quantity": number|null,
      "uom": string|null,
      "dueDate": string|null,
      "unitPrice": number|null,
      "notes": string|null
    }
  ]
}

Rules:
- Missing values => null
- quantity/unitPrice numeric (no $)
- Prefer 'Ship To' company as issuerCompany/customer when present.
- Only put a dueDate when it is present OR when it is a dominant line-item required date as described above.
- Do NOT invent line items that do not exist in the PO.`;
}

function getOutputText(root: any) {
  if (typeof root?.output_text === "string") return root.output_text;
  const output = Array.isArray(root?.output) ? root.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part?.text === "string") return part.text;
    }
  }
  return "";
}

async function writeUsageLog(admin: ReturnType<typeof supabaseAdmin>, row: Record<string, any>) {
  try {
    await admin.from("rb_ai_usage_events").insert(row);
  } catch {
    // The endpoint must still work before the optional audit table is deployed.
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

    const imageDataUrls = requireImageDataUrls(body.image_data_urls);
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

    const model = (process.env.RUNBOOK_PO_AI_MODEL ?? "gpt-4o-mini").trim() || "gpt-4o-mini";
    const payload = {
      model,
      text: { format: { type: "json_object" } },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildPrompt() },
            ...imageDataUrls.map((image_url) => ({ type: "input_image", image_url })),
          ],
        },
      ],
      max_output_tokens: parsePositiveInt(process.env.RUNBOOK_PO_AI_MAX_OUTPUT_TOKENS, 7000),
    };

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env("OPENAI_API_KEY")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await openAiResponse.text();
    if (!openAiResponse.ok) {
      return NextResponse.json(
        { ok: false, error: `OpenAI PO extraction failed (${openAiResponse.status}).` },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(text);
    const outputText = getOutputText(parsed);
    if (!outputText) throw new Error("OpenAI response had no output text.");

    const inputTokens = Number(parsed?.usage?.input_tokens ?? 0) || 0;
    const outputTokens = Number(parsed?.usage?.output_tokens ?? 0) || 0;
    const estimatedCostUsd = estimateCostUsd(inputTokens, outputTokens);

    await writeUsageLog(admin, {
      shop_id: shopId,
      user_id: user.id,
      device_id: deviceId,
      feature: "desktop.po_extract",
      provider: "openai",
      model,
      response_id: String(parsed?.id ?? ""),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimatedCostUsd,
      page_count: imageDataUrls.length,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      provider: "openai",
      model,
      response_id: String(parsed?.id ?? ""),
      output_text: outputText,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
      estimated_cost_usd: estimatedCostUsd,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = /not authenticated/i.test(msg) ? 401 : /limit reached/i.test(msg) ? 429 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
