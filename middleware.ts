import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-url", req.nextUrl.pathname);
  headers.set("x-original-url", req.nextUrl.pathname);
  return NextResponse.next({
    request: { headers },
  });
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*|api).*)",
  ],
};
