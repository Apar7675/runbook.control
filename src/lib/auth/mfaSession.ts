import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createChunks, DEFAULT_COOKIE_OPTIONS, isChunkLike, parseCookieHeader,
  serializeCookieHeader, stringFromBase64URL, stringToBase64URL, type CookieOptions,
} from "@supabase/ssr";

type Auth = SupabaseClient["auth"];
type Cookie = { name: string; value: string };
type CookieChange = Cookie & { options: CookieOptions };
type Tokens = { access_token: string; refresh_token: string };
export type BoundMfaFlow = {
  userId: string;
  auth: Auth;
  assertCurrent(): void;
  promote(tokens: Tokens): Promise<void>;
  dispose(): void;
};
const COOKIE_LOCK = "runbook-control-auth-cookie-commit";
const RETIRED = "The signed-in session changed. Reload before continuing.";

export function readControlCookies(): Cookie[] {
  if (typeof document === "undefined") return [];
  return parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? "" }));
}

async function commitCookies(
  changes: CookieChange[], requireLock: boolean, guard: () => void = () => {},
  committed: () => void = () => {},
): Promise<void> {
  // Serialization can throw. Complete it before the first cookie assignment.
  const lines = changes.map(({ name, value, options }) => serializeCookieHeader(name, value, options));
  const write = () => {
    guard();
    for (const line of lines) document.cookie = line;
    committed();
  };
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (locks?.request) {
    await locks.request(COOKIE_LOCK, { mode: "exclusive" }, write);
  } else {
    if (requireLock) throw new Error("This browser cannot safely complete authenticator verification. Use a browser with Web Locks support.");
    write();
  }
}

/** Shared by the ordinary browser clients; MFA commits require this same writer lock. */
export async function writeControlCookies(changes: CookieChange[]): Promise<void> {
  await commitCookies(changes, false);
}

function snapshot(key: string): Cookie[] {
  return readControlCookies().filter((cookie) => isChunkLike(cookie.name, key))
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}
function sameSnapshot(a: Cookie[], b: Cookie[]) { return JSON.stringify(a) === JSON.stringify(b); }
function cookieSession(cookies: Cookie[], key: string): Tokens {
  const direct = cookies.find((cookie) => cookie.name === key)?.value;
  let encoded = direct ?? "";
  if (!direct) {
    for (let index = 0; ; index++) {
      const value = cookies.find((cookie) => cookie.name === key + "." + index)?.value;
      if (!value) break;
      encoded += value;
    }
  }
  if (!encoded) throw new Error(RETIRED);
  try {
    const value = JSON.parse(encoded.startsWith("base64-") ? stringFromBase64URL(encoded.slice(7)) : encoded);
    if (typeof value.access_token !== "string" || typeof value.refresh_token !== "string") throw new Error(RETIRED);
    return value;
  } catch { throw new Error(RETIRED); }
}
function claims(token: string): { sub: string; session_id: string; aal?: string; exp: number } {
  try {
    const parts = token.split(".");
    const value = JSON.parse(stringFromBase64URL(parts[1] ?? ""));
    if (parts.length !== 3 || typeof value.sub !== "string" || typeof value.session_id !== "string" ||
        !value.session_id || typeof value.exp !== "number" || !Number.isFinite(value.exp)) throw new Error(RETIRED);
    return value;
  } catch { throw new Error(RETIRED); }
}
function uniqueKey() { return "runbook-mfa-" + crypto.randomUUID(); }

/**
 * Bind SDK provider calls to one validated account/session. The cookie barrier
 * coordinates app JavaScript writers; HTTP Set-Cookie writers are not locked.
 */
export async function captureMfaFlow(mainAuth: Auth, expectedUserId: string, isCurrent: () => boolean): Promise<BoundMfaFlow> {
  if (!isCurrent()) throw new Error(RETIRED);
  if (typeof navigator === "undefined" || !navigator.locks?.request) throw new Error("This browser cannot safely complete authenticator verification. Use a browser with Web Locks support.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) throw new Error("Supabase browser configuration is unavailable.");
  const cookieKey = "sb-" + new URL(url).hostname.split(".")[0] + "-auth-token";
  const { data: captured, error: captureError } = await mainAuth.getSession();
  if (captureError) throw new Error(captureError.message);
  if (!isCurrent() || !captured.session?.access_token || !captured.session.refresh_token) throw new Error(RETIRED);
  const original = { access_token: captured.session.access_token, refresh_token: captured.session.refresh_token };
  let expectedCookies = snapshot(cookieKey);
  const stored = cookieSession(expectedCookies, cookieKey);
  if (stored.access_token !== original.access_token || stored.refresh_token !== original.refresh_token) throw new Error(RETIRED);
  const identity = claims(original.access_token);
  if (identity.sub !== expectedUserId) throw new Error(RETIRED);

  let retired = false;
  let promoting = false;
  let promoted = false;
  const abort = new AbortController();
  const clients: SupabaseClient[] = [];
  const assertCurrent = () => {
    if (retired || !isCurrent() || !sameSnapshot(snapshot(cookieKey), expectedCookies)) throw new Error(RETIRED);
  };
  const dispose = () => {
    if (retired) return;
    retired = true;
    abort.abort();
    for (const client of clients) void client.auth.dispose().catch(() => {});
    clients.length = 0;
  };
  const fetchBound: typeof fetch = async (input, init) => {
    assertCurrent();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (bearer && bearer !== anon) {
      const requestIdentity = claims(bearer);
      if (requestIdentity.sub !== expectedUserId || requestIdentity.session_id !== identity.session_id) throw new Error(RETIRED);
    }
    const response = await fetch(input, { ...init, signal: abort.signal });
    assertCurrent();
    return response;
  };

  try {
    const { data: validated, error: validationError } = await mainAuth.getUser(original.access_token);
    assertCurrent();
    if (validationError) throw new Error(validationError.message);
    if (validated.user?.id !== expectedUserId || validated.user.is_anonymous) throw new Error(RETIRED);
    const isolated = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: uniqueKey() },
      global: { fetch: fetchBound },
    });
    clients.push(isolated);
    const { data: seeded, error: seedError } = await isolated.auth.setSession(original);
    assertCurrent();
    if (seedError) throw new Error(seedError.message);
    if (seeded.user?.id !== expectedUserId || seeded.user.is_anonymous) throw new Error(RETIRED);

    return {
      userId: expectedUserId,
      auth: isolated.auth,
      assertCurrent,
      dispose,
      async promote(tokens: Tokens) {
        assertCurrent();
        if (promoting || promoted) throw new Error("Authenticator session completion is already in progress.");
        const approved = { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
        const verifiedIdentity = claims(approved.access_token);
        if (!approved.refresh_token || verifiedIdentity.sub !== expectedUserId ||
            verifiedIdentity.session_id !== identity.session_id || verifiedIdentity.aal !== "aal2" ||
            verifiedIdentity.exp <= Date.now() / 1000) throw new Error("Authenticator verification did not return the expected AAL2 session.");
        promoting = true;
        const bridgeKey = uniqueKey();
        const memory = new Map<string, string>();
        const bridge = createClient(url, anon, {
          auth: {
            persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: bridgeKey,
            storage: {
              getItem: (key: string) => memory.get(key) ?? null,
              removeItem: (key: string) => { memory.delete(key); },
              setItem: async (key: string, value: string) => {
                assertCurrent();
                if (key !== bridgeKey || promoted) throw new Error(RETIRED);
                const session = JSON.parse(value);
                if (session.access_token !== approved.access_token || session.refresh_token !== approved.refresh_token ||
                    session.user?.id !== expectedUserId || session.user.is_anonymous) throw new Error(RETIRED);
                const next = createChunks(cookieKey, "base64-" + stringToBase64URL(value));
                const keep = new Set(next.map((cookie) => cookie.name));
                const changes: CookieChange[] = [
                  ...expectedCookies.filter((cookie) => !keep.has(cookie.name)).map((cookie) => ({
                    name: cookie.name, value: "", options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
                  })),
                  ...next.map((cookie) => ({ ...cookie, options: { ...DEFAULT_COOKIE_OPTIONS } })),
                ];
                await commitCookies(changes, true, assertCurrent, () => {
                  const written = snapshot(cookieKey);
                  const readBack = cookieSession(written, cookieKey);
                  if (readBack.access_token !== approved.access_token || readBack.refresh_token !== approved.refresh_token) {
                    throw new Error("Authenticator session cookies could not be saved. Reload before continuing.");
                  }
                  expectedCookies = written;
                  memory.set(key, value);
                  promoted = true;
                });
              },
            },
          },
          global: { fetch: fetchBound },
        });
        clients.push(bridge);
        try {
          const { data, error } = await bridge.auth.setSession(approved);
          assertCurrent();
          if (error) throw new Error(error.message);
          if (!promoted || data.user?.id !== expectedUserId) throw new Error(RETIRED);
        } finally {
          void bridge.auth.dispose().catch(() => {});
          memory.clear();
          promoting = false;
        }
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
