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
    const refreshToken = String((body as any)?.refresh_token ?? "").trim();
    if (!refreshToken) {
      return NextResponse.json({ ok: false, error: "Refresh token is required." }, { status: 400 });
    }

    const supabase = createPublicClient();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    if (!data.session?.access_token || !data.session.refresh_token || !data.user?.id) {
      return NextResponse.json({ ok: false, error: "Session refresh did not return a valid session." }, { status: 500 });
    }

    const expiresAtUtc = data.session.expires_at
      ? new Date(data.session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    return NextResponse.json({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at_utc: expiresAtUtc,
        user_id: data.user.id,
        email: data.user.email ?? "",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Session refresh failed." }, { status: 500 });
  }
}
