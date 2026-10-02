const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const messagingRoutePath = path.join(root, "src", "app", "api", "desktop", "messaging", "route.ts");
const summaryRoutePath = path.join(root, "src", "app", "api", "desktop", "messaging-summary", "route.ts");
const provisionRoutePath = path.join(root, "src", "app", "api", "desktop", "provision-employee", "route.ts");
const boundedJsonPath = path.join(root, "src", "lib", "security", "boundedJsonRequest.ts");

const SHOP_ID = "f0600000-0000-4000-8000-000000000001";
const USER_ID = "f0600000-0000-4000-8000-000000000101";
const ACTOR_ID = "f0600000-0000-4000-8000-000000000201";
const RECIPIENT_ID = "f0600000-0000-4000-8000-000000000202";
const CONVERSATION_ID = "f0600000-0000-4000-8000-000000000401";
const MESSAGE_ID = "f0600000-0000-4000-8000-000000000501";

function fail(message) {
  throw new Error(`F06 API verification failed: ${message}`);
}

function transpile(sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const result = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
      strict: true,
    },
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) {
    fail(ts.formatDiagnostics(errors, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }));
  }
  return result.outputText;
}

function loadTypeScriptWithMocks(sourcePath, mocks = {}) {
  const compiled = transpile(sourcePath);
  const loaded = new Module(sourcePath, module);
  loaded.filename = sourcePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
  const originalLoad = Module._load;
  try {
    Module._load = function loadWithMocks(request, parent, isMain) {
      if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
      return originalLoad.call(this, request, parent, isMain);
    };
    loaded._compile(compiled, sourcePath);
    return loaded.exports;
  } finally {
    Module._load = originalLoad;
  }
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

function postRequest(body) {
  return new Request("https://f06-synthetic.example.invalid/api/desktop/messaging", {
    method: "POST",
    headers: {
      authorization: "Bearer synthetic-token",
      "content-type": "application/json; charset=utf-8",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function nextGet(pathname, parameters) {
  const url = new URL(`https://f06-synthetic.example.invalid${pathname}`);
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
  const request = new Request(url, {
    headers: { authorization: "Bearer synthetic-token" },
  });
  Object.defineProperty(request, "nextUrl", { value: url });
  return request;
}

async function responseBody(response) {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    fail(`route returned non-JSON content: ${text.slice(0, 80)}`);
  }
}

function assertNoStore(response, label) {
  if (!/^no-store(?:,|$)/i.test(response.headers.get("cache-control") ?? "")) {
    fail(`${label} omitted Cache-Control: no-store`);
  }
}

function assertExact(value, expected, label) {
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    fail(`${label} differed: ${JSON.stringify(value)}`);
  }
}

async function verifyMessagingRoutes() {
  const boundedJson = loadTypeScriptWithMocks(boundedJsonPath);
  const state = {
    events: [],
    calls: [],
    rpcResponses: new Map(),
    rateLimited: false,
    authError: null,
    entitlementError: null,
  };

  const reset = () => {
    state.events = [];
    state.calls = [];
    state.rpcResponses = new Map();
    state.rateLimited = false;
    state.authError = null;
    state.entitlementError = null;
  };
  const queueRpc = (name, ...responses) => state.rpcResponses.set(name, responses.slice());
  const client = {
    async rpc(name, args) {
      state.events.push(`rpc:${name}`);
      state.calls.push({ name, args: { ...args } });
      const queue = state.rpcResponses.get(name);
      if (!queue || queue.length === 0) fail(`unexpected or unconfigured RPC ${name}`);
      return queue.shift();
    },
  };
  const sharedMocks = {
    "next/server": { NextRequest: Request, NextResponse: { json: jsonResponse } },
    "@/lib/desktopAuth": {
      requireSessionUser: async () => {
        state.events.push("auth");
        if (state.authError) throw state.authError;
        return { user: { id: USER_ID }, accessToken: "synthetic-token" };
      },
    },
    "@/lib/billing/writeGuard": {
      requireShopEntitlementWriteAllowed: async () => {
        state.events.push("entitlement");
        if (state.entitlementError) throw state.entitlementError;
        return { allowed: true, restricted: false };
      },
    },
    "@/lib/security/boundedJsonRequest": boundedJson,
    "@/lib/security/rateLimit": {
      rateLimitOrThrow: () => {
        state.events.push("rate");
        if (state.rateLimited) throw new Error("synthetic limiter detail");
      },
    },
    "@/lib/supabase/bearer": {
      supabaseForAccessToken: (token) => {
        if (token !== "synthetic-token") fail("route did not pass the verified bearer token");
        return client;
      },
    },
  };
  const messaging = loadTypeScriptWithMocks(messagingRoutePath, sharedMocks);
  const summary = loadTypeScriptWithMocks(summaryRoutePath, sharedMocks);
  const validBody = {
    shop_id: SHOP_ID,
    sender_employee_id: ACTOR_ID,
    recipient_employee_id: RECIPIENT_ID,
    body: "F06 synthetic message",
  };

  reset();
  queueRpc("rb_messaging_assert_actor_employee_id", { data: ACTOR_ID, error: null });
  queueRpc("rb_messaging_send_dm", {
    data: [{ conversation_id: CONVERSATION_ID, message_id: MESSAGE_ID }],
    error: null,
  });
  queueRpc("rb_messaging_list_messages", {
    data: [{
      id: MESSAGE_ID,
      shop_id: SHOP_ID,
      conversation_id: CONVERSATION_ID,
      sender_employee_id: ACTOR_ID,
      sender_display_name: "Synthetic Actor",
      body: "F06 synthetic message",
      created_at: "2026-01-01T00:00:00.000Z",
      edited_at: null,
    }],
    error: null,
  });
  let response = await messaging.POST(postRequest(validBody));
  let body = await responseBody(response);
  assertNoStore(response, "successful send");
  if (response.status !== 200 || body.json.ok !== true) fail("valid Desktop send failed");
  assertExact(state.events, [
    "auth",
    "rate",
    "rpc:rb_messaging_assert_actor_employee_id",
    "entitlement",
    "rpc:rb_messaging_send_dm",
    "rpc:rb_messaging_list_messages",
  ], "successful send event order");
  assertExact(state.calls[0], {
    name: "rb_messaging_assert_actor_employee_id",
    args: { p_shop_id: SHOP_ID, p_asserted_employee_id: ACTOR_ID },
  }, "Desktop actor assertion call");
  assertExact(state.calls[1], {
    name: "rb_messaging_send_dm",
    args: { p_shop_id: SHOP_ID, p_other_employee_id: RECIPIENT_ID, p_body: "F06 synthetic message" },
  }, "actor-derived send call");
  if (JSON.stringify(state.calls[1].args).includes("sender")) {
    fail("Desktop sender identity reached the send RPC");
  }

  reset();
  queueRpc("rb_messaging_assert_actor_employee_id", {
    data: null,
    error: { code: "42501", message: "SYNTHETIC_SECRET_DATABASE_DETAIL" },
  });
  response = await messaging.POST(postRequest(validBody));
  body = await responseBody(response);
  assertNoStore(response, "wrong-actor send");
  if (
    response.status !== 403 ||
    !/limited to the active employee bound/i.test(body.json.error) ||
    body.text.includes("SYNTHETIC_SECRET_DATABASE_DETAIL") ||
    state.events.includes("entitlement") ||
    state.events.some((event) => event === "rpc:rb_messaging_send_dm")
  ) {
    fail("wrong Desktop actor did not fail closed before message/billing access");
  }

  reset();
  response = await messaging.POST(postRequest({ ...validBody, extra: true }));
  body = await responseBody(response);
  if (response.status !== 400 || state.calls.length !== 0 || state.events.join(",") !== "auth,rate") {
    fail("extra JSON field was not rejected after auth and before database access");
  }

  reset();
  response = await messaging.POST(postRequest({ ...validBody, sender_employee_id: "not-a-uuid" }));
  body = await responseBody(response);
  if (response.status !== 400 || state.calls.length !== 0 || state.events.join(",") !== "auth,rate") {
    fail("invalid UUID was not rejected before database access");
  }

  reset();
  response = await messaging.POST(postRequest({ ...validBody, body: "x".repeat(10_001) }));
  body = await responseBody(response);
  if (response.status !== 400 || state.calls.length !== 0 || state.events.join(",") !== "auth,rate") {
    fail("overlong message body was not rejected before database access");
  }

  reset();
  response = await messaging.POST(postRequest("x".repeat(17 * 1024)));
  body = await responseBody(response);
  if (response.status !== 413 || state.calls.length !== 0 || state.events.join(",") !== "auth,rate") {
    fail("oversized JSON body was not rejected after auth and before database access");
  }

  reset();
  queueRpc("rb_messaging_assert_actor_employee_id", {
    data: null,
    error: { code: "XX000", message: "SYNTHETIC_RAW_DATABASE_FAILURE" },
  });
  response = await messaging.POST(postRequest(validBody));
  body = await responseBody(response);
  if (response.status !== 503 || body.text.includes("SYNTHETIC_RAW_DATABASE_FAILURE")) {
    fail("raw database failure was reflected by the send route");
  }

  reset();
  state.rateLimited = true;
  response = await messaging.POST(postRequest(validBody));
  body = await responseBody(response);
  if (response.status !== 429 || state.events.join(",") !== "auth,rate" || state.calls.length !== 0) {
    fail("send rate limit did not run immediately after authentication");
  }

  reset();
  queueRpc("rb_messaging_assert_actor_employee_id", {
    data: null,
    error: { code: "42501", message: "SYNTHETIC_WRONG_ACTOR_READ_DETAIL" },
  });
  response = await messaging.GET(nextGet("/api/desktop/messaging", {
    shop_id: SHOP_ID,
    sender_employee_id: RECIPIENT_ID,
    recipient_employee_id: ACTOR_ID,
  }));
  body = await responseBody(response);
  if (
    response.status !== 403 ||
    body.text.includes("SYNTHETIC_WRONG_ACTOR_READ_DETAIL") ||
    state.events.some((event) => event === "rpc:rb_messaging_find_dm")
  ) {
    fail("wrong Desktop actor reached the thread read path");
  }

  reset();
  queueRpc("rb_messaging_assert_actor_employee_id", { data: ACTOR_ID, error: null });
  queueRpc("rb_messaging_find_dm", { data: null, error: null });
  response = await messaging.GET(nextGet("/api/desktop/messaging", {
    shop_id: SHOP_ID,
    sender_employee_id: ACTOR_ID,
    recipient_employee_id: RECIPIENT_ID,
  }));
  body = await responseBody(response);
  assertNoStore(response, "empty thread read");
  if (
    response.status !== 200 ||
    body.json.conversation_id !== "" ||
    body.json.messages.length !== 0 ||
    state.events.some((event) => event === "rpc:rb_messaging_get_or_create_dm")
  ) {
    fail("Desktop GET created or mishandled a missing direct message");
  }

  reset();
  queueRpc("rb_messaging_assert_actor_employee_id", { data: ACTOR_ID, error: null });
  queueRpc("rb_messaging_find_dm", { data: CONVERSATION_ID, error: null });
  queueRpc("rb_messaging_list_messages", {
    data: Array.from({ length: 100 }, (_, index) => ({
      id: MESSAGE_ID,
      shop_id: SHOP_ID,
      conversation_id: CONVERSATION_ID,
      sender_employee_id: ACTOR_ID,
      sender_display_name: `Synthetic Actor ${index}`,
      body: "x".repeat(10_000),
      created_at: `2026-01-01T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
      edited_at: null,
    })),
    error: null,
  });
  response = await messaging.GET(nextGet("/api/desktop/messaging", {
    shop_id: SHOP_ID,
    sender_employee_id: ACTOR_ID,
    recipient_employee_id: RECIPIENT_ID,
  }));
  body = await responseBody(response);
  if (
    response.status !== 200 ||
    Buffer.byteLength(body.text, "utf8") > 512 * 1024 ||
    body.json.messages.length < 1 ||
    body.json.messages.length >= 100
  ) {
    fail("Desktop thread response was not reduced to a useful bounded newest subset");
  }

  reset();
  queueRpc("rb_messaging_assert_actor_employee_id", {
    data: null,
    error: { code: "42501", message: "SYNTHETIC_WRONG_ACTOR_SUMMARY_DETAIL" },
  });
  response = await summary.GET(nextGet("/api/desktop/messaging-summary", {
    shop_id: SHOP_ID,
    sender_employee_id: RECIPIENT_ID,
  }));
  body = await responseBody(response);
  assertNoStore(response, "wrong-actor summary");
  if (
    response.status !== 403 ||
    body.text.includes("SYNTHETIC_WRONG_ACTOR_SUMMARY_DETAIL") ||
    state.events.some((event) => event === "rpc:rb_messaging_dm_summary")
  ) {
    fail("wrong Desktop actor reached the summary read path");
  }

  reset();
  queueRpc("rb_messaging_assert_actor_employee_id", { data: ACTOR_ID, error: null });
  queueRpc("rb_messaging_dm_summary", { data: [], error: null });
  response = await summary.GET(nextGet("/api/desktop/messaging-summary", {
    shop_id: SHOP_ID,
    sender_employee_id: ACTOR_ID,
  }));
  body = await responseBody(response);
  if (response.status !== 200 || body.json.ok !== true || body.json.conversations.length !== 0) {
    fail("valid Desktop summary request failed");
  }
  assertExact(state.events, [
    "auth",
    "rate",
    "rpc:rb_messaging_assert_actor_employee_id",
    "rpc:rb_messaging_dm_summary",
  ], "summary event order");

  reset();
  state.authError = new Error("Not authenticated");
  response = await messaging.POST(postRequest("not valid JSON"));
  body = await responseBody(response);
  if (response.status !== 401 || state.events.join(",") !== "auth" || state.calls.length !== 0) {
    fail("Desktop send parsed or rate-limited an unauthenticated request before rejecting it");
  }
}

async function verifyProvisionAuthority() {
  const state = {
    events: [],
    membership: null,
    query: null,
    entitlement: { allowed: false, restricted: true, reason: "synthetic_restricted" },
  };
  const admin = {
    from(table) {
      if (table !== "rb_shop_members") {
        state.events.push(`unexpected-table:${table}`);
        fail(`provision authority test reached ${table} before its stop condition`);
      }
      const query = { table, select: null, predicates: [] };
      const builder = {
        select(columns) {
          query.select = columns;
          return builder;
        },
        eq(column, value) {
          query.predicates.push([column, value]);
          return builder;
        },
        async maybeSingle() {
          state.events.push("membership");
          state.query = query;
          return { data: state.membership, error: null };
        },
      };
      return builder;
    },
  };
  const route = loadTypeScriptWithMocks(provisionRoutePath, {
    "next/server": { NextResponse: { json: jsonResponse } },
    "@/lib/desktopAuth": {
      requireSessionUser: async () => {
        state.events.push("auth");
        return { user: { id: USER_ID }, accessToken: "synthetic-token" };
      },
    },
    "@/lib/supabase/admin": { supabaseAdmin: () => admin },
    "@/lib/authz": {
      assertUuid: (_label, value) => {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
          throw new Error("must be a UUID");
        }
      },
    },
    "@/lib/billing/entitlement": {
      getShopEntitlement: async () => {
        state.events.push("entitlement");
        return state.entitlement;
      },
    },
  });
  const request = () => new Request(
    "https://f06-synthetic.example.invalid/api/desktop/provision-employee",
    {
      method: "POST",
      headers: { authorization: "Bearer synthetic-token", "content-type": "application/json" },
      body: JSON.stringify({
        shop_id: SHOP_ID,
        display_name: "F06 Synthetic Employee",
        employee_code: "F06-SYNTHETIC",
        provision_mode: "create_employee_only",
      }),
    },
  );

  state.events = [];
  state.membership = { id: "synthetic-membership", role: "member" };
  let response = await route.POST(request());
  let body = await responseBody(response);
  if (response.status !== 403 || body.json.error !== "Access denied" || state.events.join(",") !== "auth,membership") {
    fail("ordinary active shop member reached provision-employee mutations");
  }
  assertExact(state.query, {
    table: "rb_shop_members",
    select: "id, role",
    predicates: [["shop_id", SHOP_ID], ["user_id", USER_ID], ["is_active", true]],
  }, "provision membership query");

  state.events = [];
  state.membership = null;
  response = await route.POST(request());
  body = await responseBody(response);
  if (response.status !== 403 || state.events.join(",") !== "auth,membership") {
    fail("inactive/missing shop membership reached provision-employee mutations");
  }

  state.events = [];
  state.membership = { id: "synthetic-membership", role: "admin" };
  response = await route.POST(request());
  body = await responseBody(response);
  if (response.status !== 402 || state.events.join(",") !== "auth,membership,entitlement") {
    fail("active admin was not admitted to the entitlement gate after authority validation");
  }

  state.events = [];
  state.membership = { id: "synthetic-membership", role: "owner" };
  response = await route.POST(request());
  body = await responseBody(response);
  if (response.status !== 402 || state.events.join(",") !== "auth,membership,entitlement") {
    fail("active owner was not admitted to the entitlement gate after authority validation");
  }
}

(async () => {
  await verifyMessagingRoutes();
  await verifyProvisionAuthority();
  console.log("F06 API verification passed: auth-first exact parsing, bearer actor assertions, non-leaking failures, no-store bounds, and active owner/admin provisioning authority.");
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
