const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Exercise the real route and Bearer authentication helper. All accounts, rows,
// entitlement results and Supabase calls are synthetic and remain in memory.
// No .env files, network requests or real company records are used.
const root = path.resolve(__dirname, "..");
const shopId = "10000000-0000-4000-8000-000000000001";
const actorId = "20000000-0000-4000-8000-000000000001";
const targetId = "20000000-0000-4000-8000-000000000002";
const remoteEmployeeId = "30000000-0000-4000-8000-000000000001";
const validToken = "synthetic-valid-bearer";
const actorEmail = "owner@example.test";
const targetEmail = "employee@example.test";
const copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function makeHarness(options = {}) {
  const calls = { authChecks: 0, authLists: 0, authCreates: 0, databaseReads: 0, mutationAttempts: [], writes: [] };
  const tables = {
    rb_shops: [{ id: shopId, included_user_seats: 20, purchased_extra_user_seats: 0, subscription_plan: "basic" }],
    rb_shop_members: options.noMembership ? [] : [{ id: "synthetic-owner-membership", shop_id: shopId, user_id: actorId, role: options.actorRole ?? "owner", is_active: options.actorActive ?? true }],
    employees: [],
  };
  if (options.targetMembership) {
    tables.rb_shop_members.push({ id: "synthetic-target-membership", shop_id: shopId, user_id: targetId, role: options.targetMembership, is_active: true });
  }
  if (options.existingEmployee) {
    tables.employees.push({
      id: remoteEmployeeId, shop_id: shopId, auth_user_id: targetId,
      employee_code: "SYN-1", display_name: "Synthetic Employee", email: targetEmail,
      role: "employee", is_active: true, source_device_id: "synthetic-device", source_local_employee_id: 7,
      ...copy(options.existingEmployee),
    });
  }
  let nextId = 2;
  let failEmployeeWrites = options.failEmployeeWrites ?? 0;

  function from(table) {
    assert.ok(Object.hasOwn(tables, table), `Unexpected table: ${table}`);
    let operation = "select";
    let fields = "*";
    let rowLimit = Infinity;
    let selectOptions = {};
    let payload;
    let executed;
    const filters = [];
    const matches = (row) => filters.every((filter) => filter(row));
    function project(row) {
      if (fields === "*") return copy(row);
      return Object.fromEntries(fields.split(",").map((field) => field.trim()).map((field) => [field, copy(row[field])]));
    }
    async function execute() {
      if (executed) return executed;
      executed = Promise.resolve().then(() => {
        const rows = tables[table];
        let selected = rows.filter(matches).slice(0, rowLimit);
        if (operation === "select") {
          calls.databaseReads += 1;
          return { data: selectOptions.head ? null : selected.map(project), count: selectOptions.count ? selected.length : null, error: null };
        }
        calls.mutationAttempts.push({ table, operation, payload: copy(payload) });
        // This is the existing SQL employees_role_check, enforced on INSERT and UPDATE.
        if (table === "employees" && !["foreman", "employee"].includes(payload.role)) {
          return { data: null, error: { code: "23514", message: "new row for relation employees violates check constraint employees_role_check" } };
        }
        if (table === "employees" && failEmployeeWrites > 0) {
          failEmployeeWrites -= 1;
          return { data: null, error: { code: "synthetic_write_failure", message: "Synthetic employee write failed" } };
        }
        if (operation === "insert") {
          const row = { id: `30000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`, ...copy(payload) };
          rows.push(row);
          selected = [row];
        } else {
          for (const row of selected) Object.assign(row, copy(payload));
        }
        calls.writes.push({ table, operation, payload: copy(payload) });
        return { data: selected.map(project), error: null };
      });
      return executed;
    }
    const query = {
      select(value = "*", settings = {}) { fields = value; selectOptions = settings; return query; },
      eq(key, value) { filters.push((row) => row[key] === value); return query; },
      limit(value) { rowLimit = value; return query; },
      not(key, operator, value) {
        assert.equal(operator, "is");
        assert.equal(value, null);
        filters.push((row) => row[key] != null);
        return query;
      },
      insert(value) { operation = "insert"; payload = copy(value); return query; },
      update(value) { operation = "update"; payload = copy(value); return query; },
      async maybeSingle() {
        const result = await execute();
        if (result.error) return result;
        assert.ok(result.data.length <= 1, "Synthetic query matched duplicate rows");
        return { ...result, data: result.data[0] ?? null };
      },
      async single() {
        const result = await query.maybeSingle();
        if (!result.error && !result.data) return { data: null, error: { message: "Synthetic single query returned no row" } };
        return result;
      },
      then(resolve, reject) { return execute().then(resolve, reject); },
    };
    return query;
  }

  const users = [{ id: actorId, email: actorEmail }, { id: targetId, email: targetEmail }];
  const admin = {
    from,
    auth: { admin: {
      async listUsers({ page, perPage }) {
        calls.authLists += 1;
        return { data: { users: copy(users.slice((page - 1) * perPage, page * perPage)) }, error: null };
      },
      async createUser(input) {
        calls.authCreates += 1;
        const user = { id: "20000000-0000-4000-8000-000000000003", email: input.email };
        users.push(user);
        return { data: { user: copy(user) }, error: null };
      },
    } },
  };
  const environment = { NEXT_PUBLIC_SUPABASE_URL: "https://supabase.synthetic.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-key" };
  const cached = new Map();
  function loadActual(relative) {
    if (cached.has(relative)) return cached.get(relative);
    const filename = path.join(root, relative);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    });
    assert.equal((compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0);
    const loaded = { exports: {} };
    new Function("exports", "require", "module", "process", "fetch", compiled.outputText)(
      loaded.exports, requireSynthetic, loaded, { env: environment }, () => { throw new Error("Network access forbidden in synthetic regression"); },
    );
    cached.set(relative, loaded.exports);
    return loaded.exports;
  }
  function requireSynthetic(name) {
    if (name === "next/server") return { NextResponse: { json(body, init = {}) {
      return new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
    } } };
    if (name === "@/lib/desktopAuth") return loadActual("src/lib/desktopAuth.ts");
    if (name === "@/lib/authz") return loadActual("src/lib/authz.ts");
    if (name === "@/lib/supabase/admin") return { supabaseAdmin: () => admin };
    if (name === "@/lib/supabase/server") return { supabaseServer: () => { throw new Error("Cookie auth unexpectedly invoked"); } };
    if (name === "@/lib/billing/entitlement") return { getShopEntitlement: async (id) => {
      assert.equal(id, shopId);
      return copy(options.entitlement ?? { allowed: true, restricted: false, reason: "Synthetic allowed" });
    } };
    if (name === "@supabase/supabase-js") return { createClient(url, key, settings) {
      assert.equal(url, environment.NEXT_PUBLIC_SUPABASE_URL);
      assert.equal(key, environment.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      assert.deepEqual(settings, { auth: { persistSession: false } });
      return { auth: { async getUser(token) {
        calls.authChecks += 1;
        return token === validToken ? { data: { user: copy(users[0]) }, error: null } : { data: { user: null }, error: { message: "Not authenticated" } };
      } } };
    } };
    throw new Error(`Unexpected module: ${name}`);
  }
  const route = loadActual("src/app/api/desktop/provision-employee/route.ts");
  return {
    calls, tables, admin,
    async post(overrides = {}, token = validToken) {
      const headers = { "content-type": "application/json" };
      if (token !== null) headers.authorization = `Bearer ${token}`;
      const response = await route.POST(new Request("https://control.synthetic.invalid/api/desktop/provision-employee", {
        method: "POST", headers,
        body: JSON.stringify({
          shop_id: shopId, auth_user_id: targetId, local_employee_id: 7, source_device_id: "synthetic-device",
          employee_code: "SYN-1", display_name: "Synthetic Employee", email: targetEmail,
          role: "Employee", provision_mode: "link_existing_auth_user", ...overrides,
        }),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

async function main() {
  let passed = 0;
  async function test(label, run) {
    await run();
    console.log(`PASS ${label}`);
    passed += 1;
  }
  function assertNoWrites(harness) {
    assert.equal(harness.calls.mutationAttempts.length, 0);
    assert.equal(harness.calls.writes.length, 0);
    assert.equal(harness.calls.authCreates, 0);
    assert.equal(harness.calls.authLists, 0);
  }

  for (const token of [null, "synthetic-invalid-bearer"]) {
    await test(`${token === null ? "missing" : "invalid"} Bearer is denied before provisioning`, async () => {
      const h = makeHarness();
      const result = await h.post({}, token);
      assert.equal(result.status, 401);
      assert.equal(result.body.ok, false);
      assert.equal(h.calls.databaseReads, 0);
      assertNoWrites(h);
    });
  }
  await test("nonmember cannot provision or create auth", async () => {
    const h = makeHarness({ noMembership: true });
    assert.equal((await h.post({ auth_user_id: "", provision_mode: "create_auth_user" })).status, 403);
    assertNoWrites(h);
  });
  for (const entitlement of [
    { allowed: false, restricted: false, reason: "Synthetic expired" },
    { allowed: true, restricted: true, reason: "Synthetic restricted" },
  ]) {
    await test(`${entitlement.reason} prevents all writes and auth creation`, async () => {
      const h = makeHarness({ entitlement });
      const result = await h.post({ auth_user_id: "", provision_mode: "create_auth_user" });
      assert.equal(result.status, 402);
      assert.equal(result.body.ok, false);
      assertNoWrites(h);
    });
  }

  for (const [inputRole, sharedRole, employeeRole, membershipRole] of [
    [" Owner ", "owner", "foreman", "owner"],
    ["Admin", "admin", "foreman", "admin"],
    ["Manager", "manager", "foreman", "admin"],
    ["Foreman", "foreman", "foreman", "admin"],
    ["Employee", "employee", "employee", "member"],
    ["Viewer", "viewer", "employee", "member"],
    ["Operator", "employee", "employee", "member"],
    ["unknown-role", "employee", "employee", "member"],
  ]) {
    for (const existing of [false, true]) {
      await test(`${existing ? "update" : "insert"} ${inputRole.trim()} respects SQL role constraint and shared role response`, async () => {
        const h = makeHarness({ existingEmployee: existing ? {} : undefined });
        const result = await h.post({ role: inputRole });
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.ok, true);
        assert.equal(result.body.role, sharedRole, "Desktop HR role must not be replaced by the narrower employee storage role");
        assert.equal(result.body.employee_role, employeeRole);
        assert.equal(h.tables.employees.length, 1);
        assert.equal(h.tables.employees[0].role, employeeRole);
        assert.equal(h.tables.employees[0].auth_user_id, targetId);
        assert.equal(h.tables.rb_shop_members.find((row) => row.user_id === targetId).role, membershipRole);
        assert.equal(h.calls.writes.filter((call) => call.table === "employees")[0].operation, existing ? "update" : "insert");
        if (existing) assert.equal(result.body.remote_employee_id, remoteEmployeeId);
        assert.equal(h.calls.authCreates, 0);
      });
    }
  }

  await test("owner provisioning self retains existing owner membership and HR Owner", async () => {
    const h = makeHarness();
    const result = await h.post({ auth_user_id: actorId, email: actorEmail, role: "Owner" });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.role, "owner");
    assert.equal(result.body.employee_role, "foreman");
    assert.equal(h.tables.rb_shop_members.length, 1);
    assert.equal(h.tables.rb_shop_members[0].role, "owner");
    assert.equal(h.calls.mutationAttempts.filter((call) => call.table === "rb_shop_members").length, 0);
  });
  await test("existing target owner is not demoted by narrower employee role", async () => {
    const h = makeHarness({ targetMembership: "owner" });
    const result = await h.post({ role: "Employee" });
    assert.equal(result.status, 200);
    assert.equal(h.tables.rb_shop_members.find((row) => row.user_id === targetId).role, "owner");
    assert.equal(h.calls.mutationAttempts.filter((call) => call.table === "rb_shop_members").length, 0);
  });
  await test("new requested Owner retains newer owner membership mapping", async () => {
    const h = makeHarness();
    assert.equal((await h.post({ role: "Owner" })).status, 200);
    assert.equal(h.tables.rb_shop_members.find((row) => row.user_id === targetId).role, "owner");
    assert.equal(h.tables.rb_shop_members.filter((row) => row.role === "owner").length, 2);
  });
  await test("employee-only mode stores valid role without changing membership or auth", async () => {
    const h = makeHarness();
    const result = await h.post({ role: "Owner", auth_user_id: "", provision_mode: "create_employee_only" });
    assert.equal(result.status, 200);
    assert.equal(result.body.role, "owner");
    assert.equal(result.body.employee_role, "foreman");
    assert.equal(h.tables.employees[0].auth_user_id, null);
    assert.equal(h.calls.writes.filter((call) => call.table === "rb_shop_members").length, 0);
    assert.equal(h.calls.authCreates, 0);
    assert.equal(h.calls.authLists, 0);
  });
  await test("retry after partial member write reuses auth and creates one employee", async () => {
    const h = makeHarness({ failEmployeeWrites: 1 });
    const input = { role: "Owner", auth_user_id: "", provision_mode: "create_auth_user", temporary_password: "Synthetic-Not-A-Real-Password" };
    const first = await h.post(input);
    assert.equal(first.status, 500);
    assert.equal(first.body.ok, false);
    assert.equal(h.tables.employees.length, 0);
    assert.equal(h.tables.rb_shop_members.filter((row) => row.user_id === targetId).length, 1);
    assert.equal(h.tables.rb_shop_members.find((row) => row.user_id === targetId).role, "owner");
    const second = await h.post(input);
    assert.equal(second.status, 200, JSON.stringify(second.body));
    const third = await h.post(input);
    assert.equal(third.status, 200, JSON.stringify(third.body));
    assert.equal(second.body.remote_employee_id, third.body.remote_employee_id);
    assert.equal(third.body.role, "owner");
    assert.equal(third.body.employee_role, "foreman");
    assert.equal(h.tables.employees.length, 1);
    assert.equal(h.tables.rb_shop_members.filter((row) => row.user_id === targetId).length, 1);
    assert.equal(h.tables.rb_shop_members.find((row) => row.user_id === actorId).role, "owner");
    assert.equal(h.calls.authCreates, 0, "An existing login must be reused on every retry");
    assert.equal(h.calls.authLists, 3);
    assert.equal(h.calls.writes.filter((call) => call.table === "employees" && call.operation === "insert").length, 1);
    assert.equal(h.calls.writes.filter((call) => call.table === "employees" && call.operation === "update").length, 1);
  });
  await test("synthetic SQL constraint independently rejects owner for inserts and updates", async () => {
    const h = makeHarness({ existingEmployee: {} });
    for (const operation of ["insert", "update"]) {
      const query = h.admin.from("employees")[operation]({ role: "owner" });
      if (operation === "update") query.eq("id", remoteEmployeeId);
      const result = await query.select("id,role").single();
      assert.equal(result.error.code, "23514");
    }
    assert.equal(h.calls.writes.length, 0);
    assert.equal(h.tables.employees.length, 1);
    assert.equal(h.tables.employees[0].role, "employee");
  });
  for (const [label, options] of [["member role", { actorRole: "member" }], ["inactive owner", { actorActive: false }]]) {
    await test(`newer authorization denies ${label} before any writes`, async () => {
      const h = makeHarness(options);
      assert.equal((await h.post()).status, 403);
      assertNoWrites(h);
    });
  }
  await test("newer duplicate identity guard rejects conflicting rows before writes", async () => {
    const h = makeHarness({ existingEmployee: {} });
    h.tables.employees.push({ ...copy(h.tables.employees[0]), id: "30000000-0000-4000-8000-000000000099", auth_user_id: null, employee_code: "SYN-OTHER", source_device_id: "synthetic-other", source_local_employee_id: 99 });
    const result = await h.post();
    assert.equal(result.status, 500);
    assert.match(result.body.error, /Employee identity conflict/);
    assertNoWrites(h);
  });
  console.log(`Desktop employee role regression: ${passed} cases passed; real network calls=0; real records=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
