import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isDisposableEmail, normalizeEmail } from "@/lib/onboarding/identity";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isDuplicateAuthError(message: string) {
  const text = String(message ?? "").toLowerCase();
  return text.includes("already registered") || text.includes("already been registered") || text.includes("already exists") || text.includes("user already");
}

async function findAuthUserByEmail(email: string) {
  const admin = supabaseAdmin();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const match = (data?.users ?? []).find((user: any) => normalizeEmail(user?.email) === email);
    if (match) return match;
    if (!data?.users || data.users.length < 1000) break;
  }

  return null;
}

function duplicateEmailResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "This email already has a RunBook account. Sign in instead.",
      error_description: "This email already has an account. Sign in instead.",
      error_code: "email_already_exists",
    },
    { status: 409 }
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "RunBook account signup is available." });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail((body as any)?.email);
    const password = String((body as any)?.password ?? "");
    const ip = req.headers.get("x-forwarded-for") ?? "local";

    rateLimitOrThrow({ key: `auth:signup:ip:${ip}`, limit: 8, windowMs: 10 * 60_000 });
    if (email) rateLimitOrThrow({ key: `auth:signup:email:${email}`, limit: 3, windowMs: 30 * 60_000 });

    if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    if (!isValidEmail(email)) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    if (isDisposableEmail(email)) return NextResponse.json({ ok: false, error: "Disposable email addresses are not allowed." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });

    const existing = await findAuthUserByEmail(email);
    if (existing?.id) return duplicateEmailResponse();

    const admin = supabaseAdmin();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        runbook_signup_source: "desktop_onboarding",
      },
    });
    if (createError) {
      if (isDuplicateAuthError(createError.message)) return duplicateEmailResponse();
      return NextResponse.json({ ok: false, error: createError.message }, { status: 400 });
    }

    if (!created.user?.id) {
      return NextResponse.json({ ok: false, error: "Account creation did not return a valid user." }, { status: 500 });
    }

    const supabase = createPublicClient();
    const login = await supabase.auth.signInWithPassword({ email, password });
    if (login.error) return NextResponse.json({ ok: false, error: login.error.message }, { status: 401 });
    const session = login.data.session;

    if (!session?.access_token || !session.refresh_token) {
      return NextResponse.json({ ok: false, error: "Account created, but no session was established." }, { status: 500 });
    }

    const expiresAtUtc = session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    return NextResponse.json({
      ok: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at_utc: expiresAtUtc,
        user_id: created.user.id,
        email: created.user.email ?? email,
      },
      user: {
        id: created.user.id,
        email: created.user.email ?? email,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Account signup failed." }, { status: 500 });
  }
}
