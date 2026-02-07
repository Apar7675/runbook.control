import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes straight through
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Create a response we can attach refreshed cookies to
  const res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anon) {
    // If env missing, don't infinite loop—just allow the request so you can see the error elsewhere.
    return res;
  }

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

  // This both validates and refreshes the session cookie if needed
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(login);
  }

  return res;
}

export const config = {
  // Protect everything except Next internals + static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
