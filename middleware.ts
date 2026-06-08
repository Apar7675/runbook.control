import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/restricted",
  "/auth/callback",
  "/reset-password",
  "/signup",

  // Stripe return pages MUST be public
  "/billing/complete",
  "/billing/cancel",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

const DESKTOP_ONBOARDING_API_PATHS = new Set([
  "/api/onboarding/send-email-code",
  "/api/onboarding/verify-email-code",
  "/api/onboarding/send-sms-code",
  "/api/onboarding/verify-sms-code",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/api/onboarding" || pathname.startsWith("/api/onboarding/")) {
    if (DESKTOP_ONBOARDING_API_PATHS.has(pathname)) {
      return NextResponse.next();
    }

    return NextResponse.json(
      {
        error: "RunBook Control web onboarding is disabled. Customer setup is completed from RunBook Desktop.",
      },
      { status: 403 }
    );
  }

  const headers = new Headers(req.headers);
  headers.set("x-url", pathname);
  headers.set("x-original-url", pathname);
  headers.set("next-url", pathname);

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  const res = NextResponse.next({ request: { headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return res;

  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)", "/api/onboarding/:path*"],
};
