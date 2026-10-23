/* Synthetic MFA enrollment protocol and actual component handler checks. No providers, persisted data or source writes. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const FACTOR = "synthetic-unverified-factor";
const SECRET = "SYNTHETICSETUPKEY";
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
const enrollment = { userId: USER, factorId: FACTOR, secret: SECRET, qrImage: "data:image/svg+xml;utf-8," + encodeURIComponent(SVG) };
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const same = (actual, expected, label) => { assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), label); checks++; };
const rejected = async (work, pattern) => { await assert.rejects(work, pattern); checks++; };
const jsx = (type, props) => ({ type, props });
function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const compiled = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const mod = { exports: {} };
  const requireMock = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    throw new Error("Unexpected dependency: " + name + " in " + file);
  };
  vm.runInNewContext("(function(require,module,exports){" + compiled + "\n})", {
    URL, URLSearchParams, encodeURIComponent, decodeURIComponent, Error, ...globals,
  }, { filename: file })(requireMock, mod, mod.exports);
  return mod.exports;
}
function fixture(options = {}) {
  const state = {
    calls: [], users: [], userId: USER, anonymous: false, factors: { all: [], totp: [] },
    listError: null, enrollError: null, challengeError: null, verifyError: null, refreshError: null, assuranceError: null, cancelError: null,
    level: "aal2", challenge: { id: "synthetic-challenge" },
    enrolled: { id: FACTOR, type: "totp", totp: { qr_code: SVG, secret: SECRET } }, ...options,
  };
  const note = (name, input) => state.calls.push({ name, ...(input ? { input } : {}) });
  const auth = {
    getUser: async () => {
      note("user"); const next = state.users.length ? state.users.shift() : state.userId;
      if (next && typeof next === "object" && next.message) return { data: { user: null }, error: next };
      return { data: { user: next ? { id: next, is_anonymous: state.anonymous } : null }, error: null };
    },
    refreshSession: async () => { note("refresh"); if (state.onRefresh) state.onRefresh(); return { error: state.refreshError }; },
    onAuthStateChange: (listener) => { state.listener = listener; return { data: { subscription: { unsubscribe: () => { state.unsubscribed = true; } } } }; },
    mfa: {
      listFactors: async () => { note("list"); return { data: state.factors, error: state.listError }; },
      enroll: async (input) => {
        note("enroll", input);
        if (state.enrollGate) await state.enrollGate;
        if (state.trackFactors && !state.enrollError) state.factors.all.push({ id: FACTOR, factor_type: "totp", status: "unverified" });
        return { data: state.enrolled, error: state.enrollError };
      },
      challenge: async (input) => { note("challenge", input); return { data: state.challenge, error: state.challengeError }; },
      verify: async (input) => {
        note("verify", input);
        if (state.trackFactors && !state.verifyError) {
          const factor = state.factors.all.find((item) => item.id === input.factorId);
          if (factor) { factor.status = "verified"; state.factors.totp = [factor]; }
        }
        return { error: state.verifyError };
      },
      getAuthenticatorAssuranceLevel: async () => { note("assurance"); return { data: { currentLevel: state.level }, error: state.assuranceError }; },
      unenroll: async (input) => {
        note("cancel", input);
        if (state.trackFactors && !state.cancelError) state.factors.all = state.factors.all.filter((item) => item.id !== input.factorId);
        return { error: state.cancelError };
      },
    },
  };
  return { state, auth, names: () => state.calls.map((call) => call.name) };
}
async function helperChecks(api) {
  let f = fixture();
  same(await api.loadTotpEnrollmentState(f.auth), { userId: USER, enabled: false, pendingFactorIds: [] }, "empty state");
  f = fixture({ factors: { totp: [{ id: "verified", status: "verified" }], all: [
    { id: FACTOR, factor_type: "totp", status: "unverified" }, { id: "phone", factor_type: "phone", status: "unverified" },
    { id: "verified", factor_type: "totp", status: "verified" },
  ] } });
  same(await api.loadTotpEnrollmentState(f.auth), { userId: USER, enabled: true, pendingFactorIds: [FACTOR] }, "only own unfinished TOTP surfaced");
  for (const opts of [{ userId: null }, { anonymous: true }, { users: [USER, OTHER] }, { listError: { message: "synthetic factor failure" } }]) {
    f = fixture(opts); await rejected(() => api.loadTotpEnrollmentState(f.auth), /sign in|account changed|synthetic factor/i);
  }
  f = fixture();
  const started = await api.startTotpEnrollment(f.auth, USER);
  same(started, enrollment, "new setup binds identity, local QR and manual key");
  same(f.names(), ["user", "list", "user", "enroll", "user"], "start rechecks identity");
  same(f.state.calls.find((call) => call.name === "enroll").input, { factorType: "totp", friendlyName: "RunBook Control" }, "explicit TOTP enrollment");
  for (const factors of [
    { totp: [{ id: "verified", status: "verified" }], all: [] },
    { totp: [], all: [{ id: FACTOR, factor_type: "totp", status: "unverified" }] },
  ]) {
    f = fixture({ factors }); await rejected(() => api.startTotpEnrollment(f.auth, USER), /already enabled|unfinished/i);
    check(!f.names().includes("enroll"), "do not replace verified or duplicate unfinished factor");
  }
  for (const users of [[OTHER], [USER, OTHER], [USER, USER, OTHER]]) {
    const plannedReads = users.length;
    f = fixture({ users }); await rejected(() => api.startTotpEnrollment(f.auth, USER), /account changed/i);
    if (plannedReads < 3) check(!f.names().includes("enroll"), "account switch denied before enrollment");
  }
  f = fixture({ enrollError: { message: "synthetic enroll failure" } });
  await rejected(() => api.startTotpEnrollment(f.auth, USER), /synthetic enroll/);
  f = fixture({ enrolled: { id: FACTOR, type: "totp", totp: { qr_code: "https://attacker.invalid/qr", secret: SECRET } } });
  await rejected(() => api.startTotpEnrollment(f.auth, USER), /QR code/);
  f = fixture({ enrolled: { id: FACTOR, type: "totp", totp: { qr_code: "data:image/svg+xml;utf-8," + encodeURIComponent(SVG), secret: SECRET } } });
  same(await api.startTotpEnrollment(f.auth, USER), enrollment, "encoded SDK SVG stays local");
  for (const code of ["", "12345", "1234567", "12a456", " 123456 "]) {
    f = fixture(); await rejected(() => api.verifyTotpEnrollment(f.auth, enrollment, code), /6-digit/);
    check(f.names().length === 0, "invalid code has no provider effects");
  }
  f = fixture();
  await api.verifyTotpEnrollment(f.auth, enrollment, "123456", () => f.state.calls.push({ name: "clear" }));
  same(f.names(), ["user", "challenge", "verify", "clear", "user", "refresh", "user", "assurance"], "clear secret immediately after successful verification");
  same(f.state.calls.find((call) => call.name === "verify").input, { factorId: FACTOR, challengeId: "synthetic-challenge", code: "123456" }, "verify exact factor and challenge");
  for (const [opts, pattern, cleared] of [
    [{ challengeError: { message: "synthetic challenge" } }, /synthetic challenge/, false],
    [{ challenge: null }, /challenge is unavailable/i, false],
    [{ verifyError: { message: "synthetic wrong code" } }, /synthetic wrong code/, false],
    [{ users: [USER, OTHER] }, /account changed/i, true],
    [{ users: [USER, { message: "synthetic identity read" }] }, /synthetic identity read/, true],
    [{ refreshError: { message: "synthetic refresh" } }, /refresh failed/i, true],
    [{ users: [USER, USER, OTHER] }, /account changed/i, true],
    [{ level: "aal1" }, /AAL2/, true],
    [{ assuranceError: { message: "synthetic assurance" } }, /synthetic assurance/, true],
  ]) {
    f = fixture(opts); let didClear = false;
    await rejected(() => api.verifyTotpEnrollment(f.auth, enrollment, "123456", () => { didClear = true; }), pattern);
    check(didClear === cleared, "failure clears only already-verified setup");
  }
  f = fixture({ factors: { all: [{ id: FACTOR, factor_type: "totp", status: "unverified" }], totp: [] } });
  await api.cancelTotpEnrollment(f.auth, enrollment);
  same(f.names(), ["user", "list", "user", "cancel"], "explicit cancellation rechecks identity");
  same(f.state.calls.find((call) => call.name === "cancel").input, { factorId: FACTOR }, "only exact unfinished factor canceled");
  for (const factor of [
    { id: FACTOR, factor_type: "totp", status: "verified" },
    { id: FACTOR, factor_type: "phone", status: "unverified" },
  ]) {
    f = fixture({ factors: { all: [factor], totp: [] } });
    await rejected(() => api.cancelTotpEnrollment(f.auth, enrollment), /cannot be canceled/i);
    check(!f.names().includes("cancel"), "never cancel enabled or other factor type");
  }
  f = fixture({ factors: { all: [{ id: "another-factor", factor_type: "totp", status: "unverified" }], totp: [] } });
  await api.cancelTotpEnrollment(f.auth, enrollment);
  check(!f.names().includes("cancel"), "missing factor is no-op, never substitute");
  for (const users of [[OTHER], [USER, OTHER]]) {
    f = fixture({ users, factors: { all: [{ id: FACTOR, factor_type: "totp", status: "unverified" }], totp: [] } });
    await rejected(() => api.cancelTotpEnrollment(f.auth, enrollment), /account changed/i);
    check(!f.names().includes("cancel"), "changed account cannot cancel prior setup");
  }
  f = fixture({ cancelError: { message: "synthetic cancellation" }, factors: { all: [{ id: FACTOR, factor_type: "totp", status: "unverified" }], totp: [] } });
  await rejected(() => api.cancelTotpEnrollment(f.auth, enrollment), /synthetic cancellation/);
}
async function main() {
  const api = load("src/lib/auth/mfaEnrollment.ts");
  await helperChecks(api);
  await componentChecks(api);
  console.log("PASS: " + checks + " MFA enrollment protocol and actual component-handler checks.");
}
const pump = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function hookHarness(file, dependencies, globals, props) {
  const states = [], refs = [], effects = [], cleanups = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0;
  const react = {
    __esModule: true, default: {},
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef(initial) { const index = refIndex++; if (!refs[index]) refs[index] = { current: initial }; return refs[index]; },
    useEffect(work) { const index = effectIndex++; if (!effects[index]) effects[index] = work; },
  };
  const component = load(file, { react, ...dependencies }, globals);
  let tree;
  const render = () => { stateIndex = 0; refIndex = 0; effectIndex = 0; tree = component.default(props); return tree; };
  const nodes = () => {
    render(); const result = [];
    const walk = (node) => { if (!node || typeof node !== "object") return; result.push(node); const children = node.props?.children; (Array.isArray(children) ? children : [children]).forEach(walk); };
    walk(tree); return result;
  };
  const text = (node) => {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node !== "object") return String(node);
    const children = node.props?.children;
    return (Array.isArray(children) ? children : [children]).map(text).join("");
  };
  const button = (label) => { const found = nodes().find((node) => node.type === "button" && text(node) === label); assert.ok(found, "actual button: " + label); return found; };
  const mount = async () => { render(); effects.forEach((work) => cleanups.push(work())); await pump(); render(); };
  return { states, refs, nodes, button, text, mount, render, unmount: () => cleanups.forEach((cleanup) => cleanup?.()) };
}
async function componentChecks(api) {
  const returns = load("src/lib/auth/mfaReturn.ts");
  const destination = "/shops/" + USER + "?tab=mobile&company=" + USER;
  const logs = [];
  const quietConsole = { log: (...args) => logs.push(args), error: (...args) => logs.push(args), warn: (...args) => logs.push(args) };
  function ui(f, returnTo = destination) {
    const location = { href: "", search: "?next=" + encodeURIComponent(returnTo) };
    const component = hookHarness("src/components/EnableMFAClient.tsx", {
      "@/lib/supabase/client": { supabaseBrowser: () => ({ auth: f.auth }) },
      "@/lib/auth/mfaReturn": returns, "@/lib/auth/mfaEnrollment": api,
    }, { window: { location }, console: quietConsole }, { required: true, returnTo });
    return { ...component, location };
  }
  async function start(h) { h.button("Enable authenticator app").props.onClick(); await pump(); h.render(); }
  async function submit(h, code = "123456") {
    const input = h.nodes().find((node) => node.type === "input");
    assert.ok(input, "actual enrollment code input");
    input.props.onChange({ target: { value: code } });
    const form = h.nodes().find((node) => node.type === "form");
    assert.ok(form, "actual enrollment form");
    let prevented = false;
    form.props.onSubmit({ preventDefault() { prevented = true; } });
    check(prevented, "form avoids document submit");
    await pump(); h.render();
  }
  let f = fixture({ trackFactors: true }), h = ui(f);
  await h.mount();
  check(!f.names().includes("enroll"), "mount never auto-enrolls");
  h.button("Enable authenticator app").props.onClick();
  h.button("Enable authenticator app").props.onClick();
  await pump(); h.render();
  check(f.names().filter((name) => name === "enroll").length === 1, "busy guard prevents duplicate enrollment");
  check(h.nodes().some((node) => node.type === "img" && node.props.src === enrollment.qrImage), "actual UI shows local QR image");
  check(h.nodes().some((node) => node.type === "code" && h.text(node) === SECRET), "manual setup key shown only during setup");
  f.state.onRefresh = () => check(h.states[3] === null && h.refs[4].current === null, "actual UI clears QR/key before refresh");
  await submit(h);
  check(h.location.href === destination, "actual successful enrollment returns to company/tab");
  check(!h.nodes().some((node) => node.type === "img" || node.type === "code"), "verified setup secrets removed");
  h.unmount();
  check(f.state.unsubscribed === true, "unmount unsubscribes auth observer");

  f = fixture({ trackFactors: true }); h = ui(f); await h.mount(); await start(h);
  h.button("Cancel setup").props.onClick(); await pump(); h.render();
  check(f.names().filter((name) => name === "cancel").length === 1, "actual cancel uses exact helper");
  check(h.states[3] === null && !h.location.href, "cancel clears setup without navigation");
  check(!h.nodes().some((node) => node.type === "img" || node.type === "code"), "cancel removes QR/key");

  for (const options of [
    { verifyError: { message: "synthetic invalid OTP" } },
    { refreshError: { message: "synthetic refresh failure" } },
    { level: "aal1" },
  ]) {
    f = fixture({ trackFactors: true, ...options }); h = ui(f); await h.mount(); await start(h); await submit(h);
    check(!h.location.href, "verification/refresh/AAL1 failure never navigates");
    if (options.verifyError) check(h.states[3] !== null, "wrong code retains unfinished setup for retry/cancel");
    else check(h.states[3] === null && h.states[0] === true, "already-enabled factor loses secrets even after refresh/AAL1 failure");
  }

  f = fixture({ trackFactors: true }); h = ui(f); await h.mount(); await start(h);
  f.state.userId = OTHER;
  f.state.listener("SIGNED_IN", { user: { id: OTHER } }); h.render();
  check(h.states[3] === null && h.states[1] === null && h.refs[4].current === null, "account change immediately clears setup state and refs");
  check(!h.nodes().some((node) => node.type === "img" || node.type === "code"), "account change hides QR/key");
  check(!f.names().includes("cancel") && !h.location.href, "account change does not mutate prior factor or navigate");

  f = fixture({ trackFactors: true, factors: { all: [{ id: FACTOR, factor_type: "totp", status: "unverified" }], totp: [] } });
  h = ui(f); await h.mount();
  check(!h.nodes().some((node) => node.type === "button" && h.text(node) === "Enable authenticator app"), "unfinished setup prevents duplicate start");
  h.button("Cancel unfinished setup").props.onClick(); await pump(); h.render();
  check(f.names().filter((name) => name === "cancel").length === 1, "explicit unfinished cleanup uses protected cancel helper");
  check(Boolean(h.button("Enable authenticator app")) && !h.location.href, "cleanup enables explicit new start without navigation");

  f = fixture({ trackFactors: true, factors: { all: [{ id: FACTOR, factor_type: "totp", status: "unverified" }], totp: [] } });
  h = ui(f); await h.mount();
  f.state.users = [USER, USER, OTHER, OTHER]; f.state.userId = OTHER;
  h.button("Cancel unfinished setup").props.onClick(); await pump(); h.render();
  check(h.states[2].includes(FACTOR) && !h.nodes().some((node) => node.type === "button" && h.text(node) === "Enable authenticator app"), "post-cancel account change cannot apply another account's refreshed setup state before auth callback");
  check(!h.location.href && h.states[3] === null, "delayed account callback cannot expose setup secrets or navigate");

  f = fixture({ factors: { all: [{ id: FACTOR, factor_type: "totp", status: "verified" }], totp: [{ id: FACTOR, status: "verified" }] } });
  h = ui(f, "//attacker.invalid"); await h.mount();
  h.button("Verify now").props.onClick();
  check(h.location.href === "/mfa?next=%2Fdashboard", "existing verified factor uses safe step-up destination");
  check(!f.names().includes("enroll") && !f.names().includes("cancel"), "verified factor never re-enrolled or canceled");

  let release;
  f = fixture({ trackFactors: true, enrollGate: new Promise((resolve) => { release = resolve; }) });
  h = ui(f); await h.mount();
  h.button("Enable authenticator app").props.onClick(); await pump();
  h.unmount(); release(); await pump();
  check(h.states[3] === null && h.refs[4].current === null && !h.location.href, "late provider response cannot restore secrets after unmount");

  async function page(factors, error) {
    const auth = { mfa: { listFactors: async () => ({ data: factors, error }) } };
    const client = { auth };
    const location = { search: "?next=" + encodeURIComponent(destination), href: "" };
    const result = hookHarness("src/app/mfa/page.tsx", {
      "@/components/EnableMFAClient": { __esModule: true, default: "enrollment" },
      "@/components/control/ControlActionButton": { __esModule: true, default: "action" },
      "@/components/control/ControlPanel": { __esModule: true, default: "panel" },
      "@/components/control/controlTheme": { controlTheme: { radius: { sm: 1 }, color: {} } },
      "@/lib/supabase/client": { supabaseBrowser: () => client },
      "@/lib/auth/mfaReturn": returns,
    }, { window: { location }, console: quietConsole }, undefined);
    await result.mount(); return result;
  }
  let prompt = await page({ totp: [] }, null);
  check(prompt.nodes().some((node) => node.type === "enrollment" && node.props.returnTo === destination), "actual /mfa offers enrollment after successful no-factor listing");
  prompt = await page({ totp: [{ id: FACTOR, status: "verified" }] }, null);
  check(!prompt.nodes().some((node) => node.type === "enrollment"), "verified factor uses existing verification");
  prompt = await page(null, { message: "synthetic factor-list failure" });
  check(!prompt.nodes().some((node) => node.type === "enrollment"), "factor-list failure never fabricates permission to enroll");
  check(logs.length === 0, "no QR/key console logging");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
