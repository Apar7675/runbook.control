import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return NextResponse.json({ msg: "Not authenticated" }, { status: 401 });
    const token = m[1].trim();
    if (!token) return NextResponse.json({ msg: "Not authenticated" }, { status: 401 });

    const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await sb.auth.getUser(token);
    if (error) return NextResponse.json({ msg: error.message }, { status: 401 });
    if (!data.user) return NextResponse.json({ msg: "Not authenticated" }, { status: 401 });

    return NextResponse.json({
      email: data.user.email ?? "",
      email_confirmed_at: data.user.email_confirmed_at ?? null,
      confirmed_at: (data.user as any)?.confirmed_at ?? null,
      msg: null,
      error_description: null,
    });
  } catch (error: any) {
    return NextResponse.json({ msg: error?.message ?? "User lookup failed." }, { status: 500 });
  }
}
