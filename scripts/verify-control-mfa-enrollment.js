/* Actual enrollment helpers/UI with mocked captured flows. Session transport has separate real-SDK tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto").webcrypto;
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const FACTOR = "synthetic-factor";
const SECRET = "SYNTHETICSETUPKEY";
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
let checks = 0;
const registry = new WeakMap();
const check = (value, label) => { assert.ok(value, label); checks++; };
const same = (a, b, label) => { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), label); checks++; };
const rejected = async (work, pattern) => { await assert.rejects(work, pattern); checks++; };
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
const pump = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const jsx = (type, props) => ({ type, props });
function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const compiled = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext("(function(require,module,exports){" + compiled + "\n})", {
    URL, URLSearchParams, encodeURIComponent, decodeURIComponent, crypto, Error, ...globals,
  }, { filename: file })((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    throw new Error("Unexpected dependency " + name);
  }, mod, mod.exports);
  return mod.exports;
}
function fixture(options = {}) {
  const state = {
    events: [], flows: [], parentUser: USER, users: [], factors: { all: [], totp: [] }, flowCurrent: true,
    listError: null, enrollError: null, challengeError: null, verifyError: null, promoteError: null,
    challenge: { id: "synthetic-challenge" }, verified: { access_token: "synthetic-verified-AT", refresh_token: "synthetic-verified-RT" },
    enrolled: { id: FACTOR, type: "totp", totp: { qr_code: SVG, secret: SECRET } }, ...options,
  };
  const note = (name, input) => { state.events.push({ name, ...(input ? { input } : {}) }); state.last = name; };
  const mainAuth = {
    getUser: async () => {
      note("parent-user");
      const next = state.users.length ? state.users.shift() : state.parentUser;
      return { data: { user: next ? { id: next, is_anonymous: false } : null }, error: null };
    },
    mfa: {
      listFactors: async () => { note("parent-list"); if (state.parentListGate) await state.parentListGate.promise; return { data: state.factors, error: state.listError }; },
      enroll() { throw new Error("mutable main enroll forbidden"); },
      challenge() { throw new Error("mutable main challenge forbidden"); },
      verify() { throw new Error("mutable main verify forbidden"); },
      unenroll() { throw new Error("provider factor deletion forbidden"); },
    },
    refreshSession() { throw new Error("main refresh forbidden"); },
    setSession() { throw new Error("main setSession forbidden"); },
    onAuthStateChange: (listener) => { state.listener = listener; return { data: { subscription: { unsubscribe: () => { state.unsubscribed = true; } } } }; },
  };
  function capture(expected, current) {
    note("capture");
    assert.equal(expected, USER);
    let disposed = false;
    const flow = {
      userId: USER,
      assertCurrent() {
        if (disposed || !state.flowCurrent || !current()) throw new Error("The signed-in session changed.");
        if (state.retireAfterEnroll && state.last === "enroll") {
          state.retireAfterEnroll = false;
          queueMicrotask(() => state.listener("SIGNED_IN", { user: { id: USER } }));
        }
      },
      auth: { mfa: {
        listFactors: async () => { note("isolated-list"); if (state.listGate) await state.listGate.promise; return { data: state.flowFactors ?? state.factors, error: state.listError }; },
        enroll: async (input) => {
          note("enroll", input); if (state.enrollGate) await state.enrollGate.promise;
          if (state.trackFactors && !state.enrollError) state.factors.all.push({ id: FACTOR, factor_type: "totp", status: "unverified" });
          return { data: state.enrolled, error: state.enrollError };
        },
        challenge: async (input) => { note("challenge", input); if (state.challengeGate) await state.challengeGate.promise; return { data: state.challenge, error: state.challengeError }; },
        verify: async (input) => {
          note("verify", input); if (state.verifyGate) await state.verifyGate.promise;
          state.afterVerify?.();
          return { data: state.verified, error: state.verifyError };
        },
        unenroll() { note("delete"); throw new Error("provider factor deletion forbidden"); },
      } },
      async promote(tokens) {
        flow.assertCurrent(); note("promote", tokens); state.beforePromote?.();
        if (state.promoteGate) await state.promoteGate.promise;
        flow.assertCurrent(); if (state.promoteError) throw new Error(state.promoteError);
        state.promotionComplete = true;
      },
      dispose() { if (!disposed) { disposed = true; note("dispose"); } },
      get disposed() { return disposed; },
    };
    state.flows.push(flow); return flow;
  }
  const f = { state, auth: mainAuth, capture, names: () => state.events.map((event) => event.name) };
  registry.set(mainAuth, f); return f;
}
const api = load("src/lib/auth/mfaEnrollment.ts", {
  "@/lib/auth/mfaSession": { captureMfaFlow: async (auth, expected, current) => {
    const f = registry.get(auth); assert.ok(f, "registered parent boundary");
    return f.capture(expected, current);
  } },
});
async function setup(f) { return api.startTotpEnrollment(f.auth, USER, () => f.state.flowCurrent); }
async function helperChecks() {
  let f = fixture();
  same(await api.loadTotpEnrollmentState(f.auth), { userId: USER, enabled: false, verifiedFactorId: null, pendingFactorIds: [] }, "empty read state");
  f = fixture({ factors: { totp: [{ id: "verified", status: "verified" }], all: [{ id: FACTOR, factor_type: "totp", status: "unverified" }] } });
  same(await api.loadTotpEnrollmentState(f.auth), { userId: USER, enabled: true, verifiedFactorId: "verified", pendingFactorIds: [FACTOR] }, "read state distinguishes verified and unfinished factors");
  for (const options of [{ parentUser: null }, { users: [USER, OTHER] }, { listError: { message: "synthetic list failure" } }]) {
    f = fixture(options); await rejected(() => api.loadTotpEnrollmentState(f.auth), /sign in|account changed|synthetic list/i);
  }
  f = fixture();
  let enrollment = await setup(f);
  same(enrollment, { userId: USER, factorId: FACTOR, secret: SECRET, qrImage: "data:image/svg+xml;utf-8," + encodeURIComponent(SVG) }, "only public setup metadata returned");
  same(f.names(), ["capture", "isolated-list", "enroll"], "new enrollment uses captured client only");
  check(/^RunBook Control .+/.test(f.state.events.find((event) => event.name === "enroll").input.friendlyName), "new setup has unique friendly name");
  let didClear = false;
  await api.verifyTotpEnrollment(f.auth, enrollment, "123456", () => { didClear = true; f.state.events.push({ name: "clear" }); });
  same(f.names(), ["capture", "isolated-list", "enroll", "challenge", "verify", "clear", "promote", "dispose"], "verify clears secrets before guarded promotion and disposes");
  check(didClear, "successful verify clears public secrets");
  same(f.state.events.find((event) => event.name === "promote").input, f.state.verified, "promote exact provider token pair");
  await rejected(() => api.verifyTotpEnrollment(f.auth, enrollment, "123456"), /no longer active/i);
  check(!f.names().includes("parent-list") && !f.names().includes("delete"), "operation never uses mutable parent MFA or deletes factors");

  f = fixture({ factors: { all: [{ id: "old", factor_type: "totp", status: "unverified" }], totp: [] } });
  enrollment = await setup(f); api.discardTotpEnrollment(enrollment);
  check(f.state.flows[0].disposed && !f.names().includes("delete"), "unfinished earlier setup permits independent new setup without deletion");
  api.discardTotpEnrollment(enrollment);
  await rejected(() => api.verifyTotpEnrollment(f.auth, { ...enrollment }, "123456"), /no longer active/i);
  f = fixture({ flowFactors: { totp: [{ id: FACTOR, status: "verified" }] } });
  await rejected(() => setup(f), /already enabled/i);
  check(f.state.flows[0].disposed && !f.names().includes("enroll"), "existing verified factor is not reenrolled");
  for (const options of [
    { enrollError: { message: "synthetic enroll failure" } },
    { enrolled: { id: FACTOR, type: "totp", totp: { qr_code: "https://invalid.example", secret: SECRET } } },
    { flowCurrent: false },
  ]) {
    f = fixture(options); await rejected(() => setup(f), /synthetic enroll|QR code|session changed/i);
    check(f.state.flows[0].disposed, "failed start releases captured flow");
  }
  for (const [options, pattern, clearExpected] of [
    [{ challengeError: { message: "synthetic challenge failure" } }, /synthetic challenge/, false],
    [{ challenge: null }, /challenge is unavailable/i, false],
    [{ verifyError: { message: "synthetic invalid OTP" } }, /synthetic invalid OTP/, false],
    [{ verified: {} }, /no session was returned/i, true],
    [{ promoteError: "Web Locks unavailable" }, /Web Locks/, true],
  ]) {
    f = fixture(options); enrollment = await setup(f); didClear = false;
    await rejected(() => api.verifyTotpEnrollment(f.auth, enrollment, "123456", () => { didClear = true; }), pattern);
    check(didClear === clearExpected, "clear only after successful provider verification");
    check(f.state.flows[0].disposed === clearExpected, "already-verified flow disposed even when promotion fails");
    api.discardTotpEnrollment(enrollment);
  }
  f = fixture(); enrollment = await setup(f);
  f.state.afterVerify = () => { f.state.flowCurrent = false; }; didClear = false;
  await rejected(() => api.verifyTotpEnrollment(f.auth, enrollment, "123456", () => { didClear = true; }), /session changed/i);
  check(didClear && f.state.flows[0].disposed && !f.names().includes("promote"), "retired successful verify clears secrets but cannot promote");

  for (const code of ["", "12345", "12a456"]) {
    f = fixture(); enrollment = await setup(f);
    await rejected(() => api.verifyTotpEnrollment(f.auth, enrollment, code), /6-digit/);
    check(!f.names().includes("challenge"), "invalid code has no challenge side effect"); api.discardTotpEnrollment(enrollment);
  }
  f = fixture({ flowFactors: { totp: [{ id: FACTOR, status: "verified" }] } });
  await api.verifyExistingTotp(f.auth, USER, FACTOR, "123456", () => true);
  same(f.names(), ["capture", "isolated-list", "challenge", "verify", "promote", "dispose"], "existing-factor step-up uses captured provider and guarded promotion");
  f = fixture();
  await rejected(() => api.verifyExistingTotp(f.auth, USER, FACTOR, "123456", () => true), /unavailable/i);
  check(f.state.flows[0].disposed && !f.names().includes("challenge"), "missing verified factor denies before challenge");
  for (const [gateName, forbidden] of [
    ["listGate", ["challenge", "verify", "promote"]],
    ["challengeGate", ["verify", "promote"]],
    ["verifyGate", ["promote"]],
    ["promoteGate", []],
  ]) {
    const gate = deferred();
    f = fixture({ flowFactors: { totp: [{ id: FACTOR, status: "verified" }] }, [gateName]: gate });
    const inFlight = api.verifyExistingTotp(f.auth, USER, FACTOR, "123456", () => f.state.flowCurrent);
    await pump(); f.state.flowCurrent = false; gate.resolve();
    await rejected(() => inFlight, /session changed/i);
    check(f.state.flows[0].disposed && !f.state.promotionComplete && forbidden.every((name) => !f.names().includes(name)), "retirement stops each isolated await and always disposes: " + gateName);
  }
  f = fixture(); await rejected(() => api.verifyExistingTotp(f.auth, USER, FACTOR, "bad", () => true), /6-digit/);
  check(f.state.flows.length === 0, "existing invalid OTP denies before capture");
}
function hookHarness(file, dependencies, globals, props) {
  const states = [], refs = [], effects = [], cleanups = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0;
  const react = { __esModule: true, default: {},
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], (value) => { states[index] = value; }]; },
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
  const text = (node) => { if (node == null || typeof node === "boolean") return ""; if (typeof node !== "object") return String(node); const children = node.props?.children; return (Array.isArray(children) ? children : [children]).map(text).join(""); };
  const button = (label) => { const found = nodes().find((node) => node.type === "button" && text(node) === label); assert.ok(found, "actual button " + label); return found; };
  const mount = async () => { render(); effects.forEach((work) => cleanups.push(work())); await pump(); render(); };
  return { states, refs, nodes, button, text, mount, render, unmount: () => cleanups.forEach((cleanup) => cleanup?.()) };
}
async function componentChecks() {
  const returns = load("src/lib/auth/mfaReturn.ts");
  const destination = "/shops/" + USER + "?tab=mobile";
  const logs = [];
  function ui(f, returnTo = destination) {
    const location = { href: "", pathname: "/settings", search: "" };
    const h = hookHarness("src/components/EnableMFAClient.tsx", {
      "@/lib/supabase/client": { supabaseBrowser: () => ({ auth: f.auth }) },
      "@/lib/auth/mfaReturn": returns, "@/lib/auth/mfaEnrollment": api,
    }, { window: { location }, console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) } }, { required: true, returnTo });
    return { ...h, location };
  }
  async function start(h) { h.button("Enable authenticator app").props.onClick(); await pump(); h.render(); }
  async function submit(h) {
    const input = h.nodes().find((node) => node.type === "input"); assert.ok(input);
    input.props.onChange({ target: { value: "123456" } });
    const form = h.nodes().find((node) => node.type === "form"); assert.ok(form);
    form.props.onSubmit({ preventDefault() {} }); await pump(); h.render();
  }
  let f = fixture(), h = ui(f); await h.mount();
  check(!f.names().includes("capture"), "mount never auto-enrolls");
  h.button("Enable authenticator app").props.onClick(); h.button("Enable authenticator app").props.onClick(); await pump();
  check(f.state.flows.length === 1, "busy guard prevents duplicate captures");
  check(h.nodes().some((node) => node.type === "img") && h.nodes().some((node) => node.type === "code" && h.text(node) === SECRET), "actual component displays setup QR/key");
  f.state.beforePromote = () => check(h.states[3] === null && h.refs[4].current === null, "actual component clears secrets before promotion");
  await submit(h);
  check(h.location.href === destination && f.state.flows[0].disposed, "verified component returns after captured promotion");
  h.unmount(); check(f.state.unsubscribed, "unmount unsubscribes");

  f = fixture({ trackFactors: true }); h = ui(f); await h.mount(); await start(h);
  h.button("Close setup").props.onClick(); await pump();
  check(h.states[3] === null && f.state.flows[0].disposed && !f.names().includes("delete"), "close disposes only local setup");
  check(f.state.factors.all.some((factor) => factor.id === FACTOR && factor.status === "unverified") && !h.location.href, "close preserves unfinished provider factor");
  check(!h.nodes().some((node) => node.type === "img" || node.type === "code"), "close hides all setup secrets");
  for (const options of [{ verifyError: { message: "synthetic invalid OTP" } }, { promoteError: "Web Locks unavailable" }]) {
    f = fixture(options); h = ui(f); await h.mount(); await start(h); await submit(h);
    check(!h.location.href, "failed verification or promotion never navigates");
    check(Boolean(h.states[3]) === Boolean(options.verifyError), "only still-unverified setup retains retry secrets");
    if (h.states[3]) h.button("Close setup").props.onClick();
  }

  f = fixture(); h = ui(f); await h.mount(); await start(h);
  f.state.listener("SIGNED_IN", { user: { id: USER } }); h.render();
  check(h.states[3] === null && h.states[1] === null && f.state.flows[0].disposed, "same-user new sign-in retires setup, clears secret and disposes flow");
  check(!f.names().includes("delete") && !h.location.href, "retirement never deletes provider factor or navigates");

  f = fixture({ parentListGate: deferred() }); h = ui(f); await h.mount();
  f.state.listener("SIGNED_IN", { user: { id: USER } }); f.state.parentListGate.resolve(); await pump(); h.render();
  check(h.states[1] === null && !h.nodes().some((node) => node.type === "button"), "sign-in during initial load cannot restore old UI eligibility");

  f = fixture({ retireAfterEnroll: true }); h = ui(f); await h.mount(); await start(h);
  check(h.states[3] === null && f.state.flows[0].disposed && !h.location.href, "late returned setup is locally disposed after retirement");

  f = fixture({ enrollGate: deferred() }); h = ui(f); await h.mount();
  h.button("Enable authenticator app").props.onClick(); await pump(); h.unmount(); f.state.enrollGate.resolve(); await pump();
  check(h.states[3] === null && f.state.flows[0].disposed, "unmount during provider await cannot restore setup secrets");

  f = fixture({ verifyGate: deferred() }); h = ui(f); await h.mount(); await start(h); await submit(h);
  f.state.listener("SIGNED_OUT", null); f.state.verifyGate.resolve(); await pump(); h.render();
  check(h.states[3] === null && !h.location.href && !f.names().includes("promote"), "late verified response after sign-out cannot promote or restore secrets");

  f = fixture({ factors: { all: [{ id: "old", factor_type: "totp", status: "unverified" }], totp: [] } });
  h = ui(f); await h.mount(); await start(h);
  check(f.state.flows.length === 1 && !f.names().includes("delete"), "unfinished provider factor does not cause unsafe deletion");
  h.button("Close setup").props.onClick();
  f = fixture({ factors: { all: [], totp: [{ id: FACTOR, status: "verified" }] } });
  h = ui(f, "//attacker.invalid"); await h.mount(); h.button("Verify now").props.onClick();
  check(h.location.href === "/mfa?next=%2Fdashboard" && f.state.flows.length === 0, "existing authenticator uses safe step-up destination");
  check(logs.length === 0, "no QR/key console logging");
}
async function main() {
  await helperChecks(); await componentChecks();
  console.log("PASS: " + checks + " captured-flow enrollment/helper and actual component checks.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
