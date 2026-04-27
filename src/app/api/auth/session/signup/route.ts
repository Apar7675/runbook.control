import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

    const admin = supabaseAdmin();
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (created.error) {
      return NextResponse.json({ msg: created.error.message }, { status: 400 });
    }

    const supabase = createPublicClient();
    const signedIn = await supabase.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) {
      return NextResponse.json(
        { msg: signedIn.error?.message ?? "Account was created, but session login failed." },
        { status: 401 }
      );
    }

    const session = signedIn.data.session;
    const expiresAtUtc = session?.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : null;

    return NextResponse.json({
      user: {
        id: created.data.user?.id ?? signedIn.data.user?.id ?? null,
        email: created.data.user?.email ?? signedIn.data.user?.email ?? email,
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
