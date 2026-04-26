import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function sanitizeNext(raw: string | null) {
  const fallback = "/shops";
  const next = (raw ?? "").trim();

  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("/login")) return fallback;
  if (next.startsWith("/signup")) return fallback;
  if (next.startsWith("/auth/callback")) return fallback;

  return next;
}

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const type = (requestUrl.searchParams.get("type") ?? "").trim().toLowerCase();
  const next = sanitizeNext(requestUrl.searchParams.get("next"));
  const destination = type === "recovery" ? "/reset-password" : next;
  const redirectUrl = new URL(destination, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);

  if (!url || !anon) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "missing_supabase_env");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  if (!code) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(loginUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    loginUrl.searchParams.set("message", error.message);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
