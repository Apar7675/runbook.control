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
    const password = String((body as any)?.password ?? "");

    if (!email) {
      return NextResponse.json({ msg: "Email is required." }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ msg: "Password must be at least 8 characters." }, { status: 400 });
    }

    const supabase = createPublicClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return NextResponse.json({ msg: error.message }, { status: 400 });
    }

    const session = data.session;
    const expiresAtUtc = session?.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : null;

    return NextResponse.json({
      user: {
        id: data.user?.id ?? null,
        email: data.user?.email ?? email,
      },
      session: session
        ? {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            expires_at_utc: expiresAtUtc,
          }
        : null,
      msg: null,
      error_description: null,
    });
  } catch (error: any) {
    return NextResponse.json({ msg: error?.message ?? "Signup failed." }, { status: 500 });
  }
}
