import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(v: any) {
  return String(v ?? "").trim();
}

function isLocalDesktopRequest(req: Request) {
  const host = text(req.headers.get("host")).toLowerCase();
  return host.includes("localhost") || host.includes("127.0.0.1");
}

async function ensureMembership(admin: any, shopId: string, userId: string) {
  const { data, error } = await admin
    .from("rb_shop_members")
    .select("shop_id, user_id, role")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.shop_id) throw new Error("Not authorized for this shop.");
  return data;
}

async function getEmployee(admin: any, shopId: string, employeeId: string) {
  const { data, error } = await admin
    .from("employees")
    .select("id, shop_id, auth_user_id, display_name, role, is_active, avatar_url_256")
    .eq("shop_id", shopId)
    .eq("id", employeeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Employee not found in this shop.");
  return data;
}

async function authorizeDesktop(req: Request, admin: any, shopId: string, senderEmployeeId: string) {
  try {
    const { user } = await requireSessionUser(req);
    await ensureMembership(admin, shopId, user.id);
    return { mode: "user", userId: user.id } as const;
  } catch (error: any) {
    if (!isLocalDesktopRequest(req)) throw error;

    const sender = await getEmployee(admin, shopId, senderEmployeeId);
    if (!sender?.id) throw error;

    return { mode: "local-dev", userId: null } as const;
  }
}

async function resolveDirectMessageConversation(admin: any, shopId: string, senderEmployeeId: string, recipientEmployeeId: string) {
  const pair = [senderEmployeeId, recipientEmployeeId].sort();
  const a = pair[0];
  const b = pair[1];

  const { data: convoRows, error: convoError } = await admin
    .from("conversations")
    .select("id")
    .eq("shop_id", shopId)
    .eq("type", "dm")
    .is("deleted_at", null)
    .limit(100);

  if (convoError) throw new Error(convoError.message);

  const convoIds = (convoRows || []).map((row: any) => text(row.id)).filter(Boolean);

  if (convoIds.length > 0) {
    const { data: memberRows, error: memberError } = await admin
      .from("conversation_members")
      .select("conversation_id, employee_id")
      .eq("shop_id", shopId)
      .in("conversation_id", convoIds);

    if (memberError) throw new Error(memberError.message);

    const grouped = new Map<string, string[]>();
    for (const row of memberRows || []) {
      const conversationId = text((row as any).conversation_id);
      const employeeId = text((row as any).employee_id);
      if (!conversationId || !employeeId) continue;
      const list = grouped.get(conversationId) ?? [];
      list.push(employeeId);
      grouped.set(conversationId, list);
    }

    for (const conversationId of convoIds) {
      const members = (grouped.get(conversationId) ?? []).filter(Boolean).sort();
      if (members.length === 2 && members[0] === a && members[1] === b) {
        return conversationId;
      }
    }
  }

  const { data: insertedConversation, error: insertConversationError } = await admin
    .from("conversations")
    .insert({
      shop_id: shopId,
      type: "dm",
      title: null,
      created_by: senderEmployeeId,
      created_by_employee_id: senderEmployeeId,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertConversationError) throw new Error(insertConversationError.message);

  const conversationId = text(insertedConversation?.id);
  if (!conversationId) throw new Error("Conversation could not be created.");

  const { error: memberInsertError } = await admin.from("conversation_members").insert([
    { shop_id: shopId, conversation_id: conversationId, employee_id: a, member_role: "member", is_active: true },
    { shop_id: shopId, conversation_id: conversationId, employee_id: b, member_role: "member", is_active: true },
  ]);

  if (memberInsertError) throw new Error(memberInsertError.message);

  return conversationId;
}

async function loadThread(admin: any, shopId: string, senderEmployeeId: string, recipientEmployeeId: string) {
  const conversationId = await resolveDirectMessageConversation(admin, shopId, senderEmployeeId, recipientEmployeeId);

  const { data: messages, error: messageError } = await admin
    .from("messages")
    .select("id, shop_id, conversation_id, sender_employee_id, body, created_at, edited_at, deleted_at")
    .eq("shop_id", shopId)
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(150);

  if (messageError) throw new Error(messageError.message);

  const senderIds = Array.from(new Set((messages || []).map((m: any) => text(m.sender_employee_id)).filter(Boolean)));
  const nameMap = new Map<string, string>();

  if (senderIds.length > 0) {
    const { data: employees, error: empError } = await admin
      .from("employees")
      .select("id, display_name")
      .eq("shop_id", shopId)
      .in("id", senderIds);

    if (empError) throw new Error(empError.message);
    for (const employee of employees || []) nameMap.set(text(employee.id), text(employee.display_name));
  }

  return {
    conversation_id: conversationId,
    messages: (messages || []).map((m: any) => ({
      id: text(m.id),
      shop_id: text(m.shop_id),
      conversation_id: text(m.conversation_id),
      sender_employee_id: text(m.sender_employee_id),
      sender_display_name: nameMap.get(text(m.sender_employee_id)) || "Employee",
      body: text(m.body),
      created_at: text(m.created_at),
      edited_at: m.edited_at ? text(m.edited_at) : null,
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const admin = supabaseAdmin();

    const shopId = text(req.nextUrl.searchParams.get("shop_id"));
    const senderEmployeeId = text(req.nextUrl.searchParams.get("sender_employee_id"));
    const recipientEmployeeId = text(req.nextUrl.searchParams.get("recipient_employee_id"));

    if (!shopId) return NextResponse.json({ ok: false, error: "shop_id required" }, { status: 400 });
    if (!senderEmployeeId) return NextResponse.json({ ok: false, error: "sender_employee_id required" }, { status: 400 });
    if (!recipientEmployeeId) return NextResponse.json({ ok: false, error: "recipient_employee_id required" }, { status: 400 });

    const auth = await authorizeDesktop(req, admin, shopId, senderEmployeeId);
    const [sender, recipient] = await Promise.all([
      getEmployee(admin, shopId, senderEmployeeId),
      getEmployee(admin, shopId, recipientEmployeeId),
    ]);

    const thread = await loadThread(admin, shopId, senderEmployeeId, recipientEmployeeId);

    return NextResponse.json({
      ok: true,
      auth_mode: auth.mode,
      shop_id: shopId,
      sender,
      recipient,
      conversation_id: thread.conversation_id,
      messages: thread.messages,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: /authorized|authenticated/i.test(String(e?.message ?? e)) ? 401 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = supabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const shopId = text(body.shop_id);
    const senderEmployeeId = text(body.sender_employee_id);
    const recipientEmployeeId = text(body.recipient_employee_id);
    const messageBody = text(body.body);

    if (!shopId) return NextResponse.json({ ok: false, error: "shop_id required" }, { status: 400 });
    if (!senderEmployeeId) return NextResponse.json({ ok: false, error: "sender_employee_id required" }, { status: 400 });
    if (!recipientEmployeeId) return NextResponse.json({ ok: false, error: "recipient_employee_id required" }, { status: 400 });
    if (!messageBody) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });

    const auth = await authorizeDesktop(req, admin, shopId, senderEmployeeId);
    await Promise.all([
      getEmployee(admin, shopId, senderEmployeeId),
      getEmployee(admin, shopId, recipientEmployeeId),
    ]);

    const conversationId = await resolveDirectMessageConversation(admin, shopId, senderEmployeeId, recipientEmployeeId);

    const { error: insertError } = await admin.from("messages").insert({
      shop_id: shopId,
      conversation_id: conversationId,
      sender_employee_id: senderEmployeeId,
      body: messageBody,
    });

    if (insertError) throw new Error(insertError.message);

    const thread = await loadThread(admin, shopId, senderEmployeeId, recipientEmployeeId);

    return NextResponse.json({
      ok: true,
      auth_mode: auth.mode,
      conversation_id: thread.conversation_id,
      messages: thread.messages,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: /authorized|authenticated/i.test(String(e?.message ?? e)) ? 401 : 500 });
  }
}

