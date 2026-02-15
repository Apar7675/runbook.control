import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function requireUserFromBearer(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("Not authenticated");
  const token = m[1].trim();
  if (!token) throw new Error("Not authenticated");

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const sb = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Not authenticated");

  return { user: data.user, accessToken: token };
}
