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
const evidence = path.join(root, ".local-evidence", "control-compact");
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const playwrightPath = process.env.CONTROL_PLAYWRIGHT_CORE || "C:\\RunBook-DeployPrep\\20261016-control\\browser-tools\\node_modules\\playwright-core";
const viewports = [[1366, 768], [1440, 900], [1920, 1080], [390, 844]];
const states = ["populated", "empty", "largecounts", "longlabels", "restricted", "queryerror"];
const destinations = ["/dashboard", "/shops", "/devices", "/workstations", "/people", "/mobile-access", "/timeclock-review", "/billing-access", "/support", "/software-updates", "/updates", "/audit", "/settings"];

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
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() },
    "@/lib/control/summary": {
      getViewerContext: async () => ({ userId: "synthetic-user", email: "reviewer@example.invalid", isPlatformAdmin: true, shops: data.snapshots }),
      getShopSnapshot: async (shop) => shop,
      getPlatformSnapshot: async () => ({ manageableShopCount: data.snapshots.length }),
    },
    "@/lib/supabase/admin": { supabaseAdmin: () => ({ from: data.from }) },
  });
  const DashboardPage = load(path.join(root, "src/app/(authed)/dashboard/page.tsx")).default;
  const Shell = load(path.join(root, "src/components/control/ControlAppShell.tsx")).default;
  const RootLayout = load(path.join(root, "src/app/layout.tsx")).default;
  const page = await DashboardPage();
  assert.equal(data.calls.length, state === "empty" ? 1 : 5, "No additional dashboard requests");
  const html = "<!doctype html>" + renderToStaticMarkup(React.createElement(RootLayout, null, React.createElement(Shell, {
    email: data.long ? `${"long-account".repeat(12)}@example.invalid` : "reviewer@example.invalid", roleLabel: "Platform admin",
    statuses: [{ key: "auth", label: "Signed in", tone: "success" }, { key: "data", label: "Data connected", tone: "success" }],
  }, page)));
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

async function main() {
  fs.mkdirSync(evidence, { recursive: true });
  const rendered = Object.fromEntries(await Promise.all(states.map(async (state) => [state, await render(state)])));
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const state = url.searchParams.get("state") || "populated";
    if (url.pathname !== "/" || !Object.hasOwn(rendered, state)) { response.writeHead(404); response.end("Local fixture only"); return; }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'none'; font-src 'none'" });
    response.end(rendered[state].html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require(playwrightPath);
  let browser;
  const results = [];
  const blocked = [];
  try {
    browser = await chromium.launch({ executablePath: edgePath, headless: true });
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      blocked.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    for (const state of states) for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/?state=${state}`);
      const stats = await measure(page);
      assert.equal(stats.width, width, `${state}: horizontal page overflow at ${width}`);
      if (["populated", "empty", "restricted", "queryerror"].includes(state) && width >= 1200) assert.equal(stats.height, height, `${state}: desktop overview scroll at ${width}`);
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
      // Every sidebar route is reachable by keyboard, including when nav has to scroll.
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      const reached = [];
      for (let i = 0; i < 13; i++) {
        await page.keyboard.press("Tab");
        const active = await page.evaluate(() => ({ href: document.activeElement.getAttribute("href"), outline: getComputedStyle(document.activeElement).outlineStyle, top: document.activeElement.getBoundingClientRect().top, bottom: document.activeElement.getBoundingClientRect().bottom }));
        reached.push(active.href);
        assert.equal(active.outline, "solid");
        assert(active.top >= 0 && active.bottom <= height, "Focused nav item must scroll into view");
      }
      assert.deepEqual(reached, destinations);
      results.push({ state, viewport: { width, height }, ...stats, navKeyboard: reached, ...screenshots });
    }
    for (const state of ["populated", "restricted", "largecounts", "longlabels"]) for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/?state=${state}`);
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
    await context.close();
    // Actual browser zoom in a fresh task-owned profile, without CSS zoom or CDP scaling.
    // Chromium zoom preference: chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc
    const profile = fs.mkdtempSync(path.join(evidence, "edge-zoom-"));
    fs.mkdirSync(path.join(profile, "Default"));
    fs.writeFileSync(path.join(profile, "Default", "Preferences"), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(2) / Math.log(1.2) } } }));
    const zoomContext = await chromium.launchPersistentContext(profile, { executablePath: edgePath, headless: true, viewport: null, args: ["--window-size=1366,768"] });
    await zoomContext.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const zoom = zoomContext.pages()[0];
    await zoom.goto(`${origin}/?state=populated`);
    const zoomStats = await measure(zoom);
    const zoomProof = await zoom.evaluate(() => ({ innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio }));
    assert.equal(zoomProof.devicePixelRatio, 2);
    assert.equal(zoomProof.outerWidth, 1366);
    assert.equal(zoomStats.width, zoomProof.innerWidth);
    assert(zoomStats.height > zoomProof.innerHeight);
    const zoomScreenshots = await capture(zoom, "populated-200pct-nativezoom.png", zoomStats);
    results.push({ state: "populated", browserZoom: "200%", zoomProof, ...zoomStats, ...zoomScreenshots });
    await zoom.locator("body").click({ position: { x: 1, y: 1 } });
    const zoomNav = [];
    for (let i = 0; i < 13; i++) {
      await zoom.keyboard.press("Tab");
      zoomNav.push(await zoom.evaluate(() => document.activeElement.getAttribute("href")));
    }
    assert.deepEqual(zoomNav, destinations);
    await zoom.locator("summary").focus();
    await zoom.keyboard.press("Enter");
    assert.equal(await zoom.locator(".dashboard-full-alerts .dashboard-alert").count(), 14);
    await zoom.locator(".dashboard-full-alerts a").last().focus();
    const zoomExpandedStats = await measure(zoom);
    const zoomExpandedShots = await capture(zoom, "populated-alerts-expanded-200pct-nativezoom.png", zoomExpandedStats);
    results.push({ state: "populated", browserZoom: "200%", zoomProof, expanded: true, ...zoomExpandedStats, navKeyboard: zoomNav, disclosureKeyboard: true, ...zoomExpandedShots });
    await zoomContext.close();
    fs.writeFileSync(path.join(evidence, "measurements.json"), JSON.stringify({ generatedAt: new Date().toISOString(), actualComponents: true, mocks: ["data", "navigation"], externalRequests: blocked, queryCalls: Object.fromEntries(states.map((state) => [state, rendered[state].calls])), results }, null, 2));
    console.log(`PASS: ${results.length} actual-component captures; caps, full alerts, stable priority, 13 keyboard routes, disclosure and reflow. Evidence: ${evidence}`);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function capture(page, file, stats) {
  await page.evaluate(() => scrollTo(0, 0));
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
    metricHeights: [...document.querySelectorAll(".dashboard-metrics > a > div")].map((el) => el.getBoundingClientRect().height),
  }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
