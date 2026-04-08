import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizeNext(raw: string | null) {
  const fallback = "/shops";
  const next = String(raw ?? "").trim();

  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("/login")) return fallback;
  if (next.startsWith("/signup")) return fallback;
  if (next === "/dashboard") return fallback;
  return next;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = sanitizeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  try
  {
    const supabase = await supabaseServer();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, url));
      }
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });

      if (!error) {
        return NextResponse.redirect(new URL(next, url));
      }
    }
  }
  catch {
  }

  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=magic_link_failed`, url));
}
