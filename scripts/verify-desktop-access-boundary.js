const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");

// Execute the real handlers with synthetic query/session/provider adapters.
// No environment files, real accounts, network calls or file writes are used.
const root = path.resolve(__dirname, "..");
const SHOP = "10000000-0000-4000-8000-000000000001";
const USER = "20000000-0000-4000-8000-000000000001";
const DEVICE = "30000000-0000-4000-8000-000000000001";
const OTHER_SHOP = "10000000-0000-4000-8000-000000000002";
const PRIVATE_FIELDS = ["home_address_1", "home_address_2", "home_city", "home_state",
  "home_postal_code", "social_security_number", "mobile_pin_salt_base64", "mobile_pin_hash_base64"];
const keys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = keys.privateKey.export({ type: "pkcs8", format: "pem" });
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function harness(options = {}) {
  const member = { shop_id: SHOP, user_id: USER, role: options.role || "owner", is_active: options.active !== false };
  const employee = { id: "40000000-0000-4000-8000-000000000001", shop_id: SHOP,
    auth_user_id: USER, employee_code: "SYN-1", display_name: "Synthetic Employee", is_active: true,
    can_administrative_complete_close: true,
    ...Object.fromEntries(PRIVATE_FIELDS.map(field => [field, "synthetic-" + field])) };
  const tables = {
    rb_shop_members: options.memberships ? clone(options.memberships) : (options.noMembership ? [] : [member]),
    employees: [employee],
    rb_devices: options.newDevice ? [] : [{ id: DEVICE, shop_id: options.deviceShop || SHOP,
      status: options.deviceStatus || "active", device_role: "primary" }],
    rb_shops: [{ id: SHOP, trial_ends_at: null }],
  };
  const calls = { queries: [], writes: [], entitlements: 0, foreground: 0, avatar: 0, authTokens: [] };
  function from(table) {
    assert.ok(Object.hasOwn(tables, table), "Unexpected table " + table);
    let operation = "select", columns = "*", payload, result;
    const filters = [];
    const matches = row => filters.every(([key, value]) => row[key] === value);
    const project = row => columns === "*" ? clone(row) : Object.fromEntries(
      columns.split(",").map(x => x.trim()).filter(Boolean).map(key => key === "rb_shops:rb_shops(name)"
        ? ["rb_shops", clone(row.rb_shops)] : [key, clone(row[key])]));
    const run = async () => {
      if (result) return result;
      result = Promise.resolve().then(() => {
        calls.queries.push({ table, operation, columns, filters: clone(filters) });
        if (operation === "select" && table === "rb_shop_members" && options.membershipError)
          return { data: null, error: { message: "Synthetic membership lookup failed" } };
        if (operation === "select") return { data: tables[table].filter(matches).map(project), error: null };
        if (options.disableDuringUpdate && table === "rb_devices" && operation === "update") {
          tables.rb_devices[0].status = "disabled";
        }
        calls.writes.push({ table, operation, payload: clone(payload) });
        if (operation === "insert") tables[table].push(clone(payload));
        else for (const row of tables[table].filter(matches)) Object.assign(row, clone(payload));
        return { data: null, error: null };
      });
      return result;
    };
    const query = {
      select(value = "*") { columns = value; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      order() { return query; },
      update(value) { operation = "update"; payload = value; return query; },
      insert(value) { operation = "insert"; payload = value; return query; },
      async maybeSingle() { const r = await run(); assert.ok(!r.data || r.data.length <= 1); return { ...r, data: r.data?.[0] || null }; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    return query;
  }
  const admin = { from, storage: { from() { return { async createSignedUrl() {
    calls.avatar++; throw new Error("Avatar provider unexpectedly called"); } }; } } };
  const environment = {
    RUNBOOK_DESKTOP_ENTITLEMENT_PRIVATE_KEY_PEM: options.missingSigningKey ? "" : privatePem,
    RUNBOOK_DESKTOP_ENTITLEMENT_KEY_ID: "synthetic-v1",
    RUNBOOK_LICENSE_SIGNING_SECRET: "synthetic-license-secret",
  };
  const cached = new Map();
  function loadActual(relative) {
    if (cached.has(relative)) return cached.get(relative);
    const filename = path.join(root, relative);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    });
    assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
    const loaded = { exports: {} };
    new Function("exports", "require", "module", "process", "fetch", compiled.outputText)(
      loaded.exports, requireSynthetic, loaded, { env: environment },
      () => { throw new Error("Network access forbidden in synthetic regression"); });
    cached.set(relative, loaded.exports);
    return loaded.exports;
  }
  function requireSynthetic(name) {
    if (name === "crypto" || name === "node:crypto") return crypto;
    if (name === "next/server") return { NextResponse: { json(body, init = {}) {
      return new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json", ...init.headers } });
    } } };
    if (name === "@/lib/desktopAuth") return { async requireSessionUser(req) {
      calls.authTokens.push(req.headers.get("authorization"));
      if (options.unauthenticated || req.headers.get("authorization") !== "Bearer synthetic-session") throw new Error("Not authenticated");
      return { user: { id: USER }, accessToken: "synthetic-session" };
    } };
    if (name === "@/lib/supabase/admin") return { supabaseAdmin: () => admin };
    if (name === "@/lib/billing/entitlement") return { async getShopEntitlement(shopId) {
      assert.equal(shopId, SHOP); calls.entitlements++;
      return clone(options.entitlement || { status: "active", allowed: true, restricted: false, reason: "synthetic_active", grace_active: false });
    } };
    if (name === "@/lib/billing/access") return { describeShopAccess(e) {
      return { state: e.allowed ? "active" : "restricted", desktop_mode: e.allowed ? "full" : "read_only",
        mobile_mode: e.allowed ? "full" : "queue_only", workstation_mode: e.allowed ? "full" : "blocked" };
    } };
    if (name === "@/lib/control/cleanup") return { async loadPendingCleanup() { return { preferred: options.cleanupRequired ? { id: "synthetic-cleanup" } : null }; },
      formatCleanupResponse() { if (!options.cleanupRequired) throw new Error("Unexpected cleanup"); return { id: "synthetic-cleanup" }; } };
    if (name === "@/lib/business/businessForegroundIdentity") return {
      BUSINESS_FOREGROUND_PROJECTION: "business-foreground-v1",
      async businessForegroundMetadata() { calls.foreground++; return Response.json({ ok: true, projection: "synthetic-foreground" }); },
    };
    if (name === "@/lib/administrativeCompletionAuthority") return {
      ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE: "work-order.complete-close.override",
      ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION: 1,
      ADMINISTRATIVE_COMPLETION_DIRECTORY_CONTRACT_VERSION: 1,
    };
    if (name === "../entitlement/route") {
      const issuer = loadActual("src/app/api/desktop/entitlement/route.ts");
      return { ...issuer, async POST(req) {
        const response = await issuer.POST(req);
        if (options.changeSigningKey) {
          environment.RUNBOOK_DESKTOP_ENTITLEMENT_PRIVATE_KEY_PEM =
            crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
        }
        return response;
      } };
    }
    if (name === "@/lib/device/localIdentity") return loadActual("src/lib/device/localIdentity.ts");
    if (name === "@/lib/billing/writeGuard") return loadActual("src/lib/billing/writeGuard.ts");
    throw new Error("Unexpected dependency " + name);
  }
  return { calls, tables, async request(routeName, extra = {}) {
    const url = new URL("https://control.example.invalid/api/desktop/" + routeName);
    const isDirectory = routeName === "employee-directory";
    const isGet = isDirectory || routeName === "current-shop";
    if (isDirectory) url.searchParams.set("shop_id", SHOP);
    for (const [key, value] of Object.entries(extra.query || {})) {
      for (const entry of Array.isArray(value) ? value : [value]) url.searchParams.append(key, entry);
    }
    const req = new Request(url, { method: isGet ? "GET" : "POST",
      headers: { authorization: "Bearer synthetic-session", "content-type": "application/json" },
      ...(isGet ? {} : { body: JSON.stringify({ shop_id: SHOP, device_id: DEVICE, ...extra.body }) }) });
    Object.defineProperty(req, "nextUrl", { value: url });
    const route = loadActual("src/app/api/desktop/" + routeName + "/route.ts");
    const response = await route[isGet ? "GET" : "POST"](req);
    return { status: response.status, body: await response.json(), headers: Object.fromEntries(response.headers.entries()) };
  } };
}

async function main() {
  let passed = 0;
  async function test(label, run) { await run(); passed++; console.log("PASS " + label); }
  for (const role of ["member", "employee", "viewer"]) {
    await test(role + " retains normal directory and administrative projection without private fields", async () => {
      const h = harness({ role }); const r = await h.request("employee-directory");
      assert.equal(r.status, 200); assert.equal(r.body.employees[0].employee_code, "SYN-1");
      assert.equal(r.body.administrative_completion_contract_version, 1);
      assert.deepEqual(r.body.employees[0].administrative_capabilities, [{ code: "work-order.complete-close.override", version: 1 }]);
      for (const key of PRIVATE_FIELDS) {
        assert.equal(Object.hasOwn(r.body.employees[0], key), false, key + " leaked");
        for (const q of h.calls.queries.filter(q => q.table === "employees")) assert.ok(!q.columns.split(",").includes(key));
      }
      assert.equal(h.calls.writes.length, 0); assert.equal(h.calls.avatar, 0);
    });
  }
  for (const role of ["owner", "admin"]) {
    await test(role + " retains authorized full employee synchronization", async () => {
      const h = harness({ role }); const r = await h.request("employee-directory");
      assert.equal(r.status, 200);
      for (const key of PRIVATE_FIELDS) assert.equal(r.body.employees[0][key], "synthetic-" + key);
      assert.equal(h.calls.writes.length, 0);
    });
  }
  for (const options of [{ active: false }, { noMembership: true }, { unauthenticated: true }]) {
    await test("directory denies " + JSON.stringify(options) + " before employee read", async () => {
      const h = harness(options); const r = await h.request("employee-directory");
      assert.equal(r.status, options.unauthenticated ? 401 : 403);
      assert.equal(h.calls.queries.filter(q => q.table === "employees").length, 0);
      assert.equal(h.calls.writes.length, 0);
    });
  }
  await test("existing foreground projection remains separate from full directory", async () => {
    const h = harness({ role: "member" }); const r = await h.request("employee-directory", { query: { projection: "business-foreground-v1" } });
    assert.equal(r.status, 200); assert.equal(r.body.projection, "synthetic-foreground");
    assert.equal(h.calls.foreground, 1); assert.equal(h.calls.queries.length, 0);
  });
  for (const routeName of ["entitlement", "issue-license"]) {
    for (const options of [{ active: false }, { noMembership: true }]) {
      await test(routeName + " denies " + JSON.stringify(options) + " before entitlement signing", async () => {
        const h = harness(options); const r = await h.request(routeName);
        assert.equal(r.status, 403); assert.equal(h.calls.entitlements, 0);
        assert.equal(h.calls.writes.length, 0);
      });
    }
    await test(routeName + " still issues authentic signed output to an active member", async () => {
      const h = harness({ role: "member" }); const r = await h.request(routeName); assert.equal(r.status, 200);
      if (routeName === "entitlement") {
        const e = r.body.envelope;
        assert.ok(crypto.verify("RSA-SHA256", Buffer.from(e.payload_b64, "base64url"), keys.publicKey, Buffer.from(e.signature_b64, "base64url")));
        const payload = JSON.parse(Buffer.from(e.payload_b64, "base64url").toString("utf8"));
        assert.equal(payload.shop_id, SHOP); assert.equal(payload.device_id, DEVICE); assert.equal(payload.entitlement.allowed, true);
      } else {
        const [header, payload, signature] = r.body.token.split(".");
        assert.equal(signature, crypto.createHmac("sha256", "synthetic-license-secret").update(header + "." + payload).digest("base64url"));
        assert.equal(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).shop_id, SHOP);
      }
    });
    await test(routeName + " rejects an inactive device", async () => {
      const h = harness({ deviceStatus: "disabled" }); const r = await h.request(routeName);
      assert.equal(r.status, 403); assert.equal(h.calls.entitlements, 0);
    });
  }
  await test("restricted shop receives restricted entitlement evidence without fabricated full access", async () => {
    const h = harness({ entitlement: { status: "expired", allowed: false, restricted: true, reason: "synthetic_expired", grace_active: false } });
    const r = await h.request("entitlement"); assert.equal(r.status, 200);
    assert.equal(r.body.payload.entitlement.allowed, false); assert.equal(r.body.payload.access.desktop_mode, "read_only");
  });
  for (const role of ["owner", "admin"]) {
    await test(role + " can enroll a new device", async () => {
      const h = harness({ role, newDevice: true }); const r = await h.request("register-device");
      assert.equal(r.status, 200); assert.equal(h.tables.rb_devices[0].status, "active");
      assert.equal(h.calls.writes[0].operation, "insert");
    });
  }
  for (const options of [{ active: false }, { role: "member" }, { noMembership: true }]) {
    await test("enrollment denies " + JSON.stringify(options) + " without writes", async () => {
      const h = harness(options); const r = await h.request("register-device");
      assert.equal(r.status, 403); assert.equal(h.calls.writes.length, 0); assert.equal(h.calls.entitlements, 0);
    });
  }
  for (const deviceStatus of ["disabled", "revoked", "inactive", "replaced"]) {
    await test("enrollment cannot reactivate " + deviceStatus + " device", async () => {
      const h = harness({ deviceStatus }); const r = await h.request("register-device");
      assert.equal(r.status, 403); assert.equal(h.tables.rb_devices[0].status, deviceStatus);
      assert.equal(h.calls.writes.length, 0);
    });
  }
  await test("enrollment cannot adopt another shop device", async () => {
    const h = harness({ deviceShop: OTHER_SHOP }); const r = await h.request("register-device");
    assert.equal(r.status, 403); assert.equal(h.calls.writes.length, 0);
  });
  for (const disableDuringUpdate of [false, true]) {
    await test("active enrollment retry preserves status, including concurrent disable=" + disableDuringUpdate, async () => {
      const h = harness({ disableDuringUpdate }); const r = await h.request("register-device",
        { body: { local_install_id: "synthetic-install", status: "active" } });
      assert.equal(r.status, 200); assert.equal(h.calls.writes.length, 1);
      assert.equal(Object.hasOwn(h.calls.writes[0].payload, "status"), false);
      assert.equal(h.tables.rb_devices[0].status, disableDuringUpdate ? "disabled" : "active");
      assert.equal(h.tables.rb_devices[0].local_install_id, "synthetic-install");
    });
  }

  const membership = (shopId, role, active = true, userId = USER, name = "Synthetic Shop") =>
    ({ shop_id: shopId, role, is_active: active, user_id: userId, rb_shops: { name } });
  const targetQuery = { shop_id: SHOP };
  for (const role of ["owner", "admin", "member", "viewer"]) {
    await test("target shop returns only authenticated active " + role + " membership", async () => {
      const h = harness({ memberships: [membership(OTHER_SHOP, "owner"), membership(SHOP, role)] });
      const r = await h.request("current-shop", { query: targetQuery });
      assert.equal(r.status, 200); assert.equal(r.body.found, true);
      assert.equal(r.body.user_id, USER); assert.equal(r.body.shop_id, SHOP);
      assert.equal(r.body.member_role, role); assert.equal(r.body.multiple_shops, false);
      const q = h.calls.queries.find(q => q.table === "rb_shop_members");
      for (const filter of [["user_id", USER], ["is_active", true], ["shop_id", SHOP]])
        assert.ok(q.filters.some(actual => actual[0] === filter[0] && actual[1] === filter[1]));
      assert.equal(h.calls.writes.length, 0); assert.equal(h.calls.entitlements, 0);
    });
  }
  for (const memberships of [
    [membership(SHOP, "owner", false), membership(OTHER_SHOP, "owner")],
    [membership(SHOP, "owner", true, DEVICE), membership(OTHER_SHOP, "owner")],
    [],
  ]) {
    await test("target lookup cannot substitute inactive, other-user or absent membership", async () => {
      const h = harness({ memberships }); const r = await h.request("current-shop", { query: targetQuery });
      assert.equal(r.status, 403); assert.equal(r.body.ok, false);
      assert.equal(Object.hasOwn(r.body, "shop_id"), false);
      assert.equal(h.calls.writes.length, 0);
    });
  }
  await test("target lookup ignores forged user identity and never retargets", async () => {
    const h = harness({ memberships: [membership(SHOP, "member"), membership(SHOP, "owner", true, DEVICE)] });
    const r = await h.request("current-shop", { query: { shop_id: SHOP, user_id: DEVICE } });
    assert.equal(r.status, 200); assert.equal(r.body.user_id, USER);
    assert.equal(r.body.member_role, "member"); assert.equal(h.calls.writes.length, 0);
  });
  await test("target lookup refuses ambiguous active membership", async () => {
    const h = harness({ memberships: [membership(SHOP, "owner"), membership(SHOP, "member")] });
    const r = await h.request("current-shop", { query: targetQuery });
    assert.equal(r.status, 409); assert.equal(r.body.ok, false);
  });
  for (const shop_id of ["", "not-a-uuid", "00000000-0000-0000-0000-000000000000", [SHOP, OTHER_SHOP]]) {
    await test("target lookup rejects malformed or duplicate shop parameter " + JSON.stringify(shop_id), async () => {
      const h = harness(); const r = await h.request("current-shop", { query: { shop_id } });
      assert.equal(r.status, 400); assert.equal(h.calls.queries.length, 0);
    });
  }
  await test("target lookup canonicalizes a UUID without selecting another shop", async () => {
    const target = "abcdefab-1234-4000-8000-abcdefabcdef";
    const h = harness({ memberships: [membership(target, "admin")] });
    const r = await h.request("current-shop", { query: { shop_id: " " + target.toUpperCase() + " " } });
    assert.equal(r.status, 200); assert.equal(r.body.shop_id, target); assert.equal(r.body.user_id, USER);
  });
  await test("legacy current shop sorts only active own memberships and returns caller identity", async () => {
    const h = harness({ memberships: [
      membership(SHOP, "owner", false, USER, "Inactive"),
      membership(OTHER_SHOP, "admin", true, USER, "Active"),
      membership(SHOP, "owner", true, DEVICE, "Foreign"),
    ] });
    const r = await h.request("current-shop");
    assert.equal(r.status, 200); assert.equal(r.body.shop_id, OTHER_SHOP);
    assert.equal(r.body.user_id, USER); assert.equal(r.body.member_role, "admin"); assert.equal(r.body.multiple_shops, false);
  });
  await test("legacy shop selection preserves role and name ranking among active shops", async () => {
    const h = harness({ memberships: [
      membership(SHOP, "admin", true, USER, "A"), membership(OTHER_SHOP, "owner", true, USER, "Z"),
    ] });
    const r = await h.request("current-shop");
    assert.equal(r.status, 200); assert.equal(r.body.shop_id, OTHER_SHOP); assert.equal(r.body.multiple_shops, true);
  });
  await test("legacy no membership remains a successful empty lookup", async () => {
    const h = harness({ noMembership: true }); const r = await h.request("current-shop");
    assert.equal(r.status, 200); assert.equal(r.body.found, false); assert.equal(r.body.user_id, USER);
  });
  for (const query of [undefined, targetQuery]) {
    await test("current shop requires an authenticated session before membership lookup", async () => {
      const h = harness({ unauthenticated: true }); const r = await h.request("current-shop", { query });
      assert.equal(r.status, 401); assert.equal(h.calls.queries.length, 0);
    });
    await test("current shop fails closed on membership read error", async () => {
      const h = harness({ membershipError: true }); const r = await h.request("current-shop", { query });
      assert.equal(r.status, 500); assert.equal(r.body.ok, false); assert.equal(h.calls.writes.length, 0);
    });
  }


  for (const role of ["owner", "admin", "member", "viewer"]) {
    await test("existing global public verification recovery is available to active " + role + " without a module grant", async () => {
      const h = harness({ role }); const r = await h.request("entitlement-key", { body: { user_id: DEVICE, role: "owner" } });
      assert.equal(r.status, 200); assert.equal(r.headers["cache-control"], "no-store");
      assert.deepEqual(Object.keys(r.body).sort(), ["ok", "trust", "envelope"].sort());
      const t = r.body.trust, e = r.body.envelope;
      assert.equal(t.version, 1); assert.equal(t.issuer, "runbook.control"); assert.equal(t.algorithm, "RS256");
      assert.equal(t.user_id, USER); assert.equal(t.shop_id, SHOP); assert.equal(t.device_id, DEVICE);
      assert.equal(t.key_id, e.key_id); assert.ok(t.public_key_pem.startsWith("-----BEGIN PUBLIC KEY-----"));
      assert.equal(JSON.stringify(r.body).includes("PRIVATE KEY"), false);
      const publicKey = crypto.createPublicKey(t.public_key_pem);
      assert.equal(publicKey.export({ type: "spki", format: "pem" }), keys.publicKey.export({ type: "spki", format: "pem" }));
      assert.ok(crypto.verify("RSA-SHA256", Buffer.from(e.payload_b64, "base64url"), publicKey, Buffer.from(e.signature_b64, "base64url")));
      const signed = JSON.parse(Buffer.from(e.payload_b64, "base64url").toString("utf8"));
      assert.equal(t.issued_at_utc, signed.server_time_utc);
      assert.equal(signed.shop_id, SHOP); assert.equal(signed.device_id, DEVICE);
      assert.deepEqual(h.calls.authTokens, ["Bearer synthetic-session", "Bearer synthetic-session"]);
      assert.equal(h.calls.entitlements, 1); assert.equal(h.calls.writes.length, 0);
    });
  }
  await test("restricted shop recovers verification trust with its actual restricted signed evidence", async () => {
    const h = harness({ role: "member", entitlement: { status: "expired", allowed: false, restricted: true, reason: "synthetic_expired", grace_active: false } });
    const r = await h.request("entitlement-key"); assert.equal(r.status, 200);
    const e = r.body.envelope;
    const signed = JSON.parse(Buffer.from(e.payload_b64, "base64url").toString("utf8"));
    assert.equal(signed.entitlement.allowed, false); assert.equal(signed.entitlement.restricted, true);
    assert.equal(signed.access.desktop_mode, "read_only"); assert.equal(h.calls.writes.length, 0);
  });
  for (const options of [{ unauthenticated: true }, { active: false }, { noMembership: true },
    { deviceStatus: "revoked" }, { deviceShop: OTHER_SHOP }, { cleanupRequired: true }]) {
    await test("verification recovery preserves genuine security denial " + JSON.stringify(options), async () => {
      const h = harness(options); const r = await h.request("entitlement-key");
      assert.equal(r.status, options.unauthenticated ? 401 : options.cleanupRequired ? 410 : 403);
      assert.equal(Object.hasOwn(r.body, "trust"), false); assert.equal(h.calls.entitlements, 0);
      assert.equal(h.calls.writes.length, 0);
    });
  }
  for (const body of [{ shop_id: "" }, { device_id: "invalid" }, { shop_id: "00000000-0000-0000-0000-000000000000" }]) {
    await test("verification recovery rejects invalid fixed identity before issuing " + JSON.stringify(body), async () => {
      const h = harness(); const r = await h.request("entitlement-key", { body });
      assert.equal(r.status, 400); assert.equal(h.calls.queries.length, 0); assert.equal(h.calls.entitlements, 0);
    });
  }
  for (const options of [{ missingSigningKey: true }, { changeSigningKey: true }]) {
    await test("verification recovery never publishes partial or mismatched issuer trust " + JSON.stringify(options), async () => {
      const h = harness(options); const r = await h.request("entitlement-key");
      assert.notEqual(r.status, 200); assert.equal(Object.hasOwn(r.body, "trust"), false);
      assert.equal(JSON.stringify(r.body).includes("PRIVATE KEY"), false); assert.equal(h.calls.writes.length, 0);
    });
  }

  console.log("Desktop access boundary regression: " + passed + " cases passed; network calls=0; real records=0; file writes=0");
}
module.exports = { main };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
