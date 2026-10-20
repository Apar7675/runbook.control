const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Run the real route with an isolated environment. No .env files, authentication,
// provider credentials, network requests, or persisted records participate.
const routePath = path.resolve(__dirname, "../src/app/api/desktop/onboarding-policy/route.ts");
const flag = "RUNBOOK_DESKTOP_ONBOARDING_CONTACT_VERIFICATION_REQUIRED";
const compiled = ts.transpileModule(fs.readFileSync(routePath, "utf8"), {
  fileName: routePath,
  reportDiagnostics: true,
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
  },
});
assert.equal((compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0);

function loadRoute(value) {
  const environment = value === undefined ? {} : { [flag]: value };
  const loaded = { exports: {} };
  const requireSynthetic = (name) => {
    assert.equal(name, "next/server", "Policy route unexpectedly imports another dependency");
    return {
      NextResponse: {
        json(body, init = {}) {
          return new Response(JSON.stringify(body), {
            ...init,
            headers: { "content-type": "application/json", ...(init.headers ?? {}) },
          });
        },
      },
    };
  };
  new Function("exports", "require", "module", "process", compiled.outputText)(
    loaded.exports, requireSynthetic, loaded, { env: environment },
  );
  assert.equal(loaded.exports.dynamic, "force-dynamic");
  assert.equal(loaded.exports.revalidate, 0);
  return loaded.exports;
}

async function assertPolicy(route, expected, request) {
  const response = await route.GET(request);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), {
    ok: true,
    email_verification_required: expected,
    sms_verification_required: expected,
  }, "Response must expose only the two requirements and ok; it must not claim contact verification");
}

async function main() {
  let passed = 0;
  for (const [label, value, expected] of [
    ["missing flag defaults to required", undefined, true],
    ["empty flag defaults to required", "", true],
    ["literal lowercase false disables both requirements", "false", false],
    ["true keeps both requirements", "true", true],
    ["uppercase FALSE keeps both requirements", "FALSE", true],
    ["mixed-case False keeps both requirements", "False", true],
    ["whitespace false keeps both requirements", " false ", true],
    ["numeric zero keeps both requirements", "0", true],
    ["off keeps both requirements", "off", true],
    ["malformed value keeps both requirements", "false;anything", true],
  ]) {
    await assertPolicy(loadRoute(value), expected);
    console.log(`PASS ${label}`);
    passed += 1;
  }

  for (const [value, expected] of [[undefined, true], ["false", false]]) {
    const requested = String(!expected);
    const url = new URL("https://control.synthetic.invalid/api/desktop/onboarding-policy");
    for (const key of [flag, "email_verification_required", "sms_verification_required"]) {
      url.searchParams.set(key, requested);
    }
    const request = new Request(url, {
      headers: {
        [flag]: requested,
        "x-email-verification-required": requested,
        "x-sms-verification-required": requested,
        cookie: `${flag}=${requested}`,
      },
    });
    await assertPolicy(loadRoute(value), expected, request);
    console.log(`PASS request query, headers and cookies cannot override server policy (${expected})`);
    passed += 1;
  }

  console.log(`Desktop onboarding policy regression: ${passed} cases passed; real network calls=0; real records=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
