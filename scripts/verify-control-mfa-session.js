/* Real pinned Supabase SDK + fake provider/cookie/Web Lock boundaries. No live calls or file writes. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const sdk = require("@supabase/supabase-js");
const ssr = require("@supabase/ssr");
const webcrypto = require("node:crypto").webcrypto;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SID = "33333333-3333-4333-8333-333333333333";
const URL_BASE = "https://fixture.supabase.example.invalid";
const KEY = "sb-fixture-auth-token";
let checks = 0;
const clients = [];
const check = (value, label) => { assert.ok(value, label); checks++; };
const rejected = async (work, pattern = /session changed|AAL2|Web Locks|already in progress/i) => { await assert.rejects(work, pattern); checks++; };
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
function jwt(user = A, aal = "aal1", session = SID) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ sub: user, session_id: session, aal, exp: Math.floor(Date.now() / 1000) + 3600 }) + "." + Buffer.from("synthetic-signature").toString("base64url");
}
const ORIGINAL = { access_token: jwt(), refresh_token: "synthetic-original-refresh" };
const VERIFIED = { access_token: jwt(A, "aal2"), refresh_token: "synthetic-verified-refresh" };
const OTHER = { access_token: jwt(B), refresh_token: "synthetic-other-refresh" };
function payload(token) { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); }
function user(id) { return { id, is_anonymous: false, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01T00:00:00Z" }; }
function fixture(options = {}) {
  const state = { current: true, writes: [], provider: [], created: [], lockRequests: [], inLock: false, hookBeforeCommit: null, jsonGate: null, jsonEntered: null, providerGate: null, providerEntered: null, userOverride: null };
  const cookies = new Map();
  const document = {};
  Object.defineProperty(document, "cookie", {
    get() { return [...cookies].map(([name, value]) => ssr.serializeCookieHeader(name, value, {})).join("; "); },
    set(line) {
      if (options.locks !== false) assert.equal(state.inLock, true, "app cookie assignments must run inside shared writer lock");
      state.writes.push(line);
      const first = ssr.parseCookieHeader(line.split(";")[0])[0];
      if (/max-age=0(?:;|$)/i.test(line)) cookies.delete(first.name);
      else cookies.set(first.name, first.value ?? "");
    },
  });
  function replace(tokens, padding = "") {
    for (const name of cookies.keys()) if (ssr.isChunkLike(name, KEY)) cookies.delete(name);
    const encoded = "base64-" + ssr.stringToBase64URL(JSON.stringify({ ...tokens, user: { ...user(payload(tokens.access_token).sub), padding } }));
    for (const cookie of ssr.createChunks(KEY, encoded)) cookies.set(cookie.name, cookie.value);
  }
  replace(ORIGINAL, options.padding ?? "");
  cookies.set("unrelated-device-cookie", "synthetic");
  const locks = {
    async request(name, mode, work) {
      state.lockRequests.push({ name, mode });
      if (state.hookBeforeCommit) { const hook = state.hookBeforeCommit; state.hookBeforeCommit = null; await hook(); }
      state.inLock = true;
      try { return await work(); } finally { state.inLock = false; }
    },
  };
  const provider = async (input, init) => {
    const target = new URL(String(input));
    assert.equal(target.origin, URL_BASE, "unexpected provider origin");
    const headers = new Headers(init?.headers);
    const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    state.provider.push({ path: target.pathname, method: init?.method ?? "GET", bearer, signal: init?.signal });
    if (state.providerGate) { state.providerEntered?.resolve(); await state.providerGate.promise; }
    let body;
    if (target.pathname === "/auth/v1/user") {
      body = user(state.userOverride ?? payload(bearer).sub);
    } else if (target.pathname === "/auth/v1/factors" && init?.method === "POST") {
      body = { id: "synthetic-factor", type: "totp", totp: { qr_code: "<svg/>", secret: "SYNTHETIC-ONLY" } };
    } else if (target.pathname.endsWith("/challenge")) {
      body = { id: "synthetic-challenge", type: "totp", expires_at: 9999999999 };
    } else if (target.pathname.endsWith("/verify")) {
      body = { ...VERIFIED, expires_in: 3600, token_type: "bearer", user: user(A) };
    } else {
      throw new Error("Unexpected real SDK provider call: " + target.pathname);
    }
    const response = new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (state.jsonGate && target.pathname === "/auth/v1/user") {
      const gate = state.jsonGate, entered = state.jsonEntered;
      response.json = async () => { entered?.resolve(); await gate.promise; return body; };
    }
    return response;
  };
  const wrappedSdk = { ...sdk, createClient(url, key, settings) {
    const client = sdk.createClient(url, key, settings);
    state.created.push({ client, settings }); clients.push(client); return client;
  } };
  const source = fs.readFileSync(path.join(process.cwd(), "src/lib/auth/mfaSession.ts"), "utf8");
  const compiled = ts.transpileModule(source, { fileName: "src/lib/auth/mfaSession.ts", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext("(function(require,module,exports){" + compiled + "\n})", {
    URL, Headers, Request, Response, AbortController, crypto: webcrypto, Error,
    document, navigator: options.locks === false ? {} : { locks }, fetch: provider,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: URL_BASE, NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public-key" } },
  }, { filename: "mfaSession.ts" })((name) => {
    if (name === "@supabase/supabase-js") return wrappedSdk;
    if (name === "@supabase/ssr") return ssr;
    throw new Error("Unexpected dependency " + name);
  }, module, module.exports);
  const mainCalls = [];
  const main = {
    getSession: async () => { mainCalls.push("getSession"); return { data: { session: { ...ORIGINAL, user: user(A) } }, error: null }; },
    getUser: async (token) => { mainCalls.push("getUser"); assert.equal(token, ORIGINAL.access_token, "validate captured JWT explicitly"); return { data: { user: user(options.validatedUser ?? A) }, error: null }; },
    mfa: new Proxy({}, { get() { throw new Error("Mutable main MFA must not be used"); } }),
    setSession() { throw new Error("main.setSession must not be used"); },
    refreshSession() { throw new Error("main.refreshSession must not be used"); },
    signOut() { throw new Error("cleanup must not sign out main session"); },
  };
  const api = module.exports;
  return { state, cookies, document, replace, main, mainCalls, api, capture: () => api.captureMfaFlow(main, A, () => state.current) };
}
function decodedCookies(f) {
  const all = f.api.readControlCookies();
  const direct = all.find((cookie) => cookie.name === KEY);
  let value = direct?.value ?? "";
  if (!direct) { for (let i = 0; ; i++) { const next = all.find((cookie) => cookie.name === KEY + "." + i); if (!next) break; value += next.value; } }
  return JSON.parse(value.startsWith("base64-") ? ssr.stringFromBase64URL(value.slice(7)) : value);
}
async function main() {
  let f = fixture(), flow = await f.capture();
  check(flow.userId === A && f.state.created.length === 1, "capture creates separate account-bound client");
  const isolation = f.state.created[0].settings.auth;
  check(isolation.persistSession === false && isolation.autoRefreshToken === false && isolation.detectSessionInUrl === false, "actual isolated SDK options disable persistence/background/URL");
  check(isolation.storageKey !== KEY, "isolated storage key differs from main");
  check(f.mainCalls.join(",") === "getSession,getUser", "capture validates exact main bearer");
  check(f.state.writes.length === 0, "capture does not write main cookies");
  f.cookies.set("unrelated-device-cookie", "changed"); flow.assertCurrent();
  check(true, "unrelated cookies do not retire flow");
  await flow.auth.mfa.enroll({ factorType: "totp" });
  check(f.state.provider.filter((call) => call.path === "/auth/v1/factors")[0].bearer === ORIGINAL.access_token, "actual SDK enroll uses captured A bearer");
  await flow.auth.mfa.challenge({ factorId: "synthetic-factor" });
  const verification = await flow.auth.mfa.verify({ factorId: "synthetic-factor", challengeId: "synthetic-challenge", code: "123456" });
  check(!verification.error && f.state.writes.length === 0, "actual SDK verify stays isolated");
  await flow.promote({ access_token: verification.data.access_token, refresh_token: verification.data.refresh_token });
  check(decodedCookies(f).access_token === VERIFIED.access_token && decodedCookies(f).refresh_token === VERIFIED.refresh_token, "promotion persists exact verified pair");
  check(f.state.lockRequests.every((call) => call.name === "runbook-control-auth-cookie-commit" && call.mode.mode === "exclusive"), "all commits use same app lock");
  const bridge = f.state.created[1].settings.auth;
  check(bridge.persistSession === true && bridge.autoRefreshToken === false && bridge.detectSessionInUrl === false && bridge.storageKey !== isolation.storageKey, "bridge uses independent supported storage options");
  check(await bridge.storage.getItem(bridge.storageKey) === null, "bridge memory dropped after promotion");
  flow.assertCurrent(); check(true, "only own guarded commit updates expected cookie snapshot");
  await rejected(() => flow.promote(VERIFIED));
  const writes = f.state.writes.length; flow.dispose();
  check(f.state.writes.length === writes, "dispose does not remove main cookies");
  assert.throws(() => flow.assertCurrent(), /session changed/i); checks++;

  f = fixture({ padding: "x".repeat(6000) }); flow = await f.capture();
  check([...f.cookies.keys()].some((name) => name.startsWith(KEY + ".")), "fixture starts with standard SSR chunks");
  await flow.promote(VERIFIED);
  check(f.cookies.has(KEY) && ![...f.cookies.keys()].some((name) => name.startsWith(KEY + ".")), "promotion removes obsolete auth chunks");
  check(f.state.writes.some((line) => /max-age=0/i.test(line)), "stale chunk removal serialized before write");
  flow.dispose();

  f = fixture(); f.replace(OTHER);
  await rejected(() => f.capture());
  check(f.state.created.length === 0, "capture rejects cookie/token mismatch before isolated SDK");
  f = fixture({ validatedUser: B });
  await rejected(() => f.capture());
  check(f.state.created.length === 0, "capture rejects different verified identity");

  f = fixture(); flow = await f.capture();
  const providerCount = f.state.provider.length;
  const enrollment = flow.auth.mfa.enroll({ factorType: "totp" });
  f.replace(OTHER);
  await rejected(() => enrollment);
  check(f.state.provider.length === providerCount, "SDK-internal await cannot send mutation after account cookie switch");
  check(decodedCookies(f).access_token === OTHER.access_token, "new account cookies remain intact");
  flow.dispose();

  f = fixture(); flow = await f.capture();
  f.state.providerGate = deferred(); f.state.providerEntered = deferred();
  const inFlight = flow.auth.mfa.enroll({ factorType: "totp" });
  await f.state.providerEntered.promise;
  f.state.current = false; flow.dispose(); f.state.providerGate.resolve();
  await rejected(() => inFlight);
  check(f.state.provider.at(-1).signal.aborted === true && f.state.writes.length === 0, "retirement aborts flow transport and blocks late result");

  f = fixture(); flow = await f.capture();
  f.state.jsonGate = deferred(); f.state.jsonEntered = deferred();
  const promotion = flow.promote(VERIFIED);
  await f.state.jsonEntered.promise;
  await f.api.writeControlCookies(ssr.createChunks(KEY, "base64-" + ssr.stringToBase64URL(JSON.stringify({ ...OTHER, user: user(B) }))).map((cookie) => ({ ...cookie, options: ssr.DEFAULT_COOKIE_OPTIONS })));
  const afterSwitch = f.state.writes.length; f.state.jsonGate.resolve();
  await rejected(() => promotion);
  check(f.state.writes.length === afterSwitch && decodedCookies(f).access_token === OTHER.access_token, "switch during SDK response JSON cannot be overwritten at save");
  flow.dispose();

  f = fixture(); flow = await f.capture();
  f.state.hookBeforeCommit = async () => { f.replace(OTHER); };
  await rejected(() => flow.promote(VERIFIED));
  check(f.state.lockRequests.length === 1 && f.state.writes.length === 0 && decodedCookies(f).access_token === OTHER.access_token, "snapshot checked again inside acquired lock");
  flow.dispose();
  f = fixture(); flow = await f.capture();
  f.state.hookBeforeCommit = async () => { f.state.current = false; };
  await rejected(() => flow.promote(VERIFIED));
  check(f.state.writes.length === 0, "epoch checked inside acquired lock");
  flow.dispose();

  f = fixture({ locks: false });
  await rejected(() => f.capture(), /Web Locks/i);
  check(f.state.created.length === 0 && f.state.provider.length === 0, "missing lock denied before isolated SDK/provider mutations");
  check(f.state.writes.length === 0 && decodedCookies(f).access_token === ORIGINAL.access_token, "capture fails closed without Web Locks");
  await f.api.writeControlCookies([{ name: "ordinary", value: "allowed", options: { path: "/" } }]);
  check(f.cookies.get("ordinary") === "allowed", "ordinary writes retain compatibility fallback");

  f = fixture(); flow = await f.capture();
  f.state.userOverride = B;
  await rejected(() => flow.promote(VERIFIED));
  check(f.state.writes.length === 0, "verified-response wrong user cannot reach cookie commit");
  flow.dispose();
  for (const tokens of [
    { access_token: jwt(B, "aal2"), refresh_token: "synthetic" },
    { access_token: jwt(A, "aal1"), refresh_token: "synthetic" },
    { access_token: jwt(A, "aal2", "different-session"), refresh_token: "synthetic" },
  ]) {
    f = fixture(); flow = await f.capture();
    await rejected(() => flow.promote(tokens));
    check(f.state.writes.length === 0, "wrong principal/session/assurance cannot promote"); flow.dispose();
  }
  f = fixture();
  await rejected(() => f.api.writeControlCookies([
    { name: "first-valid", value: "value", options: { path: "/" } },
    { name: "invalid;name", value: "value", options: { path: "/" } },
  ]), /argument name|invalid/i);
  check(f.state.writes.length === 0, "all serialization finishes before first assignment");
  console.log("PASS: " + checks + " real-SDK MFA session, provider-boundary and guarded-cookie checks.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const client of clients) await client.auth.dispose();
});
