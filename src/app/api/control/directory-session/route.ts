import { requireAal2 } from "@/lib/authz";
import { bindVerifiedControlSession } from "@/lib/business/directoryAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };

// Public identity metadata for an actual MFA-verified browser session. No grant,
// enrollment, role, delegation, token or business data is returned or changed.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.origin !== "https://runbook-control.vercel.app" || url.pathname !== "/api/control/directory-session" || url.search ||
        req.headers.get("sec-fetch-site") !== "same-origin") return Response.json({ ok: false }, { status: 403, headers });
    const { supabase, user } = await requireAal2();
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (session.error || !token) throw new Error("No current session");
    const exact = await supabase.auth.getUser(token);
    if (exact.error || !exact.data.user || exact.data.user.id !== user.id || exact.data.user.is_anonymous === true) throw new Error("Session changed");
    const principal = bindVerifiedControlSession(token, user.id, Date.now());
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
    if (claims.aal !== "aal2") throw new Error("MFA required");
    return Response.json({ ok: true, user_id: principal.user_id, session_id: principal.session_id,
      expires_utc: new Date(principal.expires_ms).toISOString(), assurance: "aal2" }, { headers });
  } catch {
    return Response.json({ ok: false, error: "Sign in and verify your authenticator to view this session." }, { status: 401, headers });
  }
}
