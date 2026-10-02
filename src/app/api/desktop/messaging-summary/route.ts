import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseForAccessToken } from "@/lib/supabase/bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAXIMUM_SUMMARY_ROWS = 500;
const MAXIMUM_JSON_RESPONSE_BYTES = 512 * 1024;
const MAXIMUM_SUMMARY_PAYLOAD_BYTES = 480 * 1024;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

class MessagingSummaryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MessagingSummaryError";
    this.status = status;
  }
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function boundedText(value: unknown, maximumCharacters: number) {
  return Array.from(text(value)).slice(0, maximumCharacters).join("");
}

function requireUuid(value: unknown, field: string) {
  const normalized = text(value);
  if (!UUID_PATTERN.test(normalized)) {
    throw new MessagingSummaryError(`${field} must be a UUID.`, 400);
  }
  return normalized;
}

function noStoreJson(value: unknown, status = 200) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAXIMUM_JSON_RESPONSE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "The messaging response exceeded the safe size limit." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  return NextResponse.json(value, { status, headers: NO_STORE_HEADERS });
}

function errorResponse(error: unknown) {
  if (error instanceof MessagingSummaryError) {
    return noStoreJson({ ok: false, error: error.message }, error.status);
  }
  return noStoreJson({ ok: false, error: "Messaging is temporarily unavailable." }, 500);
}

export async function GET(req: NextRequest) {
  try {
    let session: Awaited<ReturnType<typeof requireSessionUser>>;
    try {
      session = await requireSessionUser(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/not authenticated|invalid jwt|jwt expired/i.test(message)) {
        throw new MessagingSummaryError("Authentication required.", 401);
      }
      throw new MessagingSummaryError("Authentication is temporarily unavailable.", 503);
    }

    try {
      rateLimitOrThrow({
        key: `f06:desktop-messaging:summary:${session.user.id.toLowerCase()}`,
        limit: 240,
        windowMs: 60_000,
      });
    } catch {
      throw new MessagingSummaryError("Messaging is temporarily rate limited.", 429);
    }

    const shopId = requireUuid(req.nextUrl.searchParams.get("shop_id"), "shop_id");
    const senderEmployeeId = requireUuid(
      req.nextUrl.searchParams.get("sender_employee_id"),
      "sender_employee_id",
    );
    const client = supabaseForAccessToken(session.accessToken);

    const { error: assertionError } = await client.rpc(
      "rb_messaging_assert_actor_employee_id",
      {
        p_shop_id: shopId,
        p_asserted_employee_id: senderEmployeeId,
      },
    );
    if (assertionError) {
      const status = text(assertionError.code) === "42501" ? 403 : 503;
      throw new MessagingSummaryError(
        status === 403
          ? "Desktop messaging is limited to the active employee bound to this authenticated Control account."
          : "Messaging is temporarily unavailable.",
        status,
      );
    }

    const { data, error } = await client.rpc("rb_messaging_dm_summary", {
      p_shop_id: shopId,
    });
    if (error) {
      const status = text(error.code) === "42501" ? 403 : 503;
      throw new MessagingSummaryError(
        status === 403 ? "Messaging access is not authorized." : "Messaging is temporarily unavailable.",
        status,
      );
    }

    const rows = Array.isArray(data) ? data.slice(0, MAXIMUM_SUMMARY_ROWS) : [];
    const sanitized = rows.map((row: any) => ({
      conversation_id: boundedText(row.conversation_id, 36),
      recipient_employee_id: boundedText(row.recipient_employee_id, 36),
      recipient_display_name: boundedText(row.recipient_display_name, 200) || "Employee",
      last_message_id: boundedText(row.last_message_id, 36),
      last_message_body: row.last_message_body == null
        ? null
        : boundedText(row.last_message_body, 10_000),
      last_message_created_at: row.last_message_created_at == null
        ? null
        : boundedText(row.last_message_created_at, 64),
      last_sender_employee_id: row.last_sender_employee_id == null
        ? null
        : boundedText(row.last_sender_employee_id, 36),
    }));
    const conversations: typeof sanitized = [];
    let payloadBytes = 2;
    for (const conversation of sanitized) {
      const conversationBytes = new TextEncoder().encode(JSON.stringify(conversation)).byteLength + 1;
      if (conversations.length > 0 && payloadBytes + conversationBytes > MAXIMUM_SUMMARY_PAYLOAD_BYTES) {
        break;
      }
      conversations.push(conversation);
      payloadBytes += conversationBytes;
    }

    return noStoreJson({
      ok: true,
      auth_mode: "user",
      shop_id: shopId,
      conversations,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
