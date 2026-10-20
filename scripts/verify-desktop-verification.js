const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// All identity records, tables, credentials and provider responses are synthetic.
// The loader injects its own process.env and fetch; no .env file, Supabase client,
// account, production table, or real delivery provider is accessed.
const repositoryRoot = path.resolve(__dirname, "..");
const syntheticUser = { id: "00000000-0000-4000-8000-000000000001", email: "owner@example.test" };
const validToken = "synthetic-valid-bearer";
const approvedProviderCode = "654321";
const profile = {
  full_name: "Synthetic Owner",
  email: syntheticUser.email,
  phone: "+12025550123",
  shop_name: "Synthetic Shop",
  device_id: "synthetic-device",
};
const routeNames = ["send-email-code", "verify-email-code", "send-sms-code", "verify-sms-code"];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function makeSyntheticDatabase(calls) {
  const tables = new Map([
    ["rb_onboarding_state", []],
    ["rb_onboarding_codes", []],
  ]);
  let nextId = 1;
  return {
    tables,
    from(table) {
      assert.ok(tables.has(table), `Unexpected table access: ${table}`);
      const filters = [];
      let operation = "select";
      let payload;
      let conflictFields;
      let executed;
      function execute() {
        if (executed) return executed;
        const rows = tables.get(table);
        const matches = (row) => filters.every(([key, value]) => row[key] === value);
        let data;
        if (operation === "select") {
          calls.databaseReads += 1;
          data = rows.filter(matches);
        } else if (operation === "upsert") {
          calls.databaseWrites += 1;
          const keys = conflictFields.split(",");
          let row = rows.find((candidate) => keys.every((key) => candidate[key] === payload[key]));
          if (!row) {
            row = { id: `synthetic-row-${nextId++}` };
            rows.push(row);
          }
          Object.assign(row, clone(payload));
          data = [row];
        } else {
          calls.databaseWrites += 1;
          data = rows.filter(matches);
          for (const row of data) Object.assign(row, clone(payload));
        }
        executed = Promise.resolve({ data: clone(data), error: null });
        return executed;
      }
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        upsert(value, options) {
          operation = "upsert";
          payload = value;
          conflictFields = options.onConflict;
          return query;
        },
        update(value) { operation = "update"; payload = value; return query; },
        async maybeSingle() {
          const result = await execute();
          assert.ok(result.data.length <= 1, "Synthetic query unexpectedly matched multiple rows");
          return { data: result.data[0] ?? null, error: null };
        },
        async single() {
          const result = await query.maybeSingle();
          assert.ok(result.data, "Synthetic single query returned no row");
          return result;
        },
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      return query;
    },
  };
}

function createHarness(options = {}) {
  const calls = { bearerAuth: 0, cookieAuth: 0, databaseReads: 0, databaseWrites: 0, providers: [] };
  const database = makeSyntheticDatabase(calls);
  const environment = {
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.synthetic.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-key",
    RUNBOOK_ONBOARDING_SECRET: "synthetic-onboarding-secret",
    ...(options.verifyProvider ? {
      TWILIO_ACCOUNT_SID: "ACsynthetic",
      TWILIO_AUTH_TOKEN: "synthetic-twilio-token",
      TWILIO_VERIFY_SERVICE_SID: "VAsynthetic",
    } : {}),
    ...(options.directEmail ? {
      SENDGRID_API_KEY: "synthetic-sendgrid-key",
      RUNBOOK_ONBOARDING_EMAIL_FROM: "sender@example.test",
    } : {}),
    ...(options.directSms ? {
      TWILIO_ACCOUNT_SID: "ACsynthetic",
      TWILIO_AUTH_TOKEN: "synthetic-twilio-token",
      TWILIO_FROM_NUMBER: "+12025550124",
    } : {}),
  };

  async function syntheticProviderFetch(url, init) {
    const parsed = new URL(url);
    assert.equal(init.method, "POST", "Provider request must use POST");
    const call = { host: parsed.hostname, path: parsed.pathname, form: null, json: null };
    calls.providers.push(call);
    if (parsed.hostname === "verify.twilio.com") {
      assert.ok(options.verifyProvider, "Unexpected Twilio Verify request");
      assert.match(parsed.pathname, /^\/v2\/Services\/VAsynthetic\/(Verifications|VerificationCheck)$/);
      assert.match(init.headers.Authorization, /^Basic /);
      call.form = Object.fromEntries(new URLSearchParams(init.body));
      if (options.providerRejected) {
        return new Response(JSON.stringify({ message: "Synthetic provider rejection" }), { status: 403 });
      }
      const checking = parsed.pathname.endsWith("/VerificationCheck");
      if (checking && options.verificationMissingCode) {
        return new Response(JSON.stringify({
          code: options.verificationMissingCode,
          message: "The requested resource /v2/Services/VAsynthetic/VerificationCheck was not found",
        }), { status: 404 });
      }
      if (!checking) assert.ok(["email", "sms"].includes(call.form.Channel));
      return new Response(JSON.stringify({
        status: checking && call.form.Code === approvedProviderCode ? "approved" : "pending",
        sid: "synthetic-provider-request",
      }), { status: checking ? 200 : 201 });
    }
    if (parsed.hostname === "api.sendgrid.com") {
      assert.ok(options.directEmail, "Unexpected SendGrid request");
      assert.equal(parsed.pathname, "/v3/mail/send");
      call.json = JSON.parse(init.body);
      assert.equal(call.json.personalizations[0].to[0].email, profile.email);
      assert.equal(call.json.from.email, "sender@example.test");
      if (options.emailProviderError) {
        return new Response(JSON.stringify({ errors: [{ message: options.emailProviderError.message }] }), {
          status: options.emailProviderError.status,
        });
      }
      return new Response(options.providerRejected ? JSON.stringify({ errors: [{ message: "Synthetic provider rejection" }] }) : "", {
        status: options.providerRejected ? 403 : 202,
        headers: { "x-message-id": "synthetic-email-request" },
      });
    }
    if (parsed.hostname === "api.twilio.com") {
      assert.ok(options.directSms && !options.verifyProvider, "Unexpected direct Twilio SMS request");
      assert.equal(parsed.pathname, "/2010-04-01/Accounts/ACsynthetic/Messages.json");
      call.form = Object.fromEntries(new URLSearchParams(init.body));
      assert.equal(call.form.To, profile.phone);
      return new Response(JSON.stringify({ status: "queued", sid: "synthetic-sms-request" }), { status: 201 });
    }
    throw new Error(`Network access forbidden; unexpected provider host ${parsed.hostname}`);
  }

  const cookieClient = {
    auth: { async getUser() { calls.cookieAuth += 1; return { data: { user: options.cookieUser ? syntheticUser : null } }; } },
  };
  const mocks = {
    "next/server": {
      NextResponse: {
        json(value, init = {}) {
          return new Response(JSON.stringify(value), {
            ...init,
            headers: { "content-type": "application/json", ...(init.headers ?? {}) },
          });
        },
      },
    },
    "@supabase/supabase-js": {
      createClient(url, key, config) {
        assert.equal(url, environment.NEXT_PUBLIC_SUPABASE_URL);
        assert.equal(key, environment.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        assert.equal(config.auth.persistSession, false);
        return {
          auth: {
            async getUser(token) {
              calls.bearerAuth += 1;
              return token === validToken
                ? { data: { user: syntheticUser }, error: null }
                : { data: { user: null }, error: { message: "Synthetic invalid bearer" } };
            },
          },
        };
      },
    },
    "@/lib/supabase/server": { supabaseServer: async () => cookieClient },
    "@/lib/supabase/admin": { supabaseAdmin: () => database },
    // Rate limiting is orthogonal to this authentication/provider regression.
    "@/lib/security/rateLimit": { rateLimitOrThrow() {} },
  };
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      fileName: filename,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    });
    const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, `Cannot transpile ${filename}`);
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    function requireSynthetic(request) {
      const normalized = request === "./server" && filename.endsWith(`${path.sep}routeAuth.ts`)
        ? "@/lib/supabase/server" : request;
      if (Object.prototype.hasOwnProperty.call(mocks, normalized)) return mocks[normalized];
      if (normalized === "crypto") return require("node:crypto");
      if (normalized.startsWith("@/")) {
        return load(path.join(repositoryRoot, "src", `${normalized.slice(2)}.ts`));
      }
      throw new Error(`Unexpected dependency in isolated verification: ${request}`);
    }
    new Function("exports", "require", "module", "__filename", "__dirname", "process", "fetch", output.outputText)(
      loaded.exports, requireSynthetic, loaded, filename, path.dirname(filename), { env: environment }, syntheticProviderFetch,
    );
    return loaded.exports;
  }
  const routes = Object.fromEntries(routeNames.map((name) => [name,
    load(path.join(repositoryRoot, "src", "app", "api", "onboarding", name, "route.ts")),
  ]));
  return {
    calls,
    database,
    state: () => database.tables.get("rb_onboarding_state")[0],
    async invoke(name, body = profile, auth = "bearer") {
      const headers = { "content-type": "application/json" };
      if (auth === "bearer") headers.authorization = `Bearer ${validToken}`;
      if (auth === "invalid") headers.authorization = "Bearer synthetic-invalid-bearer";
      const response = await routes[name].POST(new Request(`https://control.synthetic.invalid/api/onboarding/${name}`, {
        method: "POST", headers, body: JSON.stringify(body),
      }));
      const text = await response.text();
      assert.doesNotMatch(text, /stub_email|stub_sms/, "Legacy fake delivery must never be returned");
      return { status: response.status, body: JSON.parse(text) };
    },
  };
}

function assertNoEffects(harness) {
  assert.equal(harness.calls.databaseReads, 0, "Unauthorized request read onboarding tables");
  assert.equal(harness.calls.databaseWrites, 0, "Unauthorized request changed onboarding state");
  assert.equal(harness.calls.providers.length, 0, "Unauthorized request contacted a provider");
}

function assertNotVerified(harness, channel) {
  assert.notEqual(harness.state()?.[channel === "email" ? "email_verified" : "phone_verified"], true,
    "Rejected/unverified request marked the contact verified");
}

let passed = 0;
async function check(label, run) {
  await run();
  passed += 1;
  console.log(`PASS ${label}`);
}

async function main() {
  for (const name of routeNames) {
    await check(`${name}: missing identity is rejected without effects`, async () => {
      const harness = createHarness({ verifyProvider: true });
      const result = await harness.invoke(name, { ...profile, code: approvedProviderCode }, "none");
      assert.equal(result.status, 401);
      assert.match(result.body.error, /not authenticated/i);
      assertNoEffects(harness);
    });
    await check(`${name}: invalid bearer cannot fall back to valid cookie`, async () => {
      const harness = createHarness({ verifyProvider: true, cookieUser: true });
      const result = await harness.invoke(name, { ...profile, code: approvedProviderCode }, "invalid");
      assert.equal(result.status, 401);
      assert.equal(harness.calls.bearerAuth, 1);
      assert.equal(harness.calls.cookieAuth, 0);
      assertNoEffects(harness);
    });
  }

  for (const auth of ["bearer", "none"]) {
    await check(`${auth === "bearer" ? "Desktop bearer" : "existing browser cookie"}: both Twilio Verify channels send and verify`, async () => {
      const harness = createHarness({ verifyProvider: true, cookieUser: auth === "none" });
      for (const channel of ["email", "sms"]) {
        const result = await harness.invoke(`send-${channel}-code`, profile, auth);
        assert.equal(result.status, 200);
        assert.equal(result.body.ok, true);
        assert.equal(result.body.delivery, `twilio_verify_${channel}`);
        assertNotVerified(harness, channel);
        const rejected = await harness.invoke(`verify-${channel}-code`, { ...profile, code: "000000" }, auth);
        assert.equal(rejected.status, 400);
        assert.equal(rejected.body.ok, false);
        assertNotVerified(harness, channel);
        const verified = await harness.invoke(`verify-${channel}-code`, { ...profile, code: approvedProviderCode }, auth);
        assert.equal(verified.status, 200);
        assert.equal(verified.body.ok, true);
        assert.equal(harness.state()[channel === "email" ? "email_verified" : "phone_verified"], true);
      }
      assert.equal(harness.database.tables.get("rb_onboarding_codes").length, 0,
        "Twilio Verify must own verification codes on its branch");
      assert.equal(harness.calls.providers.filter((call) => call.path.endsWith("/Verifications")).length, 2);
      assert.equal(harness.calls.providers.filter((call) => call.path.endsWith("/VerificationCheck")).length, 4);
      if (auth === "bearer") assert.equal(harness.calls.cookieAuth, 0, "Desktop bearer unexpectedly requires browser cookies");
    });
  }

  for (const channel of ["email", "sms"]) {
    await check(`${channel}: a different account email is denied before state or delivery`, async () => {
      const harness = createHarness({ verifyProvider: true });
      const result = await harness.invoke(`send-${channel}-code`, { ...profile, email: "other@example.test" });
      assert.equal(result.status, 400);
      assert.match(result.body.error, /match the signed-in account email/i);
      assertNoEffects(harness);
    });
  }

  await check("direct SendGrid email uses stored-code verification while SMS retains Twilio Verify", async () => {
    const harness = createHarness({ verifyProvider: true, directEmail: true });
    const sent = await harness.invoke("send-email-code");
    assert.equal(sent.status, 200);
    assert.equal(sent.body.delivery, "sendgrid_email");
    assert.equal(harness.calls.providers[0].host, "api.sendgrid.com");
    const code = /verification code is (\d{6})/.exec(harness.calls.providers[0].json.content[0].value)?.[1];
    assert.ok(code, "Actual messaging helper did not render the synthetic email code");
    const row = harness.database.tables.get("rb_onboarding_codes")[0];
    assert.equal(row.channel, "email");
    assert.notEqual(row.code_hash, code, "Verification codes must be stored as hashes");
    const wrongCode = code === "000000" ? "000001" : "000000";
    const rejected = await harness.invoke("verify-email-code", { ...profile, code: wrongCode });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.ok, false);
    assertNotVerified(harness, "email");
    const verified = await harness.invoke("verify-email-code", { ...profile, code });
    assert.equal(verified.status, 200);
    assert.equal(harness.state().email_verified, true);
    assert.equal(harness.calls.providers.length, 1, "Direct-email verification unexpectedly called Twilio");
    const sms = await harness.invoke("send-sms-code");
    assert.equal(sms.status, 200);
    assert.equal(sms.body.delivery, "twilio_verify_sms");
    const smsVerified = await harness.invoke("verify-sms-code", { ...profile, code: approvedProviderCode });
    assert.equal(smsVerified.status, 200);
    assert.equal(harness.state().phone_verified, true);
  });

  await check("direct SMS fallback sends the generated code and validates its stored hash", async () => {
    const harness = createHarness({ directSms: true });
    const sent = await harness.invoke("send-sms-code");
    assert.equal(sent.status, 200);
    assert.equal(sent.body.delivery, "twilio_sms");
    const code = /verification code is (\d{6})/.exec(harness.calls.providers[0].form.Body)?.[1];
    assert.ok(code);
    const rejected = await harness.invoke("verify-sms-code", { ...profile, code: code === "000000" ? "000001" : "000000" });
    assert.equal(rejected.status, 400);
    assertNotVerified(harness, "sms");
    const verified = await harness.invoke("verify-sms-code", { ...profile, code });
    assert.equal(verified.status, 200);
    assert.equal(harness.state().phone_verified, true);
    assert.equal(harness.calls.providers.length, 1, "Stored SMS validation must not call the delivery provider");
  });

  for (const channel of ["email", "sms"]) {
    for (const verificationMissingCode of [20404, 60431]) {
      await check(`${channel}: removed verification ${verificationMissingCode} requests a fresh code without verifying`, async () => {
        const harness = createHarness({ verifyProvider: true, verificationMissingCode });
        assert.equal((await harness.invoke(`send-${channel}-code`)).status, 200);
        const result = await harness.invoke(`verify-${channel}-code`, { ...profile, code: approvedProviderCode });
        assert.equal(result.status, 400);
        assert.equal(result.body.ok, false);
        assert.equal(result.body.reason, "verification_expired");
        assert.match(result.body.error, /send a new code/i);
        assert.doesNotMatch(result.body.error, /\/Services\/|not found/i);
        assertNotVerified(harness, channel);
      });
    }
  }

  await check("SendGrid quota exhaustion is a sending-limit error rather than an invalid-key error", async () => {
    const harness = createHarness({ directEmail: true, emailProviderError: { status: 401, message: "Maximum credits exceeded" } });
    const result = await harness.invoke("send-email-code");
    assert.equal(result.status, 503);
    assert.equal(result.body.ok, false);
    assert.equal(result.body.error_code, "email_sending_limit");
    assert.match(result.body.error, /sending allowance/i);
    assert.doesNotMatch(result.body.error, /API key|restart|\.env/i);
    assertNotVerified(harness, "email");
  });

  await check("other SendGrid 401 responses do not assert the key is invalid", async () => {
    const harness = createHarness({ directEmail: true, emailProviderError: { status: 401, message: "Access denied" } });
    const result = await harness.invoke("send-email-code");
    assert.equal(result.status, 503);
    assert.equal(result.body.error_code, "email_provider_rejected");
    assert.doesNotMatch(result.body.error, /API key|restart|\.env/i);
    assertNotVerified(harness, "email");
  });

  for (const channel of ["email", "sms"]) {
    await check(`${channel}: missing provider returns an explicit failure`, async () => {
      const harness = createHarness();
      const result = await harness.invoke(`send-${channel}-code`);
      assert.equal(result.status, 500);
      assert.equal(result.body.ok, false);
      assert.match(result.body.error, /not configured/i);
      assert.equal(harness.calls.providers.length, 0);
      assertNotVerified(harness, channel);
    });
    await check(`${channel}: provider rejection is never reported as sent or verified`, async () => {
      const harness = createHarness({ verifyProvider: true, providerRejected: true });
      const result = await harness.invoke(`send-${channel}-code`);
      assert.equal(result.status, 500);
      assert.equal(result.body.ok, false);
      assert.match(result.body.error, /synthetic provider rejection/i);
      assertNotVerified(harness, channel);
    });
  }

  assert.doesNotMatch(fs.readFileSync(path.join(repositoryRoot, "src", "lib", "onboarding", "messaging.ts"), "utf8"),
    /stub_email|stub_sms/, "Published messaging helper still contains legacy fake-delivery responses");
  console.log(`Desktop verification regression: ${passed} cases passed; real network calls=0; real records=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
