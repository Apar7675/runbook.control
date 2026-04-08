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

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePassword(value: unknown) {
  return String(value ?? "");
}

export async function GET() {
  try {
    env("NEXT_PUBLIC_SUPABASE_URL");
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    return NextResponse.json({
      ok: true,
      msg: "RunBook account signup is available.",
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, msg: error?.message ?? "Signup unavailable." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail((body as any)?.email);
    const password = normalizePassword((body as any)?.password);

    if (!email) {
      return NextResponse.json({ msg: "Email is required." }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ msg: "Password is required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ msg: "Password must be at least 8 characters." }, { status: 400 });
    }

    const supabase = createPublicClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return NextResponse.json(
        {
          msg: error.message,
          error_description: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email ?? email,
          }
        : null,
      session: data.session
        ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at ?? null,
          }
        : null,
      msg: data.session
        ? "Account created."
        : "Account created. Verify your email to continue.",
      error_description: null,
    });
  } catch (error: any) {
    return NextResponse.json({ msg: error?.message ?? "Signup failed." }, { status: 500 });
  }
}
