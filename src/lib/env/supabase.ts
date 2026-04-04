export function getDatabaseUrl(): string {
  const value = String(process.env.SUPABASE_DB_URL ?? "").trim();
  if (value) {
    return value;
  }

  throw new Error("Supabase not configured. Set SUPABASE_DB_URL or run `npx supabase link`.");
}
