import { supabaseBrowser } from "@/lib/supabase/client";

export { supabaseBrowser };

/** Compatibility alias for existing browser pages. */
export function getBrowserSupabase() {
  return supabaseBrowser();
}
