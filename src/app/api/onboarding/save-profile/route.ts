import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const first_name = String((body as any)?.first_name ?? "").trim();
    const last_name = String((body as any)?.last_name ?? "").trim();
    const phone = (body as any)?.phone ? String((body as any).phone).trim() : null;

    if (!first_name || !last_name) {
      return NextResponse.json({ ok: false, error: "First and last name required" }, { status: 400 });
    }

    const { error } = await supabase.from("rb_profiles").upsert({
      id: user.id,
      first_name,
      last_name,
      phone,
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
