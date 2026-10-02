import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/desktopAuth";
import { requireShopEntitlementWriteAllowed } from "@/lib/billing/writeGuard";
import {
  readBoundedExactJsonObject,
  SecurityJsonRequestError,
} from "@/lib/security/boundedJsonRequest";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { supabaseForAccessToken } from "@/lib/supabase/bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAXIMUM_MESSAGE_CHARACTERS = 10_000;
const MAXIMUM_THREAD_MESSAGES = 100;
const MAXIMUM_JSON_RESPONSE_BYTES = 512 * 1024;
const MAXIMUM_THREAD_PAYLOAD_BYTES = 480 * 1024;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

class MessagingRouteError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MessagingRouteError";
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
    throw new MessagingRouteError(`${field} must be a UUID.`, 400);
  }
  return normalized;
}

function jsonByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function noStoreJson(value: unknown, status = 200) {
  if (jsonByteLength(value) > MAXIMUM_JSON_RESPONSE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "The messaging response exceeded the safe size limit." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  return NextResponse.json(value, { status, headers: NO_STORE_HEADERS });
}

function throwDatabaseError(
  error: { code?: string | null } | null | undefined,
  authorizationMessage = "Messaging access is not authorized.",
): never {
  const code = text(error?.code);
  if (code === "42501") throw new MessagingRouteError(authorizationMessage, 403);
  if (code === "22023" || code === "22P02" || code === "23503" || code === "23514") {
    throw new MessagingRouteError("The messaging request is invalid.", 400);
  }
  throw new MessagingRouteError("Messaging is temporarily unavailable.", 503);
}

function rpcScalarUuid(data: unknown) {
  if (typeof data === "string") return UUID_PATTERN.test(data) ? data : "";
  const row = Array.isArray(data) ? data[0] : data;
  const record = row as { conversation_id?: unknown; id?: unknown } | null;
  const value = text(record?.conversation_id ?? record?.id);
  return UUID_PATTERN.test(value) ? value : "";
}

async function requireMessagingSession(req: Request) {
  try {
    return await requireSessionUser(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not authenticated|invalid jwt|jwt expired/i.test(message)) {
      throw new MessagingRouteError("Authentication required.", 401);
    }
    throw new MessagingRouteError("Authentication is temporarily unavailable.", 503);
  }
}

function enforceRateLimit(userId: string, operation: "read" | "send") {
  try {
    rateLimitOrThrow({
      key: `f06:desktop-messaging:${operation}:${userId.toLowerCase()}`,
      limit: operation === "send" ? 60 : 240,
      windowMs: 60_000,
    });
  } catch {
    throw new MessagingRouteError("Messaging is temporarily rate limited.", 429);
  }
}

async function assertDesktopActor(client: any, shopId: string, senderEmployeeId: string) {
  const { error } = await client.rpc("rb_messaging_assert_actor_employee_id", {
    p_shop_id: shopId,
    p_asserted_employee_id: senderEmployeeId,
  });
  if (error) {
    throwDatabaseError(
      error,
      "Desktop messaging is limited to the active employee bound to this authenticated Control account.",
    );
  }
}

async function loadThread(client: any, shopId: string, conversationId: string) {
  if (!conversationId) return { conversation_id: "", messages: [] };

  const { data, error } = await client.rpc("rb_messaging_list_messages", {
    p_shop_id: shopId,
    p_conversation_id: conversationId,
    p_limit: MAXIMUM_THREAD_MESSAGES,
  });
  if (error) throwDatabaseError(error);

  const rows = Array.isArray(data) ? data.slice(-MAXIMUM_THREAD_MESSAGES) : [];
  const sanitized = rows.map((message: any) => ({
    id: boundedText(message.id, 36),
    shop_id: boundedText(message.shop_id, 36),
    conversation_id: boundedText(message.conversation_id, 36),
    sender_employee_id: boundedText(message.sender_employee_id, 36),
    sender_display_name: boundedText(message.sender_display_name, 200) || "Employee",
    body: boundedText(message.body, MAXIMUM_MESSAGE_CHARACTERS),
    created_at: boundedText(message.created_at, 64),
    edited_at: message.edited_at ? boundedText(message.edited_at, 64) : null,
  }));
  const boundedNewestFirst: typeof sanitized = [];
  let payloadBytes = 2;
  for (let index = sanitized.length - 1; index >= 0; index -= 1) {
    const messageBytes = jsonByteLength(sanitized[index]) + 1;
    if (boundedNewestFirst.length > 0 && payloadBytes + messageBytes > MAXIMUM_THREAD_PAYLOAD_BYTES) {
      break;
    }
    boundedNewestFirst.push(sanitized[index]);
    payloadBytes += messageBytes;
  }

  return {
    conversation_id: conversationId,
    messages: boundedNewestFirst.reverse(),
  };
}

function errorResponse(error: unknown) {
  if (error instanceof SecurityJsonRequestError) {
    return noStoreJson({ ok: false, error: error.message }, error.status);
  }
  if (error instanceof MessagingRouteError) {
    return noStoreJson({ ok: false, error: error.message }, error.status);
  }
  if (error instanceof Error && /billing required/i.test(error.message)) {
    return noStoreJson(
      { ok: false, error: "Full shop access is required for messaging." },
      403,
    );
  }
  return noStoreJson({ ok: false, error: "Messaging is temporarily unavailable." }, 500);
}

export async function GET(req: NextRequest) {
  try {
    const { user, accessToken } = await requireMessagingSession(req);
    enforceRateLimit(user.id, "read");

    const shopId = requireUuid(req.nextUrl.searchParams.get("shop_id"), "shop_id");
    const senderEmployeeId = requireUuid(
      req.nextUrl.searchParams.get("sender_employee_id"),
      "sender_employee_id",
    );
    const recipientEmployeeId = requireUuid(
      req.nextUrl.searchParams.get("recipient_employee_id"),
      "recipient_employee_id",
    );

    const client = supabaseForAccessToken(accessToken);
    await assertDesktopActor(client, shopId, senderEmployeeId);

    const { data, error } = await client.rpc("rb_messaging_find_dm", {
      p_shop_id: shopId,
      p_other_employee_id: recipientEmployeeId,
    });
    if (error) throwDatabaseError(error);

    // A missing direct message stays missing; GET never creates or mutates one.
    const thread = await loadThread(client, shopId, rpcScalarUuid(data));
    return noStoreJson({
      ok: true,
      auth_mode: "user",
      shop_id: shopId,
      conversation_id: thread.conversation_id,
      messages: thread.messages,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const { user, accessToken } = await requireMessagingSession(req);
    enforceRateLimit(user.id, "send");

    const body = await readBoundedExactJsonObject(req, {
      shop_id: "string",
      sender_employee_id: "string",
      recipient_employee_id: "string",
      body: "string",
    });
    const shopId = requireUuid(body.shop_id, "shop_id");
    const senderEmployeeId = requireUuid(body.sender_employee_id, "sender_employee_id");
    const recipientEmployeeId = requireUuid(
      body.recipient_employee_id,
      "recipient_employee_id",
    );
    const messageBody = text(body.body);
    const messageCharacters = Array.from(messageBody).length;
    if (messageCharacters < 1 || messageCharacters > MAXIMUM_MESSAGE_CHARACTERS) {
      throw new MessagingRouteError("body must contain 1 to 10000 characters.", 400);
    }

    const client = supabaseForAccessToken(accessToken);

    // The submitted Desktop employee id is only an assertion. The database
    // derives the actor from the verified bearer and rejects any mismatch before
    // the entitlement read, conversation lookup, or message write.
    await assertDesktopActor(client, shopId, senderEmployeeId);
    await requireShopEntitlementWriteAllowed(shopId, "desktop.messaging.send");

    const { data, error } = await client.rpc("rb_messaging_send_dm", {
      p_shop_id: shopId,
      p_other_employee_id: recipientEmployeeId,
      p_body: messageBody,
    });
    if (error) throwDatabaseError(error);

    const conversationId = rpcScalarUuid(data);
    if (!conversationId) {
      throw new MessagingRouteError("Messaging is temporarily unavailable.", 503);
    }
    const thread = await loadThread(client, shopId, conversationId);
    return noStoreJson({
      ok: true,
      auth_mode: "user",
      conversation_id: thread.conversation_id,
      messages: thread.messages,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
