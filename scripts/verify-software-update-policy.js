const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const errors = (result.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, "Source transpilation failed");
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = (name) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : originalRequire(name);
  compiled._compile(result.outputText, filename);
  return compiled.exports;
}

const policy = load("src/lib/control/softwareUpdatePolicy.ts");
const deviceId = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";
const hash = "a".repeat(64);
const release = (id, version, extra = {}) => ({
  id, app_name: "desktop", version, channel: "stable", status: "active", required: true,
  release_notes: "Synthetic regression release", minimum_supported_version: null, rollback_version: null, ...extra,
});
const pkg = (id, releaseId, extra = {}) => ({
  id, release_id: releaseId, file_name: "Synthetic.zip", download_url: "https://updates.example.test/Synthetic.zip",
  storage_path: null, sha256: hash, size_bytes: 1234, platform: "windows", architecture: "x64", ...extra,
});
const rollout = (id, releaseId, extra = {}) => ({
  id, release_id: releaseId, target_type: "all", target_shop_id: null, target_device_id: null,
  channel: "stable", required: false, status: "active", starts_at: null, ...extra,
});

function database(seed = {}, errors = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const filters = [];
      let operation = "select", payload;
      const query = {
        select(columns) { calls.push({ table, operation: "select", columns }); return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        in(key, values) { filters.push([key, values]); return query; },
        order() { return query; },
        limit() { return query; },
        update(value) { operation = "update"; payload = value; return query; },
        upsert(value) { operation = "upsert"; payload = value; return query; },
        insert(value) { operation = "insert"; payload = value; return query; },
        maybeSingle() { return Promise.resolve(finish(true)); },
        then(resolve, reject) { return Promise.resolve(finish(false)).then(resolve, reject); },
      };
      function finish(single) {
        calls.push({ table, operation, payload, filters });
        let rows = seed[table] ?? [];
        if (operation === "select") {
          rows = rows.filter((row) => filters.every(([key, value]) =>
            Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
        }
        return { data: single ? rows[0] ?? null : rows, error: errors[table] ?? null };
      }
      return query;
    },
  };
}

function routeFor(db) {
  return load("src/app/api/software-updates/check/route.ts", {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "@/lib/supabase/admin": { supabaseAdmin: () => db },
    "@/lib/security/rateLimit": { rateLimitOrThrow() {} },
    "@/lib/device/tokens": { hashToken: () => "synthetic-token-hash" },
    "@/lib/control/softwareUpdatePolicy": policy,
  });
}
const authenticatedSeed = {
  rb_device_tokens: [{ id: "token-1", token_hash: "synthetic-token-hash", device_id: deviceId, revoked_at: null }],
  rb_devices: [{ id: deviceId, shop_id: shopId, name: "Synthetic device", status: "active" }],
};
const request = (extra = {}) => new Request("https://control.example.test/api/software-updates/check", {
  method: "POST", headers: { authorization: "Bearer synthetic-token", "content-type": "application/json" },
  body: JSON.stringify({ deviceId, shopId, channel: "stable", desktopVersion: "1.0.0", ...extra }),
});

async function main() {
  const chain = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta",
    "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0", "1.0.0.1", "1.0.1", "1.10.0"];
  for (let index = 1; index < chain.length; index++) {
    assert.equal(policy.compareSoftwareVersions(chain[index], chain[index - 1]), 1);
    assert.equal(policy.compareSoftwareVersions(chain[index - 1], chain[index]), -1);
  }
  assert.equal(policy.compareSoftwareVersions("1.0.0+sha123", "1.0.0.0+other"), 0);
  for (const invalid of ["", "unknown", "v1.0.0", "01.0.0", "1.0.0-alpha.01", "1.0.0+", "1.0", "1.0.0.0.1"]) {
    assert.equal(policy.parseSoftwareVersion(invalid), null, invalid);
    assert.equal(policy.compareSoftwareVersions("2.0.0", invalid), null, invalid);
  }
  assert.equal(policy.validSoftwareTarget("windows", "x64"), true);
  assert.equal(policy.validSoftwareTarget("ios", "arm64"), true);
  assert.equal(policy.validSoftwareTarget("ios", "x64"), false);
  assert.equal(policy.validSoftwareTarget("linux", "x64"), false);
  const matchArgs = { deviceId, shopId, channel: "stable", now: Date.parse("2026-10-23T12:00:00Z") };
  assert.equal(policy.softwareRolloutMatches(rollout("r", "a", { starts_at: "invalid" }), matchArgs), false);
  assert.equal(policy.softwareRolloutMatches(rollout("r", "a", { starts_at: "2027-01-01T00:00:00Z" }), matchArgs), false);
  assert.equal(policy.softwareRolloutMatches(rollout("r", "a"), matchArgs), true);
  assert.equal(policy.releaseActivationError(release("a", "1.0.0"), [pkg("p", "a")]), "");
  for (const altered of [{ sha256: "bad" }, { size_bytes: 0 }, { platform: "ios", architecture: "arm64" },
    { download_url: null, storage_path: null }, { architecture: "x86" }]) {
    assert.notEqual(policy.releaseActivationError(release("a", "1.0.0"), [pkg("p", "a", altered)]), "");
  }
  assert.notEqual(policy.releaseActivationError(release("a", "invalid"), [pkg("p", "a")]), "");
  assert.notEqual(policy.releaseActivationError(release("a", "1.0.0", { release_notes: "" }), [pkg("p", "a")]), "");
  assert.notEqual(policy.releaseActivationError(release("a", "1.0.0", { minimum_supported_version: "2.0.0" }), [pkg("p", "a")]), "");

  const releases = [release("older", "0.9.0"), release("equal", "1.0.0"), release("new", "1.2.0"),
    release("latest", "1.10.0"), release("invalid", "unrecognized")];
  const packages = releases.flatMap((row) => [
    pkg("wrong-" + row.id, row.id, { architecture: "arm64" }), pkg("right-" + row.id, row.id),
  ]);
  const rollouts = releases.map((row) => rollout("rollout-" + row.id, row.id));
  const seed = { ...authenticatedSeed, rb_software_releases: releases, rb_software_packages: packages, rb_software_rollouts: rollouts };
  const db = database(seed), route = routeFor(db);
  const result = await route.POST(request());
  assert.equal(result.status, 200);
  assert.equal(result.body.updates.length, 1, "One highest eligible release per app");
  assert.equal(result.body.updates[0].version, "1.10.0");
  assert.equal(result.body.updates[0].package.packageId, "right-latest", "Wrong architecture must not win by row order");

  // Invalid labels must be removed before sorting; mixing id fallback ordering
  // with numeric ordering makes the comparator nontransitive.
  const interleaved = [
    release("z-high", "1.10.0"), release("a-invalid", "invalid"),
    release("m-low", "1.2.0"), release("z-invalid", "v9.0.0"),
    release("a-medium", "1.9.0"), release("m-invalid", "unknown"),
  ];
  const arrangements = [
    interleaved,
    interleaved.slice().reverse(),
    [interleaved[2], interleaved[1], interleaved[4], interleaved[5], interleaved[0], interleaved[3]],
    [interleaved[3], interleaved[4], interleaved[0], interleaved[1], interleaved[2], interleaved[5]],
  ];
  for (const arrangement of arrangements) {
    const shuffled = database({
      ...authenticatedSeed,
      rb_software_releases: arrangement,
      rb_software_packages: arrangement.map((row) => pkg("p-" + row.id, row.id)),
      rb_software_rollouts: arrangement.map((row) => rollout("r-" + row.id, row.id)),
    });
    const selected = await routeFor(shuffled).POST(request());
    assert.equal(selected.status, 200);
    assert.equal(selected.body.updates.length, 1);
    assert.equal(selected.body.updates[0].releaseId, "z-high", "Invalid interleaved rows disrupted highest-version selection");
  }

  const current = await route.POST(request({ desktopVersion: "2.0.0" }));
  assert.equal(current.body.updates.length, 0, "Downgrade was offered");
  const equal = await route.POST(request({ desktopVersion: "1.10.0.0+build" }));
  assert.equal(equal.body.updates.length, 0, "Equivalent .NET version was offered");
  const unknownDb = database(seed);
  const unknown = await routeFor(unknownDb).POST(request({ desktopVersion: "unrecognized" }));
  assert.equal(unknown.body.updates.length, 0, "Unknown installed version received a forced candidate");
  assert.equal(unknown.body.versionStateUnknown, true);
  assert.equal(unknownDb.calls.find((call) => call.operation === "upsert").payload.update_status, "unknown");
  const badTargetDb = database(seed);
  assert.equal((await routeFor(badTargetDb).POST(request({ platform: "ios", architecture: "x64" }))).status, 400);
  assert.equal(badTargetDb.calls.length, 0, "Invalid target reached database");
  const delayed = database({ ...seed, rb_software_rollouts: rollouts.map((row) =>
    row.release_id === "latest" ? { ...row, starts_at: "invalid" } : row) });
  const fallback = await routeFor(delayed).POST(request());
  assert.equal(fallback.body.updates[0].version, "1.2.0", "Invalid rollout date must not beat an eligible release");
  const wrongPackage = database({ ...seed, rb_software_packages: packages.filter((row) => row.id !== "right-latest") });
  assert.equal((await routeFor(wrongPackage).POST(request())).body.updates[0].version, "1.2.0");

  function viewsFor(admin) {
    return load("src/lib/control/softwareUpdatesViews.ts", {
      "@/lib/supabase/admin": { supabaseAdmin: admin },
      "@/lib/ui/dates": { formatDateTime: (value) => value },
      "@/lib/control/softwareUpdatePolicy": policy,
    });
  }
  const unavailable = await viewsFor(() => { throw new Error("Synthetic unavailable DB"); }).loadSoftwareUpdatesWorkspaceData();
  assert.equal(unavailable.sourceKind, "unavailable");
  for (const key of ["overviewStats", "releaseRows", "deviceRows", "rolloutRows", "shopOptions", "deviceOptions"]) {
    assert.deepEqual(unavailable[key], [], key + " must never contain a fictional fallback");
  }
  assert.equal(unavailable.releaseCrudEnabled, false);
  const failed = await viewsFor(() => database({}, { rb_software_releases: { message: "Synthetic query failure" } })).loadSoftwareUpdatesWorkspaceData();
  assert.equal(failed.sourceKind, "unavailable");
  assert.deepEqual(failed.deviceRows, []);
  const empty = await viewsFor(() => database()).loadSoftwareUpdatesWorkspaceData();
  assert.equal(empty.sourceKind, "live");
  assert.equal(empty.schemaAvailable, true);
  assert.deepEqual(empty.releaseRows, []);
  const newest = await viewsFor(() => database({ rb_software_releases: [release("old", "1.2.0"), release("latest", "1.10.0")] })).loadSoftwareUpdatesWorkspaceData();
  assert.equal(newest.overviewStats.find((row) => row.label === "Latest Desktop Version").value, "1.10.0");
  const targetFailure = await viewsFor(() => database({ rb_device_software_status: [{ device_id: deviceId, shop_id: shopId }] },
    { rb_shops: { message: "Synthetic target query failure" } })).loadSoftwareUpdatesWorkspaceData();
  assert.equal(targetFailure.sourceKind, "unavailable");
  assert.deepEqual(targetFailure.deviceRows, []);

  class Redirect extends Error { constructor(url) { super(url); this.url = url; } }
  function actionsFor(admin) {
    return load("src/app/(authed)/software-updates/actions.ts", {
      "next/headers": { headers: async () => new Headers() },
      "next/navigation": { redirect: (url) => { throw new Redirect(url); } },
      "next/cache": { revalidatePath() {} },
      "@/lib/control/companyScope": { COMPANY_HEADER: "x-runbook-company" },
      "@/lib/control/summary": { getViewerContext: async () => ({ selectedCompanyId: null }) },
      "@/lib/authz": { requirePlatformAdminAal2: async () => ({ user: { id: "synthetic-admin" } }) },
      "@/lib/supabase/admin": { supabaseAdmin: () => admin },
      "@/lib/control/softwareUpdatePolicy": policy,
    });
  }
  async function redirected(action) {
    try { await action(); }
    catch (error) { if (error instanceof Redirect) return error.url; throw error; }
    throw new Error("Server action did not redirect");
  }
  const form = new FormData(); form.set("release_id", "a");
  const invalidActivationDb = database({ rb_software_releases: [release("a", "1.0.0")] });
  const blockedUrl = await redirected(() => actionsFor(invalidActivationDb).activateSoftwareReleaseAction(form));
  assert.ok(new URL(blockedUrl, "https://control.example.test").searchParams.get("error"));
  assert.equal(invalidActivationDb.calls.some((call) => call.operation === "update"), false, "Activation bypassed package readiness");
  const validActivationDb = database({ rb_software_releases: [release("a", "1.0.0")], rb_software_packages: [pkg("p", "a")] });
  const successUrl = await redirected(() => actionsFor(validActivationDb).activateSoftwareReleaseAction(form));
  assert.equal(new URL(successUrl, "https://control.example.test").searchParams.get("flash"), "Release activated.");
  assert.equal(validActivationDb.calls.filter((call) => call.operation === "update").length, 1);
  const saveForm = new FormData();
  for (const [key, value] of Object.entries({ release_id: "a", app_name: "desktop", version: "1.0.0",
    channel: "stable", status: "active", release_intent: "optional", release_notes: "Synthetic notes" })) saveForm.set(key, value);
  const activeSaveDb = database({ rb_software_releases: [release("a", "1.0.0")] });
  const saveUrl = await redirected(() => actionsFor(activeSaveDb).saveSoftwareReleaseAction(saveForm));
  assert.ok(new URL(saveUrl, "https://control.example.test").searchParams.get("error"));
  assert.equal(activeSaveDb.calls.some((call) => call.operation === "update" || call.operation === "insert"), false,
    "Saving active metadata bypassed the activation guard");
  console.log("PASS software update version, package, rollout, activation and unavailable-workspace regressions");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
