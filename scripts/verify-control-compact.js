/* Local-only actual-component fixtures. No deployable routes, providers or real data. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
const evidence = path.resolve(process.env.CONTROL_UI_EVIDENCE || path.join(root, ".local-evidence", "control-compact"));
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const playwrightPath = process.env.CONTROL_PLAYWRIGHT_CORE || "C:\\RunBook-DeployPrep\\20261016-control\\browser-tools\\node_modules\\playwright-core";
const viewports = [[1366, 768], [1440, 900], [1920, 1080], [390, 844]];
const states = ["populated", "empty", "largecounts", "longlabels", "restricted", "queryerror"];
const destinations = ["/dashboard", "/shops", "/devices", "/workstations", "/people", "/mobile-access", "/timeclock-review", "/billing-access", "/support", "/software-updates", "/updates", "/audit", "/settings"];
const shopTabs = ["overview", "billing", "members", "devices", "workstations", "mobile", "audit", "support", "settings"];

function fixtureNote() {
  return React.createElement("div", { role: "note", "aria-label": "Fixture preview", style: { padding: "6px 10px", border: "1px solid #C9D8F7", borderRadius: 5, color: "#36569C", background: "#F8FAFF", fontSize: 12 } }, "LOCAL COMPONENT PREVIEW | SYNTHETIC DATA | NOT LIVE / AUTHENTICATED");
}

function screenHtml(load, content, long = false) {
  const Shell = load(path.join(root, "src/components/control/ControlAppShell.tsx")).default;
  const RootLayout = load(path.join(root, "src/app/layout.tsx")).default;
  return "<!doctype html>" + renderToStaticMarkup(React.createElement(RootLayout, null, React.createElement(Shell, {
    email: long ? `${"long-account".repeat(12)}@example.invalid` : "reviewer@example.invalid", roleLabel: "Platform admin",
    statuses: [{ key: "auth", label: "Fixture identity", tone: "info" }, { key: "data", label: "Synthetic records", tone: "info" }],
  }, fixtureNote(), content)));
}

function navigationMocks(pathname, search = "") {
  return {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": {
      usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search),
      useRouter: () => ({ replace: () => { throw new Error("Fixture must not navigate through a real client router"); }, refresh: () => {} }),
      redirect: (destination) => { throw new Error(`Unexpected fixture redirect: ${destination}`); },
    },
  };
}

function fixture(state) {
  const long = state === "longlabels";
  const large = state === "largecounts";
  const empty = state === "empty";
  const restricted = state === "restricted";
  const stamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const snapshots = Array.from({ length: empty ? 0 : 8 }, (_, i) => ({
    id: `synthetic-shop-${i}`, name: long ? `Synthetic shop ${i} with a deliberately long name ${"UnbrokenLabel".repeat(10)}` : `Synthetic shop ${i + 1}`,
    member_role: "platform_admin", billing_status: "synthetic", trial_ends_at: null, billing_current_period_end: null, grace_ends_at: null,
    access: { state: restricted || i === 7 ? "restricted" : "active", workstation_mode: restricted || i === 7 ? "blocked" : "full", summary: long ? "Full synthetic restriction detail ".repeat(15) : "Synthetic access requires review.", reason: long ? "SyntheticPolicySource".repeat(15) : "Synthetic billing policy" },
    counts: { employees_total: 12, employees_active: 10, employees_mobile_ready: large ? 1234567 : 6, employees_workstation_ready: 5, devices_total: 6, devices_active: large ? 1234567 : 4, desktops_total: 2, desktops_active: 1, workstations_total: 2, workstations_active: large ? 1234567 : 2 },
    health: { offline_devices: large ? 1234567 : i % 2 === 0 ? 1 : 0, stale_devices: 1, last_device_activity_at: stamp, recent_audit_events: 1 },
  }));
  const shopId = snapshots[0]?.id ?? "synthetic-out-of-scope";
  const records = (count, factory) => Array.from({ length: count }, (_, i) => ({ shop_id: shopId, created_at: stamp, ...factory(i) }));
  const data = {
    time_events: empty ? [] : records(large ? 1000 : 4, (i) => ({ shop_id: snapshots[i % snapshots.length].id })),
    rb_audit_log: empty ? [] : records(large ? 200 : 8, (i) => ({ id: `event-${i}`, action: long ? `Synthetic administrative event ${"LongAction".repeat(14)}` : `Synthetic event ${i + 1}`, actor_email: long ? `${"long-user".repeat(14)}@example.invalid` : "reviewer@example.invalid" })),
    rb_support_bundles: empty ? [] : records(large ? 50 : 2, () => ({ file_path: long ? `synthetic/${"LongBundleName".repeat(16)}.zip` : "synthetic/support.zip" })),
    rb_update_packages: empty ? [] : records(large ? 50 : 2, () => ({ version: long ? "synthetic-version-".repeat(16) : "synthetic-1.4.0" })),
  };
  const calls = [];
  function from(table) {
    const call = { table, operations: [] };
    calls.push(call);
    let ids;
    let cap = Infinity;
    const query = {};
    for (const method of ["select", "eq", "in", "order", "limit", "gte"]) query[method] = (...args) => {
      call.operations.push([method, ...args]);
      if (method === "in") ids = args[1];
      if (method === "limit") cap = args[0];
      return query;
    };
    query.then = (resolve, reject) => {
      const rows = (data[table] ?? []).filter((row) => !ids || ids.includes(row.shop_id)).slice(0, cap);
      return Promise.resolve({ data: state === "queryerror" ? null : rows, error: state === "queryerror" ? { message: "Synthetic unavailable" } : null }).then(resolve, reject);
    };
    return query;
  }
  return { snapshots, calls, from, long };
}

function componentLoader(mocks) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename, "utf8");
    const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    cache.set(filename, loaded);
    loaded.require = (request) => {
      if (Object.hasOwn(mocks, request)) return mocks[request];
      if (request.startsWith("@/") || request.startsWith(".")) {
        const base = request.startsWith("@/") ? path.join(root, "src", request.slice(2)) : path.resolve(path.dirname(filename), request);
        const resolved = [base, `${base}.tsx`, `${base}.ts`].find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
        if (resolved && /\.tsx?$/.test(resolved)) return load(resolved);
      }
      return require(request);
    };
    loaded._compile(compiled, filename);
    return loaded.exports;
  }
  return load;
}

async function render(state) {
  const data = fixture(state);
  const load = componentLoader({
    ...navigationMocks("/dashboard"),
    "@/lib/control/summary": {
      getViewerContext: async () => ({ userId: "synthetic-user", email: "reviewer@example.invalid", isPlatformAdmin: true, shops: data.snapshots }),
      getShopSnapshot: async (shop) => shop,
      getPlatformSnapshot: async () => ({ manageableShopCount: data.snapshots.length }),
    },
    "@/lib/supabase/admin": { supabaseAdmin: () => ({ from: data.from }) },
  });
  const DashboardPage = load(path.join(root, "src/app/(authed)/dashboard/page.tsx")).default;
  const page = await DashboardPage();
  assert.equal(data.calls.length, state === "empty" ? 1 : 5, "No additional dashboard requests");
  const html = screenHtml(load, page, data.long);
  // Assert the actual server page preserves query boundaries, caps and error fallbacks.
  for (const call of data.calls) {
    assert(["time_events", "rb_audit_log", "rb_support_bundles", "rb_update_packages"].includes(call.table));
    const cap = call.operations.find(([op]) => op === "limit")?.[1];
    assert.equal(cap, call.table === "time_events" ? 1000 : call.table === "rb_audit_log" ? (call.operations.find(([op]) => op === "select")[1].includes("actor_email") ? 8 : 200) : 50);
    if (call.table !== "rb_update_packages") assert.deepEqual(call.operations.find(([op]) => op === "in")?.[2], data.snapshots.map((s) => s.id));
  }
  const model = load(path.join(root, "src/components/control/dashboard/ControlDashboard.tsx"));
  const ordered = model.orderAlerts(["Low", "High", "Critical", "Medium", "High"].map((priority, i) => ({ priority, key: String(i) })));
  assert.deepEqual(ordered.map((row) => row.key), ["2", "1", "4", "3", "0"]);
  assert.equal(model.limitedCount(50, 50), "50+");
  assert.equal(model.limitedCount(49, 50), "49");
  return { html, calls: data.calls };
}

function deviceFixture() {
  const stamp = "2026-10-22T20:00:00.000Z";
  return [
    ["synthetic-device-a", "Synthetic office computer", "desktop", "active", "synthetic-shop-0", "Full"],
    ["synthetic-device-b", "Synthetic bay workstation", "workstation", "active", "synthetic-shop-0", "Read only"],
    ["synthetic-device-c", "Synthetic disabled computer", "desktop", "disabled", "synthetic-shop-1", "Blocked"],
    ["synthetic-device-d", "Synthetic second workstation", "workstation", "active", "synthetic-shop-1", "Full"],
  ].map(([id, name, device_type, status, shop_id, access_mode], i) => ({
    id, name, device_type, status, shop_id, shop_name: shop_id === "synthetic-shop-0" ? "Synthetic review shop" : "Synthetic second shop",
    created_at: stamp, last_seen_at: i === 2 ? null : stamp, merged_last_seen_at: i === 2 ? null : stamp,
    reported_version: i === 2 ? null : "synthetic-1.4.0", active_token_count: i === 2 ? 0 : 1,
    access_mode, access_reason: "Synthetic access result for layout review.",
    capability: i === 1 ? { requirements_status: "warning" } : { requirements_status: "pass" },
    capability_warning: i === 1 ? "Synthetic capability warning" : null,
    update_status: i === 1 ? "required" : "current", update_label: i === 1 ? "Update required" : "Current",
    update_policy: { channel: "stable", min_version: "synthetic-1.4.0", pinned_version: null },
  }));
}

async function renderDevices(url) {
  const mode = url.searchParams.get("fixture") || "populated";
  const load = componentLoader({
    ...navigationMocks("/devices", url.search),
    "@/lib/control/deviceViews": {
      loadDeviceViewRows: async () => ({ context: { isPlatformAdmin: mode !== "nonadmin" }, rows: mode === "empty" ? [] : deviceFixture() }),
    },
  });
  const Page = load(path.join(root, "src/app/(authed)/devices/page.tsx")).default;
  return screenHtml(load, await Page({ searchParams: Promise.resolve(Object.fromEntries(url.searchParams)) }));
}

async function renderShop() {
  const data = fixture("populated");
  const shop = { ...data.snapshots[0], name: "Synthetic review shop", created_at: "2026-10-01T12:00:00Z", billing_status: "active" };
  shop.access = { ...shop.access, desktop_mode: "full", mobile_mode: "full", display_status: "Active", billing_status: "active", summary: "Synthetic entitlement outcome for visual review." };
  const calls = [];
  const tables = {
    rb_devices: deviceFixture().filter((row) => row.shop_id === shop.id),
    rb_device_tokens: [], employees: [], rb_shop_members: [], rb_profiles: [], rb_trusted_devices: [], time_events: [],
    rb_audit_log: [{ id: "synthetic-audit-1", shop_id: shop.id, action: "Synthetic admin review", actor_email: "reviewer@example.invalid", created_at: "2026-10-22T20:00:00Z" }],
    rb_support_bundles: [], rb_shops: [shop], rb_control_admins: [{ user_id: "synthetic-user" }],
  };
  function from(table) {
    assert(Object.hasOwn(tables, table), `Unexpected fixture table: ${table}`);
    const call = { table, operations: [] };
    calls.push(call);
    let rows = tables[table];
    let single = false;
    const query = {};
    for (const method of ["select", "eq", "in", "order", "limit", "maybeSingle"]) query[method] = (...args) => {
      call.operations.push([method, ...args]);
      if (method === "eq") rows = rows.filter((row) => row[args[0]] === args[1]);
      if (method === "in") rows = rows.filter((row) => args[1].includes(row[args[0]]));
      if (method === "limit") rows = rows.slice(0, args[0]);
      if (method === "maybeSingle") single = true;
      return query;
    };
    query.then = (resolve, reject) => Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
    return query;
  }
  const load = componentLoader({
    ...navigationMocks(`/shops/${shop.id}`, "tab=overview"),
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@/lib/control/summary": {
      getViewerContext: async () => ({ userId: "synthetic-user", email: "reviewer@example.invalid", isPlatformAdmin: true, shops: [shop] }),
      getShopSnapshot: async () => shop, selectPrimaryShop: (shops, id) => shops.find((item) => item.id === id) ?? null,
    },
    "@/lib/control/readinessViews": { loadShopReadinessReports: async () => ({ rows: [], summary: { totalReports: 0, readyCount: 0, needsAttentionCount: 0, notReadyCount: 0, averageScore: null, latestReportedAt: null } }) },
    "@/lib/supabase/admin": { supabaseAdmin: () => ({ from }) },
    "@/lib/supabase/server": { supabaseServer: async () => ({ from, auth: { getUser: async () => ({ data: { user: { id: "synthetic-user", email: "reviewer@example.invalid" } } }), mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal2" } }) } } }) },
    "@/lib/supabase/client": { supabaseBrowser: () => { throw new Error("Fixture must never create a provider client"); } },
    "@/lib/rb": { rbGetShop: async () => shop },
  });
  const Page = load(path.join(root, "src/app/(authed)/shops/[shopId]/page.tsx")).default;
  const Layout = load(path.join(root, "src/app/(authed)/shops/[shopId]/layout.tsx")).default;
  const params = Promise.resolve({ shopId: shop.id });
  const page = await Page({ params, searchParams: Promise.resolve({ tab: "overview" }) });
  return { html: screenHtml(load, await Layout({ params, children: page })), calls };
}

function renderNavigationState(active) {
  assert(destinations.includes(active), "Only existing navigation destinations can be mocked");
  const load = componentLoader(navigationMocks(active));
  const Panel = load(path.join(root, "src/components/control/ControlPanel.tsx")).default;
  return screenHtml(load, React.createElement(Panel, { title: "Synthetic navigation state" }, React.createElement("p", null, `Selected route: ${active}. Navigation-only fixture; no business page or live data.`)));
}

async function main() {
  fs.mkdirSync(evidence, { recursive: true });
  const browserTemp = path.join(evidence, "browser-temp");
  fs.mkdirSync(browserTemp, { recursive: true });
  process.env.TEMP = browserTemp;
  process.env.TMP = browserTemp;
  const rendered = Object.fromEntries(await Promise.all(states.map(async (state) => [state, await render(state)])));
  const shop = await renderShop();
  const serverErrors = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const state = url.searchParams.get("state") || "populated";
    try {
      if (url.pathname === "/favicon.ico") { response.writeHead(204); response.end(); return; }
      const fixtureAssets = new Map([
        ["/artwork/control-sample2/runbook-logo.png", "image/png"],
        ["/artwork/runbook-refined-b/message-header.png", "image/png"],
        ["/artwork/runbook-refined-b/shops.png", "image/png"],
        ...["dashboard", "people", "timeclock", "settings", "devices", "support", "workstations", "mobile-access", "billing-plans", "software-updates", "updates", "audit"].map((name) => [`/artwork/runbook-refined-b/${name}.svg`, "image/svg+xml"]),
      ]);
      if (fixtureAssets.has(url.pathname)) {
        response.writeHead(200, { "Content-Type": fixtureAssets.get(url.pathname) });
        response.end(fs.readFileSync(path.join(root, "public", url.pathname)));
        return;
      }
      let html;
      if (url.pathname === "/fixture/navigation") {
        const active = url.searchParams.get("active");
        if (!destinations.includes(active)) { response.writeHead(404); response.end("Unknown synthetic navigation state"); return; }
        html = renderNavigationState(active);
      }
      else
      if ((url.pathname === "/" || url.pathname === "/dashboard") && Object.hasOwn(rendered, state)) html = rendered[state].html;
      else if (url.pathname === "/devices") html = await renderDevices(url);
      else if (url.pathname === "/shops/synthetic-shop-0" && (url.searchParams.get("tab") || "overview") === "overview") html = shop.html;
      else { response.writeHead(404); response.end("Local fixture only"); return; }
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'none'; font-src 'none'; form-action 'self'" });
      response.end(html);
    } catch (error) {
      serverErrors.push(error.stack || error.message);
      response.writeHead(500); response.end("Fixture render failed; see validation output.");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require(playwrightPath);
  let browser;
  let zoomContext;
  const results = [];
  const blocked = [];
  const browserErrors = [];
  function watch(page) {
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    page.on("response", (response) => { if (response.status() >= 400) browserErrors.push(`${response.status()}: ${response.url()}`); });
  }
  try {
    browser = await chromium.launch({ executablePath: edgePath, headless: true });
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      blocked.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    watch(page);
    for (const state of states) for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/?state=${state}`);
      const stats = await measure(page);
      assert.equal(stats.width, width, `${state}: horizontal page overflow at ${width}`);
      // Readable reference-sized typography may scroll vertically in shorter windows.
      // Keep the full-height desktop check at 1080px; never clip content to force a fit.
      if (["populated", "empty", "restricted", "queryerror"].includes(state) && width >= 1200 && height >= 1080) {
        assert.equal(stats.height, height, `${state}: desktop overview scroll at ${width}x${height}`);
      }
      await checkImages(page);
      assert.equal(await page.getByRole("note", { name: "Fixture preview" }).count(), 1);
      assert.deepEqual(await page.locator("nav a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), destinations);
      assert.equal(await page.locator("[aria-current=page]").count(), 1);
      assert.equal(await page.locator(".dashboard-metrics > a").count(), 4);
      assert.equal(await page.locator(".dashboard-summary > a").count(), 5);
      assert.equal(await page.locator(".dashboard-health").count(), 5);
      assert(await page.locator(".dashboard-activity > div").count() <= 3);
      if (state === "largecounts") {
        assert.match(await page.locator(".dashboard-metrics").innerText(), /1000\+/);
        assert.match(await page.locator(".dashboard-summary").innerText(), /200\+/);
        assert.equal((await page.locator(".dashboard-shortcuts").innerText()).match(/50\+/g).length, 2);
      }
      if (state === "queryerror") assert.match(await page.locator(".control-dashboard").innerText(), /No recent audit activity/);
      const file = `${state}-${width}x${height}.png`;
      const screenshots = await capture(page, file, stats);
      const reached = await checkNavigationKeyboard(page, height);
      results.push({ state, viewport: { width, height }, fitsViewport: stats.height === height, ...stats, navKeyboard: reached, ...screenshots });
    }
    for (const state of ["populated", "restricted", "largecounts", "longlabels"]) for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/?state=${state}`);
      await checkImages(page);
      const summary = page.locator(".dashboard-all-alerts summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      assert(await page.locator("details").getAttribute("open") !== null);
      const rows = await page.locator(".dashboard-full-alerts .dashboard-alert").evaluateAll((els) => els.map((el) => ({ key: el.dataset.alertKey, priority: el.dataset.priority, text: el.textContent, href: el.querySelector("a").getAttribute("href") })));
      const expected = state === "restricted" ? 28 : state === "largecounts" ? 18 : 14;
      assert.equal(rows.length, expected, "All generated alerts, including beyond 12, are disclosed");
      assert.equal(rows[0].key, state === "restricted" ? "synthetic-shop-0:billing" : "synthetic-shop-7:billing", "Late Critical alert must reach first preview");
      const ranks = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      assert(rows.every((row, i) => i === 0 || ranks[rows[i - 1].priority] <= ranks[row.priority]));
      assert(rows.every((row) => row.text.includes("Source:") && row.href.startsWith("/")));
      assert(rows.every((row) => destinations.includes(row.href) || /^\/shops\/synthetic-shop-\d\?tab=devices$/.test(row.href)));
      assert(rows.some((row) => row.href === "/timeclock-review"));
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute("href")), rows[0].href);
      await page.locator(".dashboard-full-alerts a").last().focus();
      const finalLink = await page.evaluate(() => ({ top: document.activeElement.getBoundingClientRect().top, bottom: document.activeElement.getBoundingClientRect().bottom }));
      assert(finalLink.top >= 0 && finalLink.bottom <= height);
      assert.equal((await measure(page)).width, width);
      const file = `${state}-alerts-expanded-${width}x${height}.png`;
      const expandedStats = await measure(page);
      const screenshots = await capture(page, file, expandedStats);
      results.push({ state, viewport: { width, height }, expanded: true, allAlertRows: rows, ...expandedStats, ...screenshots, disclosureKeyboard: true });
      await summary.focus(); await page.keyboard.press("Space");
      assert.equal(await page.locator("details").getAttribute("open"), null);
    }
    // The real Devices server page applies all five filters through its GET form.
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/devices`);
      const stats = await measure(page);
      assert.equal(stats.width, width, `Devices: horizontal page overflow at ${width}`);
      await checkImages(page);
      assert.equal(await page.locator("table thead th").count(), 10, "All device authority columns remain available");
      assert.equal(await page.locator("table tbody tr").count(), 4);
      assert.equal(await page.getByRole("region", { name: "Scrollable data table" }).count(), 1);
      assert(await page.locator("table tbody tr a").evaluateAll((links) => links.every((link) => {
        const action = link.getBoundingClientRect();
        const region = link.closest('[role="region"]').getBoundingClientRect();
        return action.left >= region.left && action.right <= region.right + 1;
      })), "Device actions remain in the visible table area at every viewport");
      const screenshots = await capture(page, `devices-${width}x${height}.png`, stats);
      const navKeyboard = await checkNavigationKeyboard(page, height);
      results.push({ screen: "devices", state: "populated", viewport: { width, height }, ...stats, navKeyboard, ...screenshots });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const filterCases = [
      [{ q: "office" }, ["synthetic-device-a"]],
      [{ type: "workstation" }, ["synthetic-device-b", "synthetic-device-d"]],
      [{ status: "disabled" }, ["synthetic-device-c"]],
      [{ shop: "synthetic-shop-1" }, ["synthetic-device-c", "synthetic-device-d"]],
      [{ access: "read only" }, ["synthetic-device-b"]],
      [{ q: "bay", type: "workstation", status: "active", shop: "synthetic-shop-0", access: "read only" }, ["synthetic-device-b"]],
    ];
    const filterResults = [];
    for (const [filters, expected] of filterCases) {
      await page.goto(`${origin}/devices`);
      for (const [name, value] of Object.entries(filters)) {
        const control = page.locator(`form [name="${name}"]`);
        if (name === "q") await control.fill(value); else await control.selectOption(value);
      }
      await Promise.all([page.waitForURL((url) => Object.entries(filters).every(([name, value]) => url.searchParams.get(name) === value)), page.getByRole("button", { name: "Apply", exact: true }).click()]);
      const rowIds = await page.locator("table tbody tr td:first-child").allTextContents();
      assert.deepEqual(rowIds.map((text) => deviceFixture().find((row) => text.includes(row.id))?.id), expected);
      const refresh = new URL(await page.getByRole("link", { name: "Refresh", exact: true }).getAttribute("href"), origin);
      for (const [name, value] of Object.entries(filters)) assert.equal(refresh.searchParams.get(name), value, "Refresh preserves the current filter");
      await page.getByRole("link", { name: "Refresh", exact: true }).click();
      assert.equal(await page.locator("table tbody tr").count(), expected.length);
      filterResults.push({ filters, expected, refreshed: true });
    }
    for (const mode of ["empty", "nonadmin"]) for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/devices?fixture=${mode}`);
      await checkImages(page);
      const stats = await measure(page);
      assert.equal(stats.width, width, `${mode} Devices: horizontal page overflow`);
      assert.equal(await page.locator("table").count(), 0);
      assert.match(await page.locator(".control-main").innerText(), mode === "nonadmin" ? /Platform admin access required/ : /No devices matched/);
      const screenshots = await capture(page, `devices-${mode}-${width}x${height}.png`, stats);
      results.push({ screen: "devices", state: mode, viewport: { width, height }, ...stats, ...screenshots });
    }
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/shops/synthetic-shop-0?tab=overview`);
      await checkImages(page);
      const stats = await measure(page);
      assert.equal(stats.width, width, `Shop: horizontal page overflow at ${width}`);
      const tabHrefs = await page.locator(".control-shop-page a").evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")).filter((href) => href === "/shops/synthetic-shop-0" || href?.startsWith("/shops/synthetic-shop-0?tab=")))]);
      assert.deepEqual(tabHrefs.slice().sort(), shopTabs.map((tab) => tab === "overview" ? "/shops/synthetic-shop-0" : `/shops/synthetic-shop-0?tab=${tab}`).sort(), "All nine shop tab destinations remain available");
      assert.equal(await page.getByRole("button", { name: "Sign out", exact: true }).count(), 1);
      assert.equal(await page.getByRole("link", { name: "Back to Shop List", exact: true }).count(), 1);
      const screenshots = await capture(page, `shop-overview-${width}x${height}.png`, stats);
      results.push({ screen: "shop", state: "overview", viewport: { width, height }, ...stats, tabHrefs, ...screenshots });
    }
    const navigationIconStates = [];
    let iconSources;
    for (const [width, height] of [[1920, 1080], [1366, 768], [390, 844]]) for (const active of destinations) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/fixture/navigation?active=${encodeURIComponent(active)}`);
      await checkImages(page);
      const nav = page.locator(".control-nav a");
      const values = await nav.evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), current: link.getAttribute("aria-current"), background: getComputedStyle(link).backgroundColor, image: link.querySelector("img")?.getAttribute("src"), tile: link.querySelector(".control-module-icon")?.getBoundingClientRect().width, glyph: link.querySelector("img")?.getBoundingClientRect().width })));
      assert.deepEqual(values.map((value) => value.href), destinations);
      assert.equal(values.filter((value) => value.current === "page").length, 1);
      assert.equal(values.find((value) => value.current === "page").href, active);
      assert(values.every((value) => value.image && value.glyph === (width <= 650 ? 22 : 24) && value.tile === (width <= 650 ? 28 : 32)), "All icons retain approved compact/desktop dimensions");
      assert(values.every((value) => value.background === (value.href === active ? "rgb(7, 95, 255)" : "rgba(0, 0, 0, 0)")), "Existing selection treatment applies only to the selected route");
      const sources = values.map((value) => value.image);
      if (!iconSources) iconSources = sources; else assert.deepEqual(sources, iconSources, "Active and inactive rows use identical approved SVGs");
      const stats = await measure(page);
      assert.equal(stats.width, width, "Navigation fixtures must reflow without horizontal page overflow");
      await checkNavigationKeyboard(page, height);
      const selected = page.locator(`.control-nav a[href="${active}"]`);
      await selected.focus();
      const selectedBox = await selected.boundingBox();
      assert(selectedBox.y >= 0 && selectedBox.y + selectedBox.height <= height, "Selected route remains keyboard-visible");
      let screenshot;
      if (width === 1920) {
        screenshot = `navigation-active-${active.slice(1)}-1920x1080.png`;
        await page.screenshot({ path: path.join(evidence, screenshot) });
      }
      navigationIconStates.push({ active, viewport: { width, height }, values, screenshot });
    }
    // Taller review viewport exposes the complete existing scrollable sidebar without changing its layout.
    await page.setViewportSize({ width: 1920, height: 1440 });
    await page.goto(`${origin}/?state=populated`);
    await checkImages(page);
    const allIconStats = await measure(page);
    assert.equal(allIconStats.width, 1920);
    const navBounds = await page.locator(".control-nav a").evaluateAll((links) => links.map((link) => ({ top: link.getBoundingClientRect().top, bottom: link.getBoundingClientRect().bottom })));
    assert(navBounds.every((box) => box.top >= 0 && box.bottom <= 1440), "Complete sidebar review must expose every icon and label");
    const allIconShots = await capture(page, "populated-all-icons-1920x1440.png", allIconStats);
    await page.locator(".control-sidebar").screenshot({ path: path.join(evidence, "sidebar-all-13-icons.png") });
    results.push({ state: "populated", viewport: { width: 1920, height: 1440 }, all13IconsVisible: true, ...allIconStats, ...allIconShots });
    await context.close();
    // Actual browser zoom in a fresh task-owned profile, without CSS zoom or CDP scaling.
    // Chromium zoom preference: chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc
    const profile = fs.mkdtempSync(path.join(evidence, "edge-zoom-"));
    fs.mkdirSync(path.join(profile, "Default"));
    fs.writeFileSync(path.join(profile, "Default", "Preferences"), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(2) / Math.log(1.2) } } }));
    zoomContext = await chromium.launchPersistentContext(profile, { executablePath: edgePath, headless: true, viewport: null, args: ["--window-size=1366,768"] });
    await zoomContext.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const zoom = zoomContext.pages()[0];
    watch(zoom);
    await zoom.goto(`${origin}/?state=populated`);
    await checkImages(zoom);
    const zoomStats = await measure(zoom);
    const zoomProof = await zoom.evaluate(() => ({ innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio }));
    assert.equal(zoomProof.devicePixelRatio, 2);
    assert.equal(zoomProof.outerWidth, 1366);
    assert.equal(zoomStats.width, zoomProof.innerWidth);
    assert(zoomStats.height > zoomProof.innerHeight);
    const zoomScreenshots = await capture(zoom, "populated-200pct-nativezoom.png", zoomStats);
    results.push({ state: "populated", browserZoom: "200%", zoomProof, ...zoomStats, ...zoomScreenshots });
    const zoomNav = await checkNavigationKeyboard(zoom, zoomProof.innerHeight);
    await zoom.locator("summary").focus();
    await zoom.keyboard.press("Enter");
    assert.equal(await zoom.locator(".dashboard-full-alerts .dashboard-alert").count(), 14);
    await zoom.locator(".dashboard-full-alerts a").last().focus();
    const zoomExpandedStats = await measure(zoom);
    const zoomExpandedShots = await capture(zoom, "populated-alerts-expanded-200pct-nativezoom.png", zoomExpandedStats);
    results.push({ state: "populated", browserZoom: "200%", zoomProof, expanded: true, ...zoomExpandedStats, navKeyboard: zoomNav, disclosureKeyboard: true, ...zoomExpandedShots });
    await zoomContext.close();
    zoomContext = undefined;
    assert.deepEqual(serverErrors, [], "All actual-page fixtures must render successfully");
    assert.deepEqual(browserErrors, [], "No browser console, resource or page errors");
    assert.deepEqual(blocked, [], "Fixtures must make no external requests");
    fs.writeFileSync(path.join(evidence, "measurements.json"), JSON.stringify({ generatedAt: new Date().toISOString(), actualComponents: true, liveAuthenticatedApp: false, fixtureLabel: "Synthetic component preview; not live or authenticated", mocks: ["data", "navigation", "shop layout identity"], externalRequests: blocked, browserErrors, queryCalls: Object.fromEntries(states.map((state) => [state, rendered[state].calls])), shopQueryCalls: shop.calls, filterResults, navigationIconStates, results }, null, 2));
    console.log(`PASS: ${results.length} labeled actual-component captures across Dashboard, Devices and shop; five GET filters, refresh, 10 device columns, nine shop tabs, caps, full alerts, stable priority, 13 keyboard routes, 39 all-icon active/inactive states, disclosure and reflow. Evidence: ${evidence}`);
  } finally {
    if (zoomContext) await zoomContext.close();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function checkImages(page) {
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  const broken = await page.locator("img").evaluateAll((images) => images.filter((image) => image.naturalWidth === 0).map((image) => image.getAttribute("src")));
  assert.deepEqual(broken, [], "All existing artwork requested by the actual components must load");
  const waves = await page.locator(".control-panel-heading").evaluateAll((headers) => headers.map((header) => getComputedStyle(header).backgroundImage));
  assert(waves.every((wave) => wave.includes("/artwork/runbook-refined-b/message-header.png")), "Every headed panel must render the approved original wave");
  if (await page.locator(".control-dashboard").count()) assert(waves.length >= 3, "Dashboard must keep all three headed panels");
  assert.equal(await page.locator(".control-module-icon img").count(), 13, "All thirteen original or owner-approved module icons");
  const colors = await page.locator(".dashboard-metrics > a > div").evaluateAll((cards) => cards.map((card) => getComputedStyle(card).backgroundColor));
  assert(colors.every((color) => color === "rgb(223, 236, 253)"), "Refined B supporting metrics use the specified blue-gray");

}

async function checkNavigationKeyboard(page, height) {
  const shopLink = page.locator(".control-shop-link");
  await shopLink.focus();
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("href")), "/shops");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "control-navigation-search", "Shop browse link is followed by navigation search");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("href")), destinations[0]);
  await page.locator(".control-nav a").first().focus();
  const reached = [];
  for (let i = 0; i < destinations.length; i++) {
    const active = await page.evaluate(() => ({ href: document.activeElement.getAttribute("href"), outline: getComputedStyle(document.activeElement).outlineStyle, top: document.activeElement.getBoundingClientRect().top, bottom: document.activeElement.getBoundingClientRect().bottom }));
    reached.push(active.href);
    assert.equal(active.outline, "solid");
    assert(active.top >= 0 && active.bottom <= height, `Focused navigation item must scroll into view: ${JSON.stringify({ ...active, height })}`);
    if (i < destinations.length - 1) await page.keyboard.press("Tab");
  }
  assert.deepEqual(reached, destinations);
  return reached;
}

async function capture(page, file, stats) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const fullScreenshot = stats.height > stats.clientHeight ? file.replace(/\.png$/, "-full.png") : null;
  if (await page.evaluate(() => devicePixelRatio) === 2) {
    // At native browser zoom, Playwright's CSS viewport clip crops the physical frame.
    // Capture the browser surface directly; never resize or edit the returned PNG.
    const cdp = await page.context().newCDPSession(page);
    try {
      const metrics = await cdp.send("Page.getLayoutMetrics");
      const viewport = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      const png = Buffer.from(viewport.data, "base64");
      assert(png.readUInt32BE(16) >= stats.clientWidth * 2 - 1);
      fs.writeFileSync(path.join(evidence, file), png);
      if (fullScreenshot) {
        const full = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true, clip: { ...metrics.contentSize, scale: 1 } });
        const fullPng = Buffer.from(full.data, "base64");
        assert(fullPng.readUInt32BE(16) >= stats.clientWidth * 2 - 1);
        assert(fullPng.readUInt32BE(20) >= stats.height * 2 - 2);
        fs.writeFileSync(path.join(evidence, fullScreenshot), fullPng);
      }
    } finally { await cdp.detach(); }
  } else {
    await page.screenshot({ path: path.join(evidence, file) });
    if (fullScreenshot) await page.screenshot({ path: path.join(evidence, fullScreenshot), fullPage: true });
  }
  return { screenshot: file, fullScreenshot };
}

async function measure(page) {
  return page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    sidebar: { height: document.querySelector("aside").clientHeight, scrollHeight: document.querySelector("aside").scrollHeight, navHeight: document.querySelector("nav").clientHeight, navScrollHeight: document.querySelector("nav").scrollHeight },
    scrollTables: [...document.querySelectorAll('[role="region"][aria-label="Scrollable data table"]')].map((element) => ({ label: element.getAttribute("aria-label"), width: element.clientWidth, scrollWidth: element.scrollWidth, overflowX: getComputedStyle(element).overflowX })),
    fixtureNote: (() => { const element = document.querySelector('[role="note"][aria-label="Fixture preview"]'); const rect = element.getBoundingClientRect(); return { text: element.textContent, top: rect.top, bottom: rect.bottom }; })(),
    metricHeights: [...document.querySelectorAll(".dashboard-metrics > a > div")].map((el) => el.getBoundingClientRect().height),
    typography: Object.fromEntries([["title", "h1"], ["description", ".control-page-description"], ["navigation", ".control-nav-item"], ["panelHeading", ".control-panel-heading h2"], ["tableBody", ".control-table td"]].map(([name, selector]) => { const element = document.querySelector(selector); return [name, element ? { fontSize: getComputedStyle(element).fontSize, lineHeight: getComputedStyle(element).lineHeight } : null]; })),
  }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
