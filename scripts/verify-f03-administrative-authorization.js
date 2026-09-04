const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const repositoryRoot = path.resolve(__dirname, "..");
const issueRoutePath = path.join(repositoryRoot, "src", "app", "api", "desktop", "administrative-authorization", "route.ts");
const verifyRoutePath = path.join(repositoryRoot, "src", "app", "api", "service", "administrative-authorization", "verify", "route.ts");
const grantLibraryPath = path.join(repositoryRoot, "src", "lib", "administrativeAuthorizationGrant.ts");
const boundedJsonPath = path.join(repositoryRoot, "src", "lib", "security", "boundedJsonRequest.ts");
const syntheticTempPrefix = "runbook-f03-control-";

function fail(message) {
  throw new Error(`F03 Control authorization verification failed: ${message}`);
}

function requirePattern(source, label, pattern) {
  if (!pattern.test(source)) fail(`missing ${label}`);
}

function forbidPattern(source, label, pattern) {
  if (pattern.test(source)) fail(`contains forbidden ${label}`);
}

function requireExactSchema(source, schemaName, expected) {
  const declaration = new RegExp(`const\\s+${schemaName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as\\s+const\\s*;`).exec(source);
  if (!declaration) fail(`missing exact ${schemaName} declaration`);
  const fields = [];
  const fieldPattern = /^\s*([a-z0-9_]+)\s*:\s*["'](string|number|boolean)["']\s*,?\s*$/gim;
  let match;
  while ((match = fieldPattern.exec(declaration[1])) !== null) fields.push([match[1], match[2]]);
  const normalizedActual = fields.sort(([left], [right]) => left.localeCompare(right));
  const normalizedExpected = expected.slice().sort(([left], [right]) => left.localeCompare(right));
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    fail(`${schemaName} fields or types changed`);
  }
}

function requireOrderedIssueAuthorizationFlow(source) {
  const firstMembership = source.indexOf("await requireActiveAdministrativeMembership(admin, shopId, user.id)");
  const limiter = source.indexOf("rateLimitOrThrow(", firstMembership + 1);
  const password = source.indexOf(".auth.signInWithPassword(", limiter + 1);
  const secondMembership = source.indexOf(
    "await requireActiveAdministrativeMembership(admin, shopId, user.id)",
    firstMembership + 1,
  );
  const issue = source.indexOf("issueAdministrativeAuthorizationGrant(", secondMembership + 1);
  if (
    firstMembership < 0 ||
    limiter < firstMembership ||
    password < limiter ||
    secondMembership < password ||
    issue < secondMembership
  ) {
    fail("fresh authentication is not enclosed by exact active-membership checks");
  }
}

function loadCommonJsWithMocks(modulePath, mocks) {
  const originalLoad = Module._load;
  try {
    Module._load = function loadWithSyntheticMocks(request, parent, isMain) {
      if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
      return originalLoad.call(this, request, parent, isMain);
    };
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

function createValidatedSyntheticTempDirectory() {
  const tempRoot = path.resolve(os.tmpdir());
  const directory = path.resolve(fs.mkdtempSync(path.join(tempRoot, syntheticTempPrefix)));
  if (path.dirname(directory) !== tempRoot || !path.basename(directory).startsWith(syntheticTempPrefix)) {
    fail("synthetic transpilation directory escaped the operating-system temp directory");
  }
  return { directory, files: [] };
}

function transpileForNode20(sourcePath, outputName, syntheticDirectory) {
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
      getCurrentDirectory: () => repositoryRoot,
      getNewLine: () => "\n",
    }));
  }

  const outputPath = path.resolve(syntheticDirectory.directory, outputName);
  if (path.dirname(outputPath) !== syntheticDirectory.directory) {
    fail("synthetic transpilation output escaped its validated directory");
  }
  fs.writeFileSync(outputPath, result.outputText, { encoding: "utf8", flag: "wx" });
  syntheticDirectory.files.push(outputPath);
  return outputPath;
}

function removeValidatedSyntheticTempDirectory(syntheticDirectory) {
  const tempRoot = path.resolve(os.tmpdir());
  const directory = path.resolve(syntheticDirectory.directory);
  if (path.dirname(directory) !== tempRoot || !path.basename(directory).startsWith(syntheticTempPrefix)) {
    fail("refused to clean an unvalidated synthetic directory");
  }
  for (const filePath of syntheticDirectory.files) {
    const resolvedFile = path.resolve(filePath);
    if (path.dirname(resolvedFile) !== directory) fail("refused to clean an unvalidated synthetic file");
    if (fs.existsSync(resolvedFile)) fs.unlinkSync(resolvedFile);
  }
  fs.rmdirSync(directory);
}

function syntheticJsonRequest(bytesOrText, options = {}) {
  const body = typeof bytesOrText === "string"
    ? new TextEncoder().encode(bytesOrText)
    : bytesOrText;
  const headers = new Headers({
    "content-type": options.contentType ?? "application/json; charset=utf-8",
  });
  if (options.contentEncoding) headers.set("content-encoding", options.contentEncoding);
  if (options.declaredLength !== undefined) {
    headers.set("content-length", String(options.declaredLength));
  }
  return new Request("https://control.example.test/synthetic", {
    method: "POST",
    headers,
    body,
  });
}

async function requireRejected(label, action, expectedStatus) {
  try {
    await action();
  } catch (error) {
    if (expectedStatus !== undefined && error?.status !== expectedStatus) {
      fail(`${label} returned status ${String(error?.status)} instead of ${expectedStatus}`);
    }
    return;
  }
  fail(`${label} was accepted`);
}

function requireExactObject(label, actual, expected) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
    fail(`${label} was not an object`);
  }
  const actualNames = Object.keys(actual).sort();
  const expectedNames = Object.keys(expected).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    fail(
      `${label} fields changed (actual=${JSON.stringify(actualNames)}, expected=${JSON.stringify(expectedNames)})`,
    );
  }
  for (const name of expectedNames) {
    if (JSON.stringify(actual[name]) !== JSON.stringify(expected[name])) {
      fail(
        `${label}.${name} changed (actual=${JSON.stringify(actual[name])}, expected=${JSON.stringify(expected[name])})`,
      );
    }
  }
}

async function main() {
  for (const filePath of [issueRoutePath, verifyRoutePath, grantLibraryPath, boundedJsonPath]) {
    if (!fs.existsSync(filePath)) fail(`required source is missing: ${path.relative(repositoryRoot, filePath)}`);
  }

  const issueSource = fs.readFileSync(issueRoutePath, "utf8");
  const verifySource = fs.readFileSync(verifyRoutePath, "utf8");
  const grantSource = fs.readFileSync(grantLibraryPath, "utf8");
  const boundedJsonSource = fs.readFileSync(boundedJsonPath, "utf8");

  for (const [label, pattern] of [
    ["POST-only issue route", /export\s+async\s+function\s+POST\s*\(/],
    ["bearer session authentication", /requireSessionUser\s*\(\s*req\s*\)/],
    ["fresh password authentication", /auth\.signInWithPassword\s*\(/],
    ["bearer and fresh identity match", /freshAuthentication\.data\.user\.id\s*!==\s*user\.id/],
    ["bounded password", /password\.length\s*>\s*128/],
    ["authorization UUID validation", /assertUuid\s*\(\s*["']authorization_id["']\s*,\s*authorizationId\s*\)/],
    ["shop UUID validation", /assertUuid\s*\(\s*["']shop_id["']\s*,\s*shopId\s*\)/],
    ["target-bound grant issue", /issueAdministrativeAuthorizationGrant\s*\(/],
    ["active membership helper", /async\s+function\s+requireActiveAdministrativeMembership\s*\(/],
    ["membership table", /\.from\s*\(\s*["']rb_shop_members["']\s*\)/],
    ["exact shop binding", /\.eq\s*\(\s*["']shop_id["']\s*,\s*shopId\s*\)/],
    ["authenticated user binding", /\.eq\s*\(\s*["']user_id["']\s*,\s*userId\s*\)/],
    ["active membership binding", /\.eq\s*\(\s*["']is_active["']\s*,\s*true\s*\)/],
    ["owner role", /role\s*!==\s*["']owner["']/],
    ["administrator role", /role\s*!==\s*["']admin["']/],
    ["signed Int32 work-order cap", /workOrderId\s*>\s*MAXIMUM_ADMINISTRATIVE_TARGET_ID/],
    ["signed Int32 operation cap", /operationId\s*>\s*MAXIMUM_ADMINISTRATIVE_TARGET_ID/],
    ["bounded exact JSON reader", /readBoundedExactJsonObject\s*\(\s*req\s*,\s*ISSUE_REQUEST_SCHEMA\s*\)/],
    ["per-user and shop throttle", /f03:administrative-authorization:\$\{user\.id\.toLowerCase\(\)\}:\$\{shopId\.toLowerCase\(\)\}/],
    ["rate-limit status", /rate limit exceeded[\s\S]{0,100}\?\s*429/i],
    ["deployed Auth rate-limit gate", /Production rollout must separately verify the deployed Supabase Auth sign-in rate limits/],
    ["no-store issue response", /Cache-Control["']?\s*:\s*["']no-store, max-age=0["']/],
  ]) requirePattern(issueSource, label, pattern);

  for (const [label, pattern] of [
    ["GET authorization route", /export\s+async\s+function\s+GET\s*\(/],
    ["Host-header authorization", /headers\.get\s*\(\s*["']host["']\s*\)/i],
    ["development bypass", /localDev|developmentBypass|allowLocal/i],
    ["platform-admin bypass", /isPlatformAdmin|requireDesktopShopAdmin/],
    ["database mutation", /\.(?:insert|update|upsert|delete)\s*\(/],
    ["employee-table access", /\.from\s*\(\s*["']employees["']\s*\)/],
    ["password in success response", /ok\s*:\s*true[\s\S]{0,300}password\s*:/i],
    ["unbounded request JSON buffering", /req\.json\s*\(/],
  ]) forbidPattern(issueSource, label, pattern);
  requireOrderedIssueAuthorizationFlow(issueSource);

  for (const [label, pattern] of [
    ["POST-only verify route", /export\s+async\s+function\s+POST\s*\(/],
    ["cryptographic grant verification", /verifyAdministrativeAuthorizationGrant\s*\(/],
    ["exact fixed scope", /scope\s*!==\s*ADMINISTRATIVE_COMPLETION_SCOPE/],
    ["authorization UUID verification", /assertUuid\s*\(\s*["']authorization_id["']\s*,\s*authorizationId\s*\)/],
    ["shop UUID verification", /assertUuid\s*\(\s*["']shop_id["']\s*,\s*shopId\s*\)/],
    ["signed Int32 work-order cap", /workOrderId\s*>\s*MAXIMUM_ADMINISTRATIVE_TARGET_ID/],
    ["signed Int32 operation cap", /operationId\s*>\s*MAXIMUM_ADMINISTRATIVE_TARGET_ID/],
    ["bounded exact JSON reader", /readBoundedExactJsonObject\s*\(\s*req\s*,\s*VERIFY_REQUEST_SCHEMA\s*\)/],
    ["no-store verify response", /Cache-Control["']?\s*:\s*["']no-store, max-age=0["']/],
  ]) requirePattern(verifySource, label, pattern);

  for (const [label, pattern] of [
    ["database access in grant verification", /supabase|\.from\s*\(/i],
    ["password in grant verification", /password/i],
    ["GET grant verification", /export\s+async\s+function\s+GET\s*\(/],
    ["unbounded request JSON buffering", /req\.json\s*\(/],
  ]) forbidPattern(verifySource, label, pattern);

  requireExactSchema(issueSource, "ISSUE_REQUEST_SCHEMA", [
    ["authorization_id", "string"],
    ["shop_id", "string"],
    ["scope", "string"],
    ["work_order_id", "number"],
    ["operation_id", "number"],
    ["reason", "string"],
    ["password", "string"],
  ]);
  requireExactSchema(verifySource, "VERIFY_REQUEST_SCHEMA", [
    ["grant", "string"],
    ["authorization_id", "string"],
    ["shop_id", "string"],
    ["scope", "string"],
    ["work_order_id", "number"],
    ["operation_id", "number"],
    ["reason", "string"],
  ]);

  for (const [label, pattern] of [
    ["dedicated signing secret", /RUNBOOK_ADMIN_AUTHORIZATION_SIGNING_SECRET/],
    ["minimum signing-key length", /Buffer\.byteLength\([\s\S]*?<\s*32/],
    ["HMAC-SHA256", /createHmac\s*\(\s*["']sha256["']/],
    ["constant-time signature comparison", /timingSafeEqual\s*\(/],
    ["unpadded base64url alphabet", /UNPADDED_BASE64URL_PATTERN/],
    ["canonical base64url round trip", /decoded\.toString\s*\(\s*["']base64url["']\s*\)\s*!==\s*segment/],
    ["no silent grant whitespace normalization", /suppliedGrant\s*!==\s*suppliedGrant\.trim\(\)/],
    ["reason digest", /createHash\s*\(\s*["']sha256["']/],
    ["fixed audience", /runbook-service-administrative-completion/],
    ["bounded lifetime", /ADMINISTRATIVE_GRANT_LIFETIME_SECONDS\s*=\s*120/],
    ["signed Int32 maximum", /MAXIMUM_ADMINISTRATIVE_TARGET_ID\s*=\s*2_147_483_647/],
    ["target maximum enforcement", /value\s*>\s*MAXIMUM_ADMINISTRATIVE_TARGET_ID/],
    ["reason surrogate rejection", /assertNoUnpairedUtf16Surrogates\s*\(\s*normalized\s*\)/],
    ["exclusive grant expiry", /now\.getTime\(\)\s*>=\s*expiresMs/],
  ]) requirePattern(grantSource, label, pattern);
  forbidPattern(grantSource, "service-role-key signing fallback", /SUPABASE_SERVICE_ROLE_KEY/);

  for (const [label, pattern] of [
    ["16 KiB request cap", /MAXIMUM_SECURITY_JSON_REQUEST_BYTES\s*=\s*16\s*\*\s*1024/],
    ["streaming request reader", /req\.body\.getReader\s*\(\s*\)/],
    ["strict UTF-8 decoder", /new\s+TextDecoder\s*\(\s*["']utf-8["']\s*,\s*\{\s*fatal:\s*true\s*\}\s*\)/],
    ["declared-length equality", /total\s*!==\s*declaredLength/],
    ["duplicate-field rejection", /contains a duplicate field/],
    ["exact schema rejection", /rawNames\.some/],
    ["recursive surrogate validation", /validateParsedUnicode\s*\(\s*parsed\s*\)/],
  ]) requirePattern(boundedJsonSource, label, pattern);

  process.env.RUNBOOK_ADMIN_AUTHORIZATION_SIGNING_SECRET =
    "synthetic-f03-signing-key-that-is-never-used-outside-tests";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-anon-key";
  const syntheticDirectory = createValidatedSyntheticTempDirectory();
  try {
    const grantModulePath = transpileForNode20(
      grantLibraryPath,
      "administrativeAuthorizationGrant.js",
      syntheticDirectory,
    );
    const boundedJsonModulePath = transpileForNode20(
      boundedJsonPath,
      "boundedJsonRequest.js",
      syntheticDirectory,
    );
    const issueRouteModulePath = transpileForNode20(
      issueRoutePath,
      "issueAdministrativeAuthorizationRoute.js",
      syntheticDirectory,
    );
    const verifyRouteModulePath = transpileForNode20(
      verifyRoutePath,
      "verifyAdministrativeAuthorizationRoute.js",
      syntheticDirectory,
    );
    const grants = require(grantModulePath);
    const boundedJson = require(boundedJsonModulePath);

    const now = new Date("2030-04-05T12:30:00.000Z");
    const target = {
      authorizationId: "11111111-1111-4111-8111-111111111111",
      shopId: "22222222-2222-4222-8222-222222222222",
      workOrderId: 101,
      operationId: 201,
      reason: "Synthetic administrative completion reason",
    };
    const issued = grants.issueAdministrativeAuthorizationGrant(
      target,
      { userId: "33333333-3333-4333-8333-333333333333", role: "admin" },
      now,
    );
    const verified = grants.verifyAdministrativeAuthorizationGrant(
      issued.grant,
      target,
      new Date(now.getTime() + 30_000),
    );
    if (verified.authorization_id !== target.authorizationId || verified.work_order_id !== 101) {
      fail("valid synthetic grant did not preserve its exact target");
    }

    const maximumTarget = {
      ...target,
      workOrderId: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID,
      operationId: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID,
    };
    const maximumIssued = grants.issueAdministrativeAuthorizationGrant(
      maximumTarget,
      { userId: "33333333-3333-4333-8333-333333333333", role: "owner" },
      now,
    );
    grants.verifyAdministrativeAuthorizationGrant(
      maximumIssued.grant,
      maximumTarget,
      new Date(now.getTime() + 30_000),
    );
    await requireRejected(
      "work-order target above signed Int32 maximum",
      () => grants.issueAdministrativeAuthorizationGrant(
        { ...target, workOrderId: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID + 1 },
        { userId: "33333333-3333-4333-8333-333333333333", role: "admin" },
        now,
      ),
    );
    await requireRejected(
      "operation target above signed Int32 maximum",
      () => grants.issueAdministrativeAuthorizationGrant(
        { ...target, operationId: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID + 1 },
        { userId: "33333333-3333-4333-8333-333333333333", role: "admin" },
        now,
      ),
    );

    const pairedSurrogateTarget = {
      ...target,
      reason: "Synthetic paired \ud83d\ude80 reason",
    };
    const pairedSurrogateIssued = grants.issueAdministrativeAuthorizationGrant(
      pairedSurrogateTarget,
      { userId: "33333333-3333-4333-8333-333333333333", role: "admin" },
      now,
    );
    grants.verifyAdministrativeAuthorizationGrant(
      pairedSurrogateIssued.grant,
      pairedSurrogateTarget,
      new Date(now.getTime() + 30_000),
    );
    await requireRejected(
      "lone high-surrogate reason issue",
      () => grants.issueAdministrativeAuthorizationGrant(
        { ...target, reason: "Synthetic lone \ud800 reason" },
        { userId: "33333333-3333-4333-8333-333333333333", role: "admin" },
        now,
      ),
    );
    await requireRejected(
      "lone low-surrogate reason issue",
      () => grants.issueAdministrativeAuthorizationGrant(
        { ...target, reason: "Synthetic lone \udc00 reason" },
        { userId: "33333333-3333-4333-8333-333333333333", role: "admin" },
        now,
      ),
    );
    const replacementCharacterTarget = { ...target, reason: "Synthetic replacement \ufffd reason" };
    const replacementCharacterIssued = grants.issueAdministrativeAuthorizationGrant(
      replacementCharacterTarget,
      { userId: "33333333-3333-4333-8333-333333333333", role: "admin" },
      now,
    );
    await requireRejected(
      "replacement-character and lone-surrogate reason collision",
      () => grants.verifyAdministrativeAuthorizationGrant(
        replacementCharacterIssued.grant,
        { ...replacementCharacterTarget, reason: "Synthetic replacement \ud800 reason" },
        new Date(now.getTime() + 30_000),
      ),
    );

    const [payloadSegment, signatureSegment] = issued.grant.split(".");
    const decodedPayload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
    for (const forbiddenField of ["password", "bearer", "access_token", "email"]) {
      if (Object.prototype.hasOwnProperty.call(decodedPayload, forbiddenField)) fail(`grant payload contains ${forbiddenField}`);
    }

    const changedSignatureFirstCharacter = signatureSegment[0] === "A" ? "B" : "A";
    for (const [label, changedTarget, verificationTime, changedGrant] of [
      ["different authorization", { ...target, authorizationId: "55555555-5555-4555-8555-555555555555" }, new Date(now.getTime() + 30_000), issued.grant],
      ["different work order", { ...target, workOrderId: 102 }, new Date(now.getTime() + 30_000), issued.grant],
      ["different operation", { ...target, operationId: 202 }, new Date(now.getTime() + 30_000), issued.grant],
      ["different shop", { ...target, shopId: "44444444-4444-4444-8444-444444444444" }, new Date(now.getTime() + 30_000), issued.grant],
      ["different reason", { ...target, reason: "Synthetic changed completion reason" }, new Date(now.getTime() + 30_000), issued.grant],
      ["grant at exact expiry", target, new Date(now.getTime() + 120_000), issued.grant],
      ["future grant", target, new Date(now.getTime() - 31_000), issued.grant],
      ["tampered signature", target, new Date(now.getTime() + 30_000), `${payloadSegment}.${changedSignatureFirstCharacter}${signatureSegment.slice(1)}`],
      ["padded signature", target, new Date(now.getTime() + 30_000), `${issued.grant}=`],
      ["invalid signature character", target, new Date(now.getTime() + 30_000), `${issued.grant}!`],
      ["leading grant whitespace", target, new Date(now.getTime() + 30_000), ` ${issued.grant}`],
      ["trailing grant whitespace", target, new Date(now.getTime() + 30_000), `${issued.grant} `],
    ]) {
      await requireRejected(
        label,
        () => grants.verifyAdministrativeAuthorizationGrant(changedGrant, changedTarget, verificationTime),
      );
    }

    const requestSchema = { grant: "string", count: "number" };
    const validJson = '{"\\u0067rant":"synthetic-grant","count":1}';
    const validBytes = new TextEncoder().encode(validJson);
    const parsed = await boundedJson.readBoundedExactJsonObject(
      syntheticJsonRequest(validBytes, { declaredLength: validBytes.byteLength }),
      requestSchema,
    );
    if (parsed.grant !== "synthetic-grant" || parsed.count !== 1) {
      fail("bounded exact JSON reader changed a valid synthetic request");
    }
    const pairedUnicode = await boundedJson.readBoundedExactJsonObject(
      syntheticJsonRequest('{"grant":"Synthetic \\ud83d\\ude80","count":1}'),
      requestSchema,
    );
    if (pairedUnicode.grant !== "Synthetic \ud83d\ude80") {
      fail("bounded exact JSON reader rejected or changed a valid surrogate pair");
    }

    await requireRejected(
      "declared oversized JSON request",
      () => boundedJson.readBoundedExactJsonObject(
        syntheticJsonRequest("{}", {
          declaredLength: boundedJson.MAXIMUM_SECURITY_JSON_REQUEST_BYTES + 1,
        }),
        requestSchema,
      ),
      413,
    );
    await requireRejected(
      "streamed oversized JSON request",
      () => boundedJson.readBoundedExactJsonObject(
        syntheticJsonRequest(new Uint8Array(boundedJson.MAXIMUM_SECURITY_JSON_REQUEST_BYTES + 1).fill(0x20)),
        requestSchema,
      ),
      413,
    );
    await requireRejected(
      "dishonest JSON Content-Length",
      () => boundedJson.readBoundedExactJsonObject(
        syntheticJsonRequest("{}", { declaredLength: 1 }),
        requestSchema,
      ),
      400,
    );
    await requireRejected(
      "malformed UTF-8 JSON request",
      () => boundedJson.readBoundedExactJsonObject(
        syntheticJsonRequest(Uint8Array.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x3a, 0x31, 0x7d])),
        requestSchema,
      ),
      400,
    );
    await requireRejected(
      "non-UTF-8 JSON charset",
      () => boundedJson.readBoundedExactJsonObject(
        syntheticJsonRequest(validJson, { contentType: "application/json; charset=iso-8859-1" }),
        requestSchema,
      ),
      415,
    );
    await requireRejected(
      "malformed quoted JSON charset",
      () => boundedJson.readBoundedExactJsonObject(
        syntheticJsonRequest(validJson, { contentType: 'application/json; charset="utf-8' }),
        requestSchema,
      ),
      415,
    );
    await requireRejected(
      "non-JSON Content-Type",
      () => boundedJson.readBoundedExactJsonObject(
        syntheticJsonRequest(validJson, { contentType: "text/plain; charset=utf-8" }),
        requestSchema,
      ),
      415,
    );
    await requireRejected(
      "encoded JSON body",
      () => boundedJson.readBoundedExactJsonObject(
        syntheticJsonRequest(validJson, { contentEncoding: "gzip" }),
        requestSchema,
      ),
      415,
    );
    for (const [label, json] of [
      ["escaped lone high surrogate", '{"grant":"Synthetic \\ud800","count":1}'],
      ["escaped lone low surrogate", '{"grant":"Synthetic \\udc00","count":1}'],
      ["duplicate JSON field", '{"grant":"first","\\u0067rant":"second","count":1}'],
      ["unknown JSON field", '{"grant":"synthetic","count":1,"extra":true}'],
      ["missing JSON field", '{"grant":"synthetic"}'],
      ["wrong JSON field type", '{"grant":"synthetic","count":"1"}'],
    ]) {
      await requireRejected(
        label,
        () => boundedJson.readBoundedExactJsonObject(syntheticJsonRequest(json), requestSchema),
        400,
      );
    }

    const syntheticUserId = "66666666-6666-4666-8666-666666666666";
    const syntheticShopId = "77777777-7777-4777-8777-777777777777";
    const syntheticAuthorizationId = "88888888-8888-4888-8888-888888888888";
    const syntheticEmail = "synthetic@example.test";
    const syntheticPassword = "synthetic-password";
    const routeState = {
      membershipResponses: [],
      membershipQueries: [],
      events: [],
      freshAuthentication: null,
      throwLocalRateLimit: false,
      signInCalls: [],
      limiterCalls: [],
      issuedTarget: null,
      issuedPrincipal: null,
      issuedGrant: null,
    };
    const activeMembership = (role = "admin") => ({
      data: { id: "synthetic-membership", role },
      error: null,
    });
    const resetRouteState = (membershipResponses) => {
      routeState.membershipResponses = membershipResponses.slice();
      routeState.membershipQueries = [];
      routeState.events = [];
      routeState.freshAuthentication = {
        data: { user: { id: syntheticUserId } },
        error: null,
      };
      routeState.throwLocalRateLimit = false;
      routeState.signInCalls = [];
      routeState.limiterCalls = [];
      routeState.issuedTarget = null;
      routeState.issuedPrincipal = null;
      routeState.issuedGrant = null;
    };
    const jsonResponse = (body, init = {}) => new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init.headers ?? {}),
      },
    });
    const assertSyntheticUuid = (label, value) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error(`${label} must be a UUID.`);
      }
    };
    const adminClient = {
      from(table) {
        if (table !== "rb_shop_members") throw new Error("unexpected synthetic table");
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
            routeState.events.push("membership");
            routeState.membershipQueries.push({
              table: query.table,
              select: query.select,
              predicates: query.predicates.map((predicate) => predicate.slice()),
            });
            const response = routeState.membershipResponses.shift();
            if (!response) throw new Error("missing synthetic membership response");
            return response;
          },
        };
        return builder;
      },
    };
    const issueRoute = loadCommonJsWithMocks(issueRouteModulePath, {
      "next/server": { NextResponse: { json: jsonResponse } },
      "@supabase/supabase-js": {
        createClient: () => ({
          auth: {
            async signInWithPassword(credentials) {
              routeState.events.push("password");
              routeState.signInCalls.push(
                credentials && typeof credentials === "object" ? { ...credentials } : credentials,
              );
              if (
                credentials?.email !== syntheticEmail ||
                credentials?.password !== syntheticPassword
              ) {
                return {
                  data: { user: null },
                  error: { status: 400, message: "Synthetic credentials were rejected." },
                };
              }
              return routeState.freshAuthentication;
            },
          },
        }),
      },
      "@/lib/authz": { assertUuid: assertSyntheticUuid },
      "@/lib/desktopAuth": {
        requireSessionUser: async () => ({
          user: { id: syntheticUserId, email: syntheticEmail },
        }),
      },
      "@/lib/supabase/admin": { supabaseAdmin: () => adminClient },
      "@/lib/security/boundedJsonRequest": boundedJson,
      "@/lib/security/rateLimit": {
        rateLimitOrThrow: (options) => {
          routeState.events.push("limit");
          routeState.limiterCalls.push(
            options && typeof options === "object" ? { ...options } : options,
          );
          if (routeState.throwLocalRateLimit) throw new Error("Rate limit exceeded. Try again later.");
        },
      },
      "@/lib/administrativeAuthorizationGrant": {
        ADMINISTRATIVE_COMPLETION_SCOPE: grants.ADMINISTRATIVE_COMPLETION_SCOPE,
        MAXIMUM_ADMINISTRATIVE_TARGET_ID: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID,
        issueAdministrativeAuthorizationGrant: (targetToIssue, principal) => {
          routeState.events.push("issue");
          routeState.issuedTarget = { ...targetToIssue };
          routeState.issuedPrincipal = { ...principal };
          routeState.issuedGrant = grants.issueAdministrativeAuthorizationGrant(targetToIssue, principal);
          return routeState.issuedGrant;
        },
      },
    });
    const issueRequest = (overrides = {}) => syntheticJsonRequest(JSON.stringify({
      authorization_id: syntheticAuthorizationId,
      shop_id: syntheticShopId,
      scope: grants.ADMINISTRATIVE_COMPLETION_SCOPE,
      work_order_id: 101,
      operation_id: 201,
      reason: "Synthetic administrative completion reason",
      password: syntheticPassword,
      ...overrides,
    }));
    const invokeIssueRoute = async (overrides = {}) => {
      const response = await issueRoute.POST(issueRequest(overrides));
      return { response, body: await response.json() };
    };

    resetRouteState([activeMembership("admin"), activeMembership("owner")]);
    const successfulIssue = await invokeIssueRoute();
    if (
      successfulIssue.response.status !== 200 ||
      successfulIssue.body.ok !== true ||
      routeState.events.join(",") !== "membership,limit,password,membership,issue" ||
      routeState.issuedPrincipal?.role !== "owner"
    ) {
      fail(
        `issue route did not re-check and use the latest active membership after fresh authentication ` +
        `(status=${successfulIssue.response.status}, events=${routeState.events.join(",")}, role=${String(routeState.issuedPrincipal?.role)})`,
      );
    }
    const expectedIssueTarget = {
      authorizationId: syntheticAuthorizationId,
      shopId: syntheticShopId,
      workOrderId: 101,
      operationId: 201,
      reason: "Synthetic administrative completion reason",
    };
    const expectedMembershipQuery = {
      table: "rb_shop_members",
      select: "id,role",
      predicates: [
        ["shop_id", syntheticShopId],
        ["user_id", syntheticUserId],
        ["is_active", true],
      ],
    };
    if (routeState.membershipQueries.length !== 2) {
      fail(`successful issue performed ${routeState.membershipQueries.length} membership queries instead of 2`);
    }
    for (const [index, query] of routeState.membershipQueries.entries()) {
      requireExactObject(`membership query ${index + 1}`, query, expectedMembershipQuery);
    }
    if (routeState.signInCalls.length !== 1) {
      fail(`successful issue performed ${routeState.signInCalls.length} password calls instead of 1`);
    }
    requireExactObject("fresh password credentials", routeState.signInCalls[0], {
      email: syntheticEmail,
      password: syntheticPassword,
    });
    if (routeState.limiterCalls.length !== 1) {
      fail(`successful issue performed ${routeState.limiterCalls.length} limiter calls instead of 1`);
    }
    requireExactObject("issuance limiter", routeState.limiterCalls[0], {
      key: `f03:administrative-authorization:${syntheticUserId}:${syntheticShopId}`,
      limit: 10,
      windowMs: 300_000,
    });
    requireExactObject("issued grant target", routeState.issuedTarget, expectedIssueTarget);
    requireExactObject("issued grant principal", routeState.issuedPrincipal, {
      userId: syntheticUserId,
      role: "owner",
    });
    requireExactObject("issue route success response", successfulIssue.body, {
      ok: true,
      grant: routeState.issuedGrant.grant,
      expires_utc: routeState.issuedGrant.claims.expires_utc,
    });
    const successfulIssueClaims = grants.verifyAdministrativeAuthorizationGrant(
      successfulIssue.body.grant,
      expectedIssueTarget,
      new Date(),
    );
    if (
      successfulIssueClaims.authorization_id !== syntheticAuthorizationId ||
      successfulIssueClaims.shop_id !== syntheticShopId ||
      successfulIssueClaims.user_id !== syntheticUserId ||
      successfulIssueClaims.role !== "owner" ||
      successfulIssueClaims.work_order_id !== expectedIssueTarget.workOrderId ||
      successfulIssueClaims.operation_id !== expectedIssueTarget.operationId
    ) {
      fail("issued grant did not preserve the exact target and post-authentication principal");
    }

    resetRouteState([activeMembership("admin"), { data: null, error: null }]);
    const revokedIssue = await invokeIssueRoute();
    if (
      revokedIssue.response.status !== 403 ||
      routeState.events.join(",") !== "membership,limit,password,membership"
    ) {
      fail("issue route did not fail closed when membership was revoked after fresh authentication");
    }

    resetRouteState([activeMembership("admin"), { data: null, error: { message: "synthetic unavailable" } }]);
    const unavailableRecheck = await invokeIssueRoute();
    if (
      unavailableRecheck.response.status !== 503 ||
      routeState.events.join(",") !== "membership,limit,password,membership"
    ) {
      fail("issue route did not fail closed when the final membership check was unavailable");
    }

    resetRouteState([activeMembership("admin")]);
    routeState.throwLocalRateLimit = true;
    const locallyRateLimited = await invokeIssueRoute();
    if (locallyRateLimited.response.status !== 429 || routeState.events.join(",") !== "membership,limit") {
      fail("issue route did not classify the local issuance throttle as 429");
    }

    resetRouteState([activeMembership("admin")]);
    routeState.freshAuthentication = { data: { user: null }, error: { status: 429 } };
    const upstreamRateLimited = await invokeIssueRoute();
    if (upstreamRateLimited.response.status !== 429 || routeState.events.join(",") !== "membership,limit,password") {
      fail("issue route did not classify the Supabase Auth throttle as 429");
    }

    resetRouteState([activeMembership("admin")]);
    const wrongPasswordIssue = await invokeIssueRoute({ password: "wrong-synthetic-password" });
    if (
      wrongPasswordIssue.response.status !== 401 ||
      routeState.events.join(",") !== "membership,limit,password" ||
      routeState.membershipQueries.length !== 1 ||
      routeState.issuedGrant !== null
    ) {
      fail("issue route did not reject a wrong password before the post-authentication membership check");
    }

    resetRouteState([activeMembership("admin")]);
    routeState.freshAuthentication = {
      data: { user: { id: "99999999-9999-4999-8999-999999999999" } },
      error: null,
    };
    const wrongUserIssue = await invokeIssueRoute();
    if (
      wrongUserIssue.response.status !== 401 ||
      routeState.events.join(",") !== "membership,limit,password" ||
      routeState.membershipQueries.length !== 1 ||
      routeState.issuedGrant !== null
    ) {
      fail("issue route did not reject a fresh authentication for a different user");
    }

    resetRouteState([]);
    const oversizedRouteTarget = await invokeIssueRoute({
      work_order_id: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID + 1,
    });
    if (oversizedRouteTarget.response.status !== 400 || routeState.events.length !== 0) {
      fail("issue route allowed a target above the signed Int32 maximum to reach authorization");
    }

    resetRouteState([]);
    const invalidRouteUnicode = await invokeIssueRoute({ reason: "Synthetic lone \ud800 reason" });
    if (invalidRouteUnicode.response.status !== 400 || routeState.events.length !== 0) {
      fail("issue route allowed an unpaired surrogate to reach authorization");
    }

    const verifyRoute = loadCommonJsWithMocks(verifyRouteModulePath, {
      "next/server": { NextResponse: { json: jsonResponse } },
      "@/lib/authz": { assertUuid: assertSyntheticUuid },
      "@/lib/security/boundedJsonRequest": boundedJson,
      "@/lib/administrativeAuthorizationGrant": grants,
    });
    const liveNow = new Date();
    const verifyTarget = {
      authorizationId: syntheticAuthorizationId,
      shopId: syntheticShopId,
      workOrderId: 101,
      operationId: 201,
      reason: "Synthetic route verification reason",
    };
    const routeIssued = grants.issueAdministrativeAuthorizationGrant(
      verifyTarget,
      { userId: syntheticUserId, role: "admin" },
      liveNow,
    );
    const routeGrant = routeIssued.grant;
    const verifyRequest = (overrides = {}) => syntheticJsonRequest(JSON.stringify({
      grant: routeGrant,
      authorization_id: verifyTarget.authorizationId,
      shop_id: verifyTarget.shopId,
      scope: grants.ADMINISTRATIVE_COMPLETION_SCOPE,
      work_order_id: verifyTarget.workOrderId,
      operation_id: verifyTarget.operationId,
      reason: verifyTarget.reason,
      ...overrides,
    }));
    const successfulVerification = await verifyRoute.POST(verifyRequest());
    const successfulVerificationBody = await successfulVerification.json();
    if (successfulVerification.status !== 200) {
      fail("verification route rejected a valid exact synthetic request");
    }
    requireExactObject("verify route success response", successfulVerificationBody, {
      ok: true,
      authorization_id: verifyTarget.authorizationId,
      shop_id: verifyTarget.shopId,
      scope: grants.ADMINISTRATIVE_COMPLETION_SCOPE,
      work_order_id: verifyTarget.workOrderId,
      operation_id: verifyTarget.operationId,
      reason: verifyTarget.reason,
      user_id: syntheticUserId,
      role: "admin",
      authenticated_utc: routeIssued.claims.authenticated_utc,
      expires_utc: routeIssued.claims.expires_utc,
    });
    for (const [label, overrides] of [
      ["swapped authorization and shop identifiers", {
        authorization_id: verifyTarget.shopId,
        shop_id: verifyTarget.authorizationId,
      }],
      ["changed work order", { work_order_id: verifyTarget.workOrderId + 1 }],
      ["changed operation", { operation_id: verifyTarget.operationId + 1 }],
      ["changed reason", { reason: "Synthetic changed route verification reason" }],
    ]) {
      const changedVerification = await verifyRoute.POST(verifyRequest(overrides));
      if (changedVerification.status !== 403) {
        fail(`verification route accepted ${label}`);
      }
    }
    const paddedVerification = await verifyRoute.POST(verifyRequest({ grant: `${routeGrant}=` }));
    if (paddedVerification.status !== 403) {
      fail("verification route accepted a noncanonical grant");
    }
    const oversizedVerification = await verifyRoute.POST(verifyRequest({
      operation_id: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID + 1,
    }));
    if (oversizedVerification.status !== 400) {
      fail("verification route accepted a target above the signed Int32 maximum");
    }
  } finally {
    removeValidatedSyntheticTempDirectory(syntheticDirectory);
  }

  console.log(
    "F03 Control authorization verification passed: bounded scalar-valid UTF-8 requests; canonical unpadded HMAC grants; signed-Int32 targets; post-password active-membership recheck; exclusive expiry and collision-safe reason binding.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
