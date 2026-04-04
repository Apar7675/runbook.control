import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function createPublicClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String((body as any)?.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ msg: "Email is required." }, { status: 400 });
    }

    const supabase = createPublicClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      return NextResponse.json({ msg: error.message }, { status: 400 });
    }

    return NextResponse.json({ msg: "Verification email sent." });
  } catch (error: any) {
    return NextResponse.json({ msg: error?.message ?? "Resend failed." }, { status: 500 });
  }
}
