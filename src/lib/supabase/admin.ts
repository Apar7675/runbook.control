import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.https://qpykxraptlscihguclay.supabase.co"";
  const service = process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFweWt4cmFwdGxzY2loZ3VjbGF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE3MTc3NiwiZXhwIjoyMDgzNzQ3Nzc2fQ.RKavktrVxCvXUC0HMpLVSDAaYX1d8YiHGGzYlvWp3kA"";

  if (!url || !service) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
