import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = (url.searchParams.get("session_id") ?? "").trim();
  if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

  // Call the existing endpoint using the same cookies (browser auth)
  const res = await fetch(`${url.origin}/api/billing/sync-from-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
    body: JSON.stringify({ session_id }),
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  return NextResponse.json(json ?? { ok: false, error: text || "Unknown" }, { status: res.status });
}
