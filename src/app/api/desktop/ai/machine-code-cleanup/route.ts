import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";
import { getShopEntitlement } from "@/lib/billing/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60 * 60 * 1000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

type CleanupCandidate = {
  candidateId: string;
  code: string;
  rawTitle: string;
  rawDescription: string;
  aliases: string[];
  codeType: string;
};

type CleanupRow = {
  candidateId: string;
  code: string;
  title: string;
  shortDescription: string;
};

type OpenAiResponseEnvelope = {
  id?: string;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function estimateCostUsd(inputTokens: number, outputTokens: number) {
  const inputPer1M = 0.15;
  const outputPer1M = 0.6;
  return (inputTokens / 1_000_000) * inputPer1M + (outputTokens / 1_000_000) * outputPer1M;
}

function normalizeCode(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.length < 2) return raw;

  const prefix = raw[0];
  if (prefix !== "G" && prefix !== "M") return raw;

  const suffix = raw.slice(1).trim();
  if (!suffix) return raw;

  if (/^\d+$/.test(suffix)) {
    const numericValue = Number.parseInt(suffix, 10);
    if (!Number.isFinite(numericValue)) return raw;
    return numericValue <= 9 ? `${prefix}${String(numericValue).padStart(2, "0")}` : `${prefix}${numericValue}`;
  }

  const decimalMatch = suffix.match(/^(\d+)\.(\d+)$/);
  if (decimalMatch) {
    const wholeValue = Number.parseInt(decimalMatch[1], 10);
    if (!Number.isFinite(wholeValue)) return raw;
    return `${prefix}${wholeValue}.${decimalMatch[2]}`;
  }

  return raw;
}

function trimToLength(value: unknown, maxLength: number) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return raw.length <= maxLength ? raw : `${raw.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function checkRateLimit(shopId: string, deviceId: string) {
  const limit = parsePositiveInt(process.env.RUNBOOK_MACHINE_CODE_AI_REQUESTS_PER_HOUR, 20);
  const key = `${shopId}:${deviceId}`;
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (current.count >= limit) {
    throw new Error("Machine-code AI cleanup hourly limit reached. Try again later.");
  }

  current.count += 1;
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

function getOutputText(root: OpenAiResponseEnvelope) {
  if (typeof root.output_text === "string") return root.output_text;
  const output = Array.isArray(root.output) ? root.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

function requireCandidates(body: unknown) {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const candidateValues = Array.isArray(record.sections) ? record.sections : [];
  const maxCandidates = parsePositiveInt(process.env.RUNBOOK_MACHINE_CODE_AI_MAX_SECTIONS, 250);
  const maxBytes = parsePositiveInt(process.env.RUNBOOK_MACHINE_CODE_AI_MAX_REQUEST_BYTES, 250_000);
  const candidates: CleanupCandidate[] = [];

  for (const section of candidateValues.slice(0, maxCandidates)) {
    const entry = typeof section === "object" && section !== null ? (section as Record<string, unknown>) : {};
    const candidateId = trimToLength(entry.candidateId ?? entry.candidate_id, 40);
    const code = normalizeCode(entry.code);
    const rawTitle = trimToLength(entry.rawTitle ?? entry.raw_title, 160);
    const rawDescription = trimToLength(entry.rawDescription ?? entry.raw_description ?? entry.bodyPreview ?? entry.body_preview, 220);
    const aliases = Array.isArray(entry.aliases)
      ? entry.aliases.map((value) => trimToLength(value, 40)).filter((value) => value.length > 0)
      : [];
    const codeType = trimToLength(entry.codeType ?? entry.code_type, 40);

    if (!candidateId && !code && !rawTitle && !rawDescription) continue;
    candidates.push({ candidateId, code, rawTitle, rawDescription, aliases, codeType });
  }

  if (candidates.length > 0) {
    const approxBytes = Buffer.byteLength(JSON.stringify(candidates), "utf8");
    if (approxBytes > maxBytes) throw new Error("Machine-code cleanup payload is too large.");
    return candidates;
  }

  const rawText = trimToLength(record.rawText ?? record.raw_text, 20_000);
  if (!rawText) throw new Error("At least one parsed machine-code section is required.");
  if (Buffer.byteLength(rawText, "utf8") > maxBytes) throw new Error("Machine-code cleanup payload is too large.");

  return [
    {
      candidateId: "row_0000",
      code: "",
      rawTitle: "RAW_TEXT_FALLBACK",
      rawDescription: rawText,
      aliases: [],
      codeType: "",
    },
  ];
}

function buildPrompt(machineName: string, sourceFileName: string, candidates: CleanupCandidate[]) {
  const input = {
    machineName,
    sourceFileName,
    candidates,
  };

  return [
    "You are cleaning an already parsed machine-code candidate list.",
    "Return ONLY valid JSON with this shape:",
    '{"rows":[{"candidateId":"row_0001","code":"G00","title":"Rapid","shortDescription":"Rapid positioning move."}]}',
    "Rules:",
    "- JSON only. No markdown. No prose outside JSON.",
    "- Do not discover codes.",
    "- Do not remove codes.",
    "- Return one output row for each input candidateId when possible.",
    "- Keep candidateId unchanged.",
    "- Output only candidateId, code, title, shortDescription.",
    "- Keep title short.",
    "- Keep shortDescription to one sentence.",
    "- Do not include long manual notes, usage notes, or examples.",
    "- Merge aliases: G0->G00, G1->G01, G2->G02, G3->G03, G4->G04, G9->G09, M0->M00, M1->M01, M2->M02, M3->M03, M4->M04, M5->M05.",
    "- Keep special codes when meaningful, including T, A, ,R, ,C, !1!2L1.",
    "- If unsure, keep the same code and use a conservative factual title and shortDescription.",
    "",
    "Input JSON:",
    JSON.stringify(input),
  ].join("\n");
}

function validateRows(payload: unknown) {
  const record = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const rowValues = Array.isArray(record.rows) ? record.rows : [];
  const seenCandidateIds = new Set<string>();
  const rows: CleanupRow[] = [];

  for (const row of rowValues) {
    const entry = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
    const candidateId = trimToLength(entry.candidateId ?? entry.candidate_id, 40);
    const code = normalizeCode(entry.code);
    if (!code) continue;

    if (candidateId && seenCandidateIds.has(candidateId)) continue;
    if (candidateId) seenCandidateIds.add(candidateId);

    const title = trimToLength(entry.title, 88) || code;
    const shortDescription = trimToLength(entry.shortDescription ?? entry.short_description, 120) || title;
    rows.push({ candidateId, code, title, shortDescription });
  }

  if (rows.length === 0) {
    throw new Error("AI returned invalid data.");
  }

  return rows;
}

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const shopId = String(record.shop_id ?? record.shopId ?? "").trim();
    const deviceId = String(record.device_id ?? record.deviceId ?? "").trim();
    const machineName = trimToLength(record.machine_name ?? record.machineName, 120);
    const sourceFileName = trimToLength(record.source_file_name ?? record.sourceFileName, 180);

    if (!shopId) return NextResponse.json({ ok: false, error: "Missing shop_id" }, { status: 400 });
    if (!deviceId) return NextResponse.json({ ok: false, error: "Missing device_id" }, { status: 400 });
    if (!machineName) return NextResponse.json({ ok: false, error: "Missing machine_name" }, { status: 400 });

    const candidates = requireCandidates(record);
    const admin = supabaseAdmin();

    const { data: membership, error: membershipError } = await admin
      .from("rb_shop_members")
      .select("role")
      .eq("shop_id", shopId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw new Error(membershipError.message);
    if (!membership) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const deviceCheck = await requireActiveDevice(admin, shopId, deviceId);
    if (!deviceCheck.ok) return NextResponse.json({ ok: false, error: deviceCheck.error }, { status: 403 });

    const entitlement = await getShopEntitlement(shopId);
    if (!entitlement.allowed || entitlement.restricted) {
      return NextResponse.json({ ok: false, error: entitlement.reason, entitlement }, { status: 402 });
    }

    checkRateLimit(shopId, deviceId);

    const model = (process.env.RUNBOOK_MACHINE_CODE_AI_MODEL ?? process.env.RUNBOOK_PO_AI_MODEL ?? "gpt-4o-mini").trim() || "gpt-4o-mini";
    const payload = {
      model,
      text: { format: { type: "json_object" } },
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: buildPrompt(machineName, sourceFileName, candidates) }],
        },
      ],
      max_output_tokens: parsePositiveInt(
        process.env.RUNBOOK_MACHINE_CODE_AI_MAX_OUTPUT_TOKENS ?? process.env.RUNBOOK_PO_AI_MAX_OUTPUT_TOKENS,
        3000
      ),
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
        { ok: false, error: `OpenAI machine-code cleanup failed (${openAiResponse.status}).` },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(text) as OpenAiResponseEnvelope;
    const outputText = getOutputText(parsed);
    if (!outputText) throw new Error("OpenAI response had no output text.");

    const validatedRows = validateRows(JSON.parse(outputText) as unknown);
    const validatedOutput = JSON.stringify({ rows: validatedRows });
    const inputTokens = Number(parsed.usage?.input_tokens ?? 0) || 0;
    const outputTokens = Number(parsed.usage?.output_tokens ?? 0) || 0;
    const estimatedCostUsd = estimateCostUsd(inputTokens, outputTokens);

    console.info("desktop.machine_code_cleanup", {
      shopId,
      deviceId,
      machineName,
      sourceFileName,
      candidateCount: candidates.length,
      rowCount: validatedRows.length,
      model,
    });

    return NextResponse.json({
      ok: true,
      provider: "openai",
      model,
      response_id: String(parsed.id ?? ""),
      output_text: validatedOutput,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
      estimated_cost_usd: estimatedCostUsd,
      response: parsed,
      rows: validatedRows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /not authenticated/i.test(message) ? 401 : /limit reached/i.test(message) ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
