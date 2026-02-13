// REPLACE ENTIRE FILE: src/app/api/billing/sync-from-session-browser/route.ts
//
// HARDENING (this pass):
// - Adds rate limit (same pattern as sync-from-session).
// - Forwards x-forwarded-for/user-agent for better audit + throttling upstream.
// - Keeps cookie forwarding so SSR auth works.
// - Uses no-store and returns upstream status/body safely.

import { NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `billing:syncbrowser:${ip}`, limit: 60, windowMs: 60_000 });

    const url = new URL(req.url);
    const session_id = (url.searchParams.get("session_id") ?? "").trim();
    if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

    // Call the existing endpoint using the same cookies (browser auth)
    const res = await fetch(`${url.origin}/api/billing/sync-from-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
        "user-agent": req.headers.get("user-agent") ?? "",
      },
      body: JSON.stringify({ session_id }),
      cache: "no-store",
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore parse errors
    }

    return NextResponse.json(json ?? { ok: false, error: text || "Unknown" }, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
