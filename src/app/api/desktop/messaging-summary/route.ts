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
    .select("id, shop_id, display_name")
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

export async function GET(req: NextRequest) {
  try {
    const admin = supabaseAdmin();
    const shopId = text(req.nextUrl.searchParams.get("shop_id"));
    const senderEmployeeId = text(req.nextUrl.searchParams.get("sender_employee_id"));

    if (!shopId) return NextResponse.json({ ok: false, error: "shop_id required" }, { status: 400 });
    if (!senderEmployeeId) return NextResponse.json({ ok: false, error: "sender_employee_id required" }, { status: 400 });

    const auth = await authorizeDesktop(req, admin, shopId, senderEmployeeId);

    const { data: memberRows, error: memberError } = await admin
      .from("conversation_members")
      .select("conversation_id, employee_id")
      .eq("shop_id", shopId);

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

    const dmConversationIds = Array.from(grouped.entries())
      .filter(([, employeeIds]) => employeeIds.includes(senderEmployeeId) && employeeIds.length === 2)
      .map(([conversationId]) => conversationId);

    if (dmConversationIds.length === 0) {
      return NextResponse.json({ ok: true, auth_mode: auth.mode, conversations: [] });
    }

    const { data: messageRows, error: messageError } = await admin
      .from("messages")
      .select("id, conversation_id, sender_employee_id, body, created_at, deleted_at")
      .eq("shop_id", shopId)
      .in("conversation_id", dmConversationIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);

    if (messageError) throw new Error(messageError.message);

    const latestByConversation = new Map<string, any>();
    for (const row of messageRows || []) {
      const conversationId = text((row as any).conversation_id);
      if (!conversationId || latestByConversation.has(conversationId)) continue;
      latestByConversation.set(conversationId, row);
    }

    const otherEmployeeIds = Array.from(new Set(dmConversationIds.map((conversationId) => {
      const members = grouped.get(conversationId) ?? [];
      return members.find((id) => id !== senderEmployeeId) ?? "";
    }).filter(Boolean)));

    const employeeNameMap = new Map<string, string>();
    if (otherEmployeeIds.length > 0) {
      const { data: employees, error: employeeError } = await admin
        .from("employees")
        .select("id, display_name")
        .eq("shop_id", shopId)
        .in("id", otherEmployeeIds);

      if (employeeError) throw new Error(employeeError.message);
      for (const employee of employees || []) {
        employeeNameMap.set(text((employee as any).id), text((employee as any).display_name));
      }
    }

    const conversations = dmConversationIds
      .map((conversationId) => {
        const members = grouped.get(conversationId) ?? [];
        const recipientEmployeeId = members.find((id) => id !== senderEmployeeId) ?? "";
        const last = latestByConversation.get(conversationId);
        return {
          conversation_id: conversationId,
          recipient_employee_id: recipientEmployeeId,
          recipient_display_name: employeeNameMap.get(recipientEmployeeId) || "Employee",
          last_message_id: text(last?.id),
          last_message_body: text(last?.body),
          last_message_created_at: text(last?.created_at),
          last_sender_employee_id: text(last?.sender_employee_id),
        };
      })
      .filter((row) => row.recipient_employee_id && row.last_message_id)
      .sort((a, b) => String(b.last_message_created_at).localeCompare(String(a.last_message_created_at)));

    return NextResponse.json({
      ok: true,
      auth_mode: auth.mode,
      shop_id: shopId,
      conversations,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: /authorized|authenticated/i.test(String(e?.message ?? e)) ? 401 : 500 });
  }
}

