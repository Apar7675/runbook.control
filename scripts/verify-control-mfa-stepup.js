/* Actual Control MFA boundaries, synthetic SDK/DB/navigation only. No providers or file writes. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = process.cwd();
const USER = "11111111-1111-4111-8111-111111111111";
const jsx = (type, props) => ({ type, props });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: "fragment" };
const redirect = (to) => { throw Object.assign(new Error("redirect"), { redirect: to }); };
const json = (body, init) => new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json" } });
let cases = 0;
function check(condition, label) { assert.ok(condition, label); cases++; }
function moduleAt(file, mocks = {}, globals = {}) {
  const result = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const mod = { exports: {} };
  const requireMock = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "react") return { __esModule: true, default: {} };
    throw new Error("Unexpected real dependency: " + name + " in " + file);
  };
  vm.runInNewContext("(function(require,module,exports){" + result.outputText + "\n})", {
    URL, URLSearchParams, Headers, Response, Request, console, ...globals,
  }, { filename: file })(requireMock, mod, mod.exports);
  return mod.exports;
}
async function redirected(work, destination) {
  let result;
  try { await work(); } catch (error) { result = error.redirect; if (!result) throw error; }
  assert.equal(result, destination); cases++;
}
async function main() {
  const returns = moduleAt("src/lib/auth/mfaReturn.ts");
  const destination = "/shops/" + USER + "?tab=mobile&company=" + USER;
  check(returns.safeMfaReturnTo(destination) === destination, "preserve local company/tab query");
  for (const unsafe of [null, "", "https://attacker.invalid", "//attacker.invalid", "/\\attacker", "/%5cattacker", "/%2f%2fattacker", "/dashboard\nx", "/dashboard%0a", "/mfa?next=/mfa", "/login", "/api/shops/delete", "/%ZZ", "/unknown"]) {
    check(returns.safeMfaReturnTo(unsafe) === "/dashboard", "reject unsafe/loop destination " + String(unsafe));
  }
  const mfaPath = returns.mfaStepUpHref(destination);
  check(returns.mfaReturnFromRequestPath(mfaPath) === destination, "MFA next round trip");
  check(returns.mfaReturnFromRequestPath("/mfa?next=https%3A%2F%2Fattacker.invalid") === "/dashboard", "reject external next");
  check(returns.mfaReturnFromRequestPath("//attacker.invalid/mfa?next=/shops") === "/dashboard", "reject forged MFA path");
  const incoming = new URL("https://control.invalid" + destination);
  const mw = moduleAt("middleware.ts", {
    "next/server": { NextResponse: {
      next: (options) => ({ options, headers: new Headers(), cookies: { set() {} } }),
      redirect: (to) => ({ redirect: String(to) }), json,
    } },
    "@supabase/ssr": { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: USER } } }) } }) },
    "@/lib/control/companyScope": { COMPANY_HEADER: "x-company", companyRequest: () => USER },
    "@/lib/auth/mfaReturn": returns,
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic" } } });
  const response = await mw.middleware({
    nextUrl: incoming, cookies: { get() {} },
    headers: new Headers({ [returns.CONTROL_REQUEST_PATH_HEADER]: "//attacker.invalid" }),
  });
  check(response.options.request.headers.get(returns.CONTROL_REQUEST_PATH_HEADER) === destination, "middleware overwrites spoofed header with actual path/query");

  const state = { aal: "aal1", admin: true, user: { id: USER }, session: {}, reads: 0, header: destination };
  const server = { auth: {
    getSession: async () => ({ data: { session: state.session } }),
    getUser: async () => ({ data: { user: state.user } }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.aal } }) },
  }, from() { throw new Error("Trusted device must not substitute for AAL2"); } };
  const layoutMocks = {
    "next/link": { __esModule: true, default: "link" },
    "next/navigation": { redirect },
    "next/headers": { headers: async () => new Headers({ [returns.CONTROL_REQUEST_PATH_HEADER]: state.header }) },
    "@/lib/supabase/server": { supabaseServer: async () => server },
    "@/lib/authz": { isPlatformAdmin: async () => state.admin },
    "@/lib/auth/mfaReturn": returns,
    "@/components/control/ControlAppShell": { __esModule: true, default: "shell" },
    "@/components/DeviceIdBootstrap": { __esModule: true, default: "bootstrap" },
    "@/lib/connection-status": { buildControlHeaderStatuses: () => [] },
    "@/lib/control/summary": { getViewerContext: async () => { state.reads++; return { selectedCompanyId: USER }; } },
  };
  const authed = moduleAt("src/app/(authed)/layout.tsx", layoutMocks);
  await redirected(() => authed.default({ children: "protected" }), mfaPath);
  check(state.reads === 0, "AAL1 cannot load company context");
  state.aal = "aal2";
  check(Boolean(await authed.default({ children: "protected" })), "AAL2 renders privileged page");
  check(state.reads === 1, "AAL2 loads context once");
  state.admin = false;
  await redirected(() => authed.default({ children: "protected" }), "/restricted");
  state.admin = true; state.session = null;
  await redirected(() => authed.default({ children: "protected" }), "/login");
  state.session = {}; state.header = mfaPath;
  const mfaLayout = moduleAt("src/app/mfa/layout.tsx", layoutMocks);
  await redirected(() => mfaLayout.default({ children: "verify" }), destination);
  state.aal = "aal1";
  check(Boolean(await mfaLayout.default({ children: "verify" })), "AAL1 reaches MFA prompt");
  state.admin = false;
  await redirected(() => mfaLayout.default({ children: "verify" }), "/restricted");

  let routeAal = "aal1", writes = 0;
  const authz = moduleAt("src/lib/authz.ts", {
    "@/lib/supabase/server": { supabaseServer: async () => ({ auth: {
      getUser: async () => ({ data: { user: { id: USER } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: routeAal }, error: null }) },
    } }) },
    "@/lib/supabase/admin": { supabaseAdmin: () => { throw new Error("unexpected admin lookup"); } },
    "@/lib/billing/entitlement": { getShopEntitlement: () => { throw new Error("unexpected billing"); } },
  });
  const trustRoute = moduleAt("src/app/api/user/trust-device/route.ts", {
    "next/server": { NextResponse: { json } },
    "next/headers": { cookies: async () => ({ get: () => ({ value: "synthetic-browser" }) }) },
    "@/lib/authz": authz,
    "@/lib/security/rateLimit": { rateLimitOrThrow() {} },
    "@/lib/supabase/admin": { supabaseAdmin: () => ({ from: () => ({ upsert: async () => { writes++; return { error: null }; } }) }) },
  });
  let apiResponse = await trustRoute.POST(new Request("https://control.invalid/api/user/trust-device", { method: "POST", body: "{}" }));
  check(apiResponse.status === 403 && writes === 0, "actual route/real AAL2 guard denies AAL1 before write");
  routeAal = "aal2";
  apiResponse = await trustRoute.POST(new Request("https://control.invalid/api/user/trust-device", { method: "POST", body: "{}" }));
  check(apiResponse.status === 200 && writes === 1, "actual route permits AAL2");

  async function verifyPage({ next = destination, aal = "aal2", failure = null, code = "123456" } = {}) {
    const values = ["verified-factor", code, "", false];
    let cursor = 0;
    const statuses = [], calls = [], location = { search: "?next=" + encodeURIComponent(next), href: "" };
    const client = { auth: {
      mfa: {
        challenge: async () => { calls.push("challenge"); return { data: { id: "challenge" }, error: failure }; },
        verify: async () => { calls.push("verify"); return { error: null }; },
        getAuthenticatorAssuranceLevel: async () => { calls.push("assurance"); return { data: { currentLevel: aal }, error: null }; },
      },
      refreshSession: async () => { calls.push("refresh"); return { error: null }; },
    } };
    const page = moduleAt("src/app/mfa/page.tsx", {
      react: { useEffect() {}, useState: () => {
        const index = cursor++;
        return [values[index], (value) => { values[index] = value; if (index === 2) statuses.push(value); }];
      } },
      "@/components/EnableMFAClient": { __esModule: true, default: "enrollment" },
      "@/components/control/ControlActionButton": { __esModule: true, default: "action" },
      "@/components/control/ControlPanel": { __esModule: true, default: "panel" },
      "@/components/control/controlTheme": { controlTheme: { radius: { sm: 1 }, color: {} } },
      "@/lib/supabase/client": { supabaseBrowser: () => client },
      "@/lib/auth/mfaReturn": returns,
    }, { window: { location } });
    const nodes = [];
    const walk = (node) => { if (!node || typeof node !== "object") return; nodes.push(node); const children = node.props?.children; (Array.isArray(children) ? children : [children]).forEach(walk); };
    walk(page.default());
    const button = nodes.find((node) => node.type === "action");
    assert.ok(button, "actual verify action exists");
    await button.props.onClick();
    return { calls, location, statuses };
  }
  let verification = await verifyPage();
  check(verification.calls.join(",") === "challenge,verify,refresh,assurance", "actual client completes and confirms AAL2");
  check(verification.location.href === destination, "actual client returns to company/tab");
  verification = await verifyPage({ next: "//attacker.invalid" });
  check(verification.location.href === "/dashboard", "actual client cannot return externally");
  verification = await verifyPage({ aal: "aal1" });
  check(!verification.location.href && verification.statuses.some((status) => /AAL2/.test(status)), "actual client refuses failed step-up");
  verification = await verifyPage({ failure: new Error("synthetic challenge failure") });
  check(!verification.location.href && verification.calls.join(",") === "challenge", "failed challenge cannot navigate");
  verification = await verifyPage({ code: "12" });
  check(!verification.location.href && verification.calls.length === 0, "invalid code cannot challenge");
  console.log("PASS: " + cases + " MFA return, actual middleware/layout/client and AAL2 route-boundary checks.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
