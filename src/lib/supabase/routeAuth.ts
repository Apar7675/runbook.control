import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "./server";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? "";
}

export async function getRouteUser(req: Request) {
  const token = bearerToken(req);
  if (token) {
    const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error) return null;
    return user ?? null;
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}
