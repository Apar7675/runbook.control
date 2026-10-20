const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// Exercise the real layouts with synthetic identity/shop records. No credentials,
// Supabase client, API request, or persisted shop data is used by this test.
const repositoryRoot = path.resolve(__dirname, "..");
const src = (...parts) => path.join(repositoryRoot, "src", ...parts);
const paths = {
  authed: src("app", "(authed)", "layout.tsx"),
  shop: src("app", "(authed)", "shops", "[shopId]", "layout.tsx"),
  legacyBilling: src("app", "(authed)", "shops", "[shopId]", "billing", "page.tsx"),
  theme: src("lib", "ui", "theme.ts"),
};
const shopId = "synthetic-shop-admin-access";

class Redirect extends Error {
  constructor(location) {
    super(`redirect:${location}`);
    this.location = location;
  }
}

function loadTypeScript(filename, mocks = {}) {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, `Cannot transpile ${filename}`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = (request) => {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    if (["react", "react/jsx-runtime"].includes(request)) return require(request);
    throw new Error(`Unexpected dependency in synthetic layout verification: ${request}`);
  };
  loaded._compile(result.outputText, filename);
  return loaded.exports;
}

const theme = loadTypeScript(paths.theme);

function createHarness(overrides = {}) {
  const fixture = {
    session: true,
    user: true,
    admin: true,
    aal: "aal2",
    trusted: false,
    deviceCookie: true,
    billingStatus: "expired",
    requestPath: `/shops/${shopId}?tab=billing`,
    ...overrides,
  };
  const calls = { shop: 0, gate: 0, trusted: 0 };
  const user = fixture.user ? { id: "synthetic-admin", email: "admin@example.test" } : null;
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: fixture.session ? { user } : null } }),
      getUser: async () => ({ data: { user } }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: fixture.aal } }),
      },
    },
    from(table) {
      assert.ok(["rb_control_admins", "rb_trusted_devices"].includes(table), `Unexpected table: ${table}`);
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() {
          if (table === "rb_control_admins") {
            return { data: fixture.admin ? { user_id: "synthetic-admin" } : null };
          }
          calls.trusted += 1;
          return {
            data: fixture.trusted
              ? { trusted_until: new Date(Date.now() + 60_000).toISOString() }
              : null,
          };
        },
      };
      return query;
    },
  };
  const mocks = {
    "next/navigation": { redirect(location) { throw new Redirect(location); } },
    "next/headers": {
      cookies: async () => ({ get: () => fixture.deviceCookie ? { value: "synthetic-device" } : undefined }),
      headers: async () => ({ get: () => fixture.requestPath }),
    },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement("a", props, children),
    },
    "@/lib/supabase/server": { supabaseServer: async () => supabase },
    "@/lib/authz": { isPlatformAdmin: async () => fixture.admin },
    "@/lib/connection-status": { buildControlHeaderStatuses: () => [] },
    "@/components/DeviceIdBootstrap": { __esModule: true, default: () => null },
    "@/components/SignOutButton": {
      __esModule: true,
      default: () => React.createElement("button", { type: "button" }, "Sign out"),
    },
    "@/components/control/ControlAppShell": {
      __esModule: true,
      default: ({ children, roleLabel }) => React.createElement("div", { "data-role": roleLabel }, children),
    },
    "@/lib/rb": {
      rbGetShop: async (id) => {
        assert.equal(id, shopId);
        calls.shop += 1;
        return { id, name: "Synthetic Shop", billing_status: fixture.billingStatus };
      },
    },
    "@/lib/ui/theme": theme,
    "@/components/billing/BillingGate": {
      BillingGate() {
        calls.gate += 1;
        throw new Error("Platform administration must not mount the customer billing gate");
      },
    },
  };
  const authed = loadTypeScript(paths.authed, mocks).default;
  const shop = loadTypeScript(paths.shop, mocks).default;
  const legacyBilling = loadTypeScript(paths.legacyBilling, mocks).default;
  return { fixture, calls, authed, shop, legacyBilling };
}

function billingControls(state) {
  return React.createElement("section", { "data-synthetic-billing-status": state },
    React.createElement("h1", null, "Synthetic billing administration"),
    React.createElement("p", null, `Customer access: ${state}`),
    React.createElement("button", { type: "button", "data-test-action": "extend-trial" }, "Extend 30 Days"),
    React.createElement("button", { type: "button", "data-test-action": "sync-status" }, "Sync Billing From Stripe"),
  );
}

async function renderAdminShop(harness) {
  // Resolve the parent first so rejected identities never fetch shop data.
  const shell = await harness.authed({ children: null });
  const workspace = await harness.shop({
    params: Promise.resolve({ shopId }),
    children: billingControls(harness.fixture.billingStatus),
  });
  const shellChildren = React.Children.toArray(shell.props.children);
  const appShellIndex = shellChildren.length - 1;
  shellChildren[appShellIndex] = React.cloneElement(shellChildren[appShellIndex], {}, workspace);
  return renderToStaticMarkup(React.cloneElement(shell, {}, ...shellChildren));
}

async function requireRedirect(label, overrides, location) {
  const harness = createHarness(overrides);
  await assert.rejects(() => renderAdminShop(harness),
    (error) => error instanceof Redirect && error.location === location,
    label,
  );
  assert.equal(harness.calls.shop, 0, `${label}: denied identity fetched shop data`);
  console.log(`PASS ${label} -> ${location}`);
}

function assertUnobscured(html, label) {
  assert.match(html, /data-role="Platform admin"/, `${label}: authenticated console missing`);
  assert.match(html, /Extend 30 Days/, `${label}: trial administration missing`);
  assert.match(html, /Sync Billing From Stripe/, `${label}: billing administration missing`);
  assert.doesNotMatch(html, /pointer-events:\s*none|(?:[;"\s])filter:\s*blur|aria-modal="true"|Start \/ Manage Trial|Go to Billing/,
    `${label}: administrative content is obscured by a customer billing paywall`);
  assert.doesNotMatch(html, /<button[^>]+disabled/, `${label}: administrative actions disabled`);
}

async function main() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Network access forbidden in synthetic layout verification"); };
  try {
    await requireRedirect("missing session", { session: false }, "/login");
    await requireRedirect("missing verified user", { user: false }, "/login");
    await requireRedirect("authenticated non-admin", { admin: false }, "/restricted");
    await requireRedirect("untrusted AAL1 admin", { aal: "aal1" }, "/mfa");
    await requireRedirect("trusted record without device cookie", { aal: "aal1", trusted: true, deviceCookie: false }, "/mfa");

    let evidenceHtml = "";
    for (const billingStatus of ["expired", "past_due", "canceled", "active"]) {
      for (const identity of [
        { label: "AAL2", aal: "aal2", trusted: false },
        { label: "trusted AAL1", aal: "aal1", trusted: true },
      ]) {
        for (const tab of ["billing", "users", "overview"]) {
          const label = `${identity.label} admin, ${billingStatus} shop, ${tab} tab`;
          const harness = createHarness({ ...identity, billingStatus, requestPath: `/shops/${shopId}?tab=${tab}` });
          const html = await renderAdminShop(harness);
          assertUnobscured(html, label);
          assert.equal(harness.calls.gate, 0, `${label}: customer gate was mounted`);
          assert.equal(harness.calls.shop, 1, `${label}: expected one synthetic shop read`);
          if (identity.aal === "aal1") assert.equal(harness.calls.trusted, 2, `${label}: both layouts must retain trusted-device checks`);
          if (billingStatus === "expired" && identity.aal === "aal2" && tab === "billing") evidenceHtml = html;
          console.log(`PASS ${label}`);
        }
      }
    }

    const legacy = createHarness();
    await assert.rejects(() => legacy.legacyBilling({ params: Promise.resolve({ shopId }) }),
      (error) => error instanceof Redirect && error.location === `/shops/${shopId}?tab=billing`,
      "legacy billing URL must still resolve to the billing tab",
    );
    console.log("PASS legacy /billing redirect retains ?tab=billing");

    if (process.env.RUNBOOK_WRITE_SYNTHETIC_EVIDENCE === "1") {
      const evidenceDirectory = path.join(repositoryRoot, ".local-evidence", "shop-admin-access");
      fs.mkdirSync(evidenceDirectory, { recursive: true });
      const output = path.join(evidenceDirectory, "expired-admin.html");
      fs.writeFileSync(output, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Synthetic expired shop admin access</title></head><body style="margin:0;font-family:Segoe UI,sans-serif">${evidenceHtml}<output id="click-result" style="position:fixed;right:16px;bottom:16px;color:white"></output><script>document.addEventListener("click", function(event) { const button = event.target.closest("[data-test-action]"); if (button) document.getElementById("click-result").textContent = "Synthetic click received: " + button.dataset.testAction; });</script></body></html>`, "utf8");
      console.log(`Synthetic SSR evidence: ${output}`);
    }
    console.log("PASS synthetic shop administration remains unobscured; authentication and MFA redirects retained");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
