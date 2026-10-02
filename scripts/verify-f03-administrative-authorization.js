const fs = require("node:fs");
const Module = require("node:module");
const { createHmac } = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const repositoryRoot = path.resolve(__dirname, "..");
const issueRoutePath = path.join(repositoryRoot, "src", "app", "api", "desktop", "administrative-authorization", "route.ts");
const verifyRoutePath = path.join(repositoryRoot, "src", "app", "api", "service", "administrative-authorization", "verify", "route.ts");
const grantLibraryPath = path.join(repositoryRoot, "src", "lib", "administrativeAuthorizationGrant.ts");
const authorityLibraryPath = path.join(repositoryRoot, "src", "lib", "administrativeCompletionAuthority.ts");
const directoryRoutePath = path.join(repositoryRoot, "src", "app", "api", "desktop", "employee-directory", "route.ts");
const assignmentRoutePath = path.join(repositoryRoot, "src", "app", "api", "admin", "users", "administrative-completion", "route.ts");
const adminListRoutePath = path.join(repositoryRoot, "src", "app", "api", "admin", "users", "list", "route.ts");
const userDrawerPath = path.join(repositoryRoot, "src", "components", "shops", "ShopUserDrawer.tsx");
const migrationPath = path.join(repositoryRoot, "supabase", "migrations", "20260906120000_administrative_completion_employee_authority.sql");
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
  const firstMembership = source.indexOf("await resolveAdministrativeCompletionAuthority(");
  const limiter = source.indexOf("rateLimitOrThrow(", firstMembership + 1);
  const password = source.indexOf(".auth.signInWithPassword(", limiter + 1);
  const secondMembership = source.indexOf(
    "await resolveAdministrativeCompletionAuthority(",
    firstMembership + 1,
  );
  const stable = source.indexOf("administrativeAuthorityIsStable(", secondMembership + 1);
  const issue = source.indexOf("issueAdministrativeAuthorizationGrant(", stable + 1);
  if (
    firstMembership < 0 ||
    limiter < firstMembership ||
    password < limiter ||
    secondMembership < password ||
    stable < secondMembership ||
    issue < stable
  ) {
    fail("fresh authentication is not enclosed by stable exact employee-authority checks");
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
  for (const filePath of [
    issueRoutePath,
    verifyRoutePath,
    grantLibraryPath,
    authorityLibraryPath,
    directoryRoutePath,
    assignmentRoutePath,
    adminListRoutePath,
    userDrawerPath,
    migrationPath,
    boundedJsonPath,
  ]) {
    if (!fs.existsSync(filePath)) fail(`required source is missing: ${path.relative(repositoryRoot, filePath)}`);
  }

  const issueSource = fs.readFileSync(issueRoutePath, "utf8");
  const verifySource = fs.readFileSync(verifyRoutePath, "utf8");
  const grantSource = fs.readFileSync(grantLibraryPath, "utf8");
  const authoritySource = fs.readFileSync(authorityLibraryPath, "utf8");
  const directorySource = fs.readFileSync(directoryRoutePath, "utf8");
  const assignmentSource = fs.readFileSync(assignmentRoutePath, "utf8");
  const adminListSource = fs.readFileSync(adminListRoutePath, "utf8");
  const userDrawerSource = fs.readFileSync(userDrawerPath, "utf8");
  const migrationSource = fs.readFileSync(migrationPath, "utf8");
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
    ["exact employee authority resolver", /resolveAdministrativeCompletionAuthority\s*\(/],
    ["stable pre/post-auth identity", /administrativeAuthorityIsStable\s*\(/],
    ["signed employee identity", /employeeId:\s*authorityAfterFreshAuthentication\.employeeId/],
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
    ["password in success response", /ok\s*:\s*true[\s\S]{0,300}password\s*:/i],
    ["unbounded request JSON buffering", /req\.json\s*\(/],
  ]) forbidPattern(issueSource, label, pattern);
  requireOrderedIssueAuthorizationFlow(issueSource);

  for (const [label, pattern] of [
    ["POST-only verify route", /export\s+async\s+function\s+POST\s*\(/],
    ["cryptographic grant verification", /verifyAdministrativeAuthorizationGrant\s*\(/],
    ["current employee authority revalidation", /resolveAdministrativeCompletionAuthority\s*\(/],
    ["signed employee comparison", /currentAuthority\.employeeId\s*!==\s*claims\.employee_id/],
    ["exact fixed scope", /scope\s*!==\s*ADMINISTRATIVE_COMPLETION_SCOPE/],
    ["authorization UUID verification", /assertUuid\s*\(\s*["']authorization_id["']\s*,\s*authorizationId\s*\)/],
    ["shop UUID verification", /assertUuid\s*\(\s*["']shop_id["']\s*,\s*shopId\s*\)/],
    ["signed Int32 work-order cap", /workOrderId\s*>\s*MAXIMUM_ADMINISTRATIVE_TARGET_ID/],
    ["signed Int32 operation cap", /operationId\s*>\s*MAXIMUM_ADMINISTRATIVE_TARGET_ID/],
    ["bounded exact JSON reader", /readBoundedExactJsonObject\s*\(\s*req\s*,\s*VERIFY_REQUEST_SCHEMA\s*\)/],
    ["no-store verify response", /Cache-Control["']?\s*:\s*["']no-store, max-age=0["']/],
  ]) requirePattern(verifySource, label, pattern);

  for (const [label, pattern] of [
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
    ["grant contract version 2", /version:\s*2/],
    ["signed employee id", /employee_id/],
    ["signed capability code", /capability_code/],
    ["signed exact action", /action:\s*ADMINISTRATIVE_COMPLETION_ACTION/],
    ["exact grant claim keys", /EXACT_GRANT_CLAIM_KEYS/],
    ["canonical decoded JSON", /decodedJson\s*!==\s*JSON\.stringify\(parsed\)/],
  ]) requirePattern(grantSource, label, pattern);
  forbidPattern(grantSource, "service-role-key signing fallback", /SUPABASE_SERVICE_ROLE_KEY/);

  for (const [label, pattern] of [
    ["canonical capability code", /ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE\s*=\s*["']work-order\.complete-close\.override["']/],
    ["canonical action", /ADMINISTRATIVE_COMPLETION_ACTION\s*=\s*["']administrative-complete-close["']/],
    ["capability version", /ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION\s*=\s*1/],
    ["unfiltered membership query", /\.from\s*\(\s*["']rb_shop_members["']\s*\)[\s\S]*?\.eq\s*\(\s*["']shop_id["'][\s\S]*?\.eq\s*\(\s*["']user_id["'][\s\S]*?\.limit\s*\(\s*2\s*\)/],
    ["unfiltered employee query", /\.from\s*\(\s*["']employees["']\s*\)[\s\S]*?\.eq\s*\(\s*["']shop_id["'][\s\S]*?\.eq\s*\(\s*["']auth_user_id["'][\s\S]*?\.limit\s*\(\s*2\s*\)/],
    ["exact active membership", /row\.is_active\s*!==\s*true/],
    ["exact owner role", /role\s*!==\s*["']owner["']/],
    ["exact admin role", /role\s*!==\s*["']admin["']/],
    ["exact active employee", /row\.is_active\s*!==\s*true/],
    ["literal capability true", /row\.can_administrative_complete_close\s*!==\s*true/],
    ["ambiguous membership denial", /ADMINISTRATIVE_MEMBERSHIP_AMBIGUOUS/],
    ["ambiguous employee denial", /ADMINISTRATIVE_EMPLOYEE_MAPPING_AMBIGUOUS/],
  ]) requirePattern(authoritySource, label, pattern);
  forbidPattern(authoritySource, "generic capability implication", /FullAdmin|can_work_orders|can_jobs_module/i);

  for (const [label, pattern] of [
    ["directory capability column", /can_administrative_complete_close/],
    ["versioned directory contract", /administrative_completion_contract_version/],
    ["canonical snapshot id", /administrative_completion_snapshot_id:\s*randomUUID\(\)/],
    ["snapshot issue time", /administrative_completion_snapshot_issued_utc:\s*new Date\(\)\.toISOString\(\)/],
    ["structured capability array", /administrative_capabilities:/],
    ["literal directory capability", /employee\.can_administrative_complete_close\s*===\s*true/],
    ["authenticated modern eligibility", /auth\.mode\s*===\s*["']user["']\s*&&\s*!modern\.error/],
    ["legacy contract zero", /administrativeProjectionEligible[\s\S]*?\?\s*ADMINISTRATIVE_COMPLETION_DIRECTORY_CONTRACT_VERSION[\s\S]*?:\s*0/],
  ]) requirePattern(directorySource, label, pattern);

  for (const [label, pattern] of [
    ["AAL2 assignment", /requireAal2\s*\(\s*\)/],
    ["bounded exact assignment body", /readBoundedExactJsonObject\s*\(\s*req\s*,\s*ASSIGNMENT_REQUEST_SCHEMA\s*\)/],
    ["canonical authenticated actor", /requireCanonicalAdministrativeUuid\s*\(\s*["']actor_user_id["']\s*,\s*user\.id\s*\)/],
    ["single transactional RPC", /\.rpc\s*\(\s*["']rb_set_administrative_completion_capability["']/],
    ["actor-bound RPC argument", /p_actor_user_id:\s*actorUserId/],
    ["shop-bound RPC argument", /p_shop_id:\s*shopId/],
    ["employee-bound RPC argument", /p_employee_id:\s*employeeId/],
    ["exact enabled RPC argument", /p_enabled:\s*enabled/],
  ]) requirePattern(assignmentSource, label, pattern);
  if ((assignmentSource.match(/\.rpc\s*\(/g) ?? []).length !== 1) {
    fail("capability assignment route does not contain exactly one RPC call");
  }
  for (const [label, pattern] of [
    ["direct table access", /\.from\s*\(/],
    ["direct update", /\.update\s*\(/],
    ["separate audit writer", /writeAudit|rb_audit_log/],
    ["separate membership resolver", /resolveActiveAdministrativeMembership/],
  ]) forbidPattern(assignmentSource, label, pattern);
  forbidPattern(assignmentSource, "platform-admin assignment bypass", /PlatformAdmin|requireShopAdminOrPlatformAdmin|requireShopAccessOrAdmin/i);
  forbidPattern(assignmentSource, "generic capability assignment", /FullAdmin|can_work_orders|can_jobs_module/i);

  requirePattern(adminListSource, "admin list capability projection", /can_administrative_complete_close:\s*employee\?\.can_administrative_complete_close\s*===\s*true/);
  requirePattern(userDrawerSource, "administrative capability control", /Save Administrative Capability/);
  requirePattern(userDrawerSource, "action-specific UI warning", /Full Admin and other roles or permissions do not imply this capability/);

  for (const [label, pattern] of [
    ["deny-by-default column", /can_administrative_complete_close\s+set\s+default\s+false/i],
    ["non-null capability", /can_administrative_complete_close\s+set\s+not\s+null/i],
    ["duplicate guard", /having\s+count\(\*\)\s*>\s*1/i],
    ["explicit duplicate remediation failure", /duplicate shop-scoped employee auth bindings require explicit remediation/i],
    ["shop/auth unique index", /unique index if not exists employees_shop_auth_unique[\s\S]*?\(shop_id, auth_user_id\)[\s\S]*?where auth_user_id is not null/i],
    ["client table privilege revocation", /revoke all privileges on table public\.employees from public, anon, authenticated/i],
    ["service-role-only table grant", /grant all privileges on table public\.employees to service_role/i],
    ["transactional assignment function", /create or replace function public\.rb_set_administrative_completion_capability\s*\(\s*p_shop_id uuid,\s*p_employee_id uuid,\s*p_actor_user_id uuid,\s*p_enabled boolean\s*\)/i],
    ["security-definer assignment", /returns jsonb\s+language plpgsql\s+security definer/i],
    ["row-security isolation", /set row_security = off/i],
    ["locked rows", /for update/i],
    ["row cardinality checks", /get diagnostics v_cardinality = row_count/i],
    ["exact actor authorization", /m\.user_id = p_actor_user_id[\s\S]*?exact active owner or administrator actor membership required/i],
    ["locked exact target", /e\.id = p_employee_id[\s\S]*?for update/i],
    ["enable-only target binding checks", /if p_enabled then[\s\S]*?e\.auth_user_id = v_target\.auth_user_id[\s\S]*?m\.user_id = v_target\.auth_user_id/i],
    ["capability mutation", /update public\.employees\s+set can_administrative_complete_close = p_enabled/i],
    ["sanitized audit insert", /insert into public\.rb_audit_log[\s\S]*?employee\.administrative_completion_capability\.updated/i],
    ["client function denial", /revoke all privileges on function public\.rb_set_administrative_completion_capability\(uuid, uuid, uuid, boolean\)[\s\S]*?from public, anon, authenticated, service_role/i],
    ["service-role-only execution", /grant execute on function public\.rb_set_administrative_completion_capability\(uuid, uuid, uuid, boolean\)\s+to service_role/i],
  ]) requirePattern(migrationSource, label, pattern);
  forbidPattern(migrationSource, "capability true backfill", /set\s+can_administrative_complete_close\s*=\s*true/i);
  forbidPattern(migrationSource, "capability true default", /can_administrative_complete_close[\s\S]{0,80}default\s+true/i);
  forbidPattern(migrationSource, "client capability grant", /grant[\s\S]{0,160}(?:anon|authenticated)/i);
  forbidPattern(migrationSource, "employee deletion", /delete\s+from\s+public\.employees/i);
  const assignmentFunction = /create or replace function public\.rb_set_administrative_completion_capability[\s\S]*?\$function\$;/i.exec(migrationSource)?.[0] ?? "";
  if (!assignmentFunction) fail("transactional assignment function body is unavailable");
  const mutationOffset = assignmentFunction.indexOf("update public.employees");
  const auditOffset = assignmentFunction.indexOf("insert into public.rb_audit_log");
  const returnOffset = assignmentFunction.indexOf("return pg_catalog.jsonb_build_object");
  if (mutationOffset < 0 || auditOffset <= mutationOffset || returnOffset <= auditOffset) {
    fail("capability mutation and audit insert are not ordered in one function body");
  }
  if ((assignmentFunction.match(/for update/gi) ?? []).length < 3) {
    fail("transactional assignment does not lock actor, target, and target membership rows");
  }
  forbidPattern(assignmentFunction, "caught audit failure", /exception\s+when/i);
  forbidPattern(assignmentFunction, "autonomous transaction boundary", /\b(?:commit|rollback)\b/i);
  forbidPattern(assignmentFunction, "PII in capability audit", /actor_email|employee_code|display_name|email|phone|name['"]/i);

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
    const authorityModulePath = transpileForNode20(
      authorityLibraryPath,
      "administrativeCompletionAuthority.js",
      syntheticDirectory,
    );
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
    const directoryRouteModulePath = transpileForNode20(
      directoryRoutePath,
      "employeeDirectoryRoute.js",
      syntheticDirectory,
    );
    const assignmentRouteModulePath = transpileForNode20(
      assignmentRoutePath,
      "administrativeCompletionAssignmentRoute.js",
      syntheticDirectory,
    );
    const authority = require(authorityModulePath);
    const grants = loadCommonJsWithMocks(grantModulePath, {
      "@/lib/administrativeCompletionAuthority": authority,
    });
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
      { userId: "33333333-3333-4333-8333-333333333333", employeeId: "44444444-4444-4444-8444-444444444444", role: "admin" },
      now,
    );
    const verified = grants.verifyAdministrativeAuthorizationGrant(
      issued.grant,
      target,
      new Date(now.getTime() + 30_000),
    );
    if (
      verified.authorization_id !== target.authorizationId ||
      verified.work_order_id !== 101 ||
      verified.employee_id !== "44444444-4444-4444-8444-444444444444" ||
      verified.capability_code !== authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE ||
      verified.capability_version !== authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION ||
      verified.action !== authority.ADMINISTRATIVE_COMPLETION_ACTION ||
      verified.version !== 2
    ) {
      fail("valid synthetic grant did not preserve its exact target");
    }

    const maximumTarget = {
      ...target,
      workOrderId: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID,
      operationId: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID,
    };
    const maximumIssued = grants.issueAdministrativeAuthorizationGrant(
      maximumTarget,
      { userId: "33333333-3333-4333-8333-333333333333", employeeId: "44444444-4444-4444-8444-444444444444", role: "owner" },
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
        { userId: "33333333-3333-4333-8333-333333333333", employeeId: "44444444-4444-4444-8444-444444444444", role: "admin" },
        now,
      ),
    );
    await requireRejected(
      "operation target above signed Int32 maximum",
      () => grants.issueAdministrativeAuthorizationGrant(
        { ...target, operationId: grants.MAXIMUM_ADMINISTRATIVE_TARGET_ID + 1 },
        { userId: "33333333-3333-4333-8333-333333333333", employeeId: "44444444-4444-4444-8444-444444444444", role: "admin" },
        now,
      ),
    );

    const pairedSurrogateTarget = {
      ...target,
      reason: "Synthetic paired \ud83d\ude80 reason",
    };
    const pairedSurrogateIssued = grants.issueAdministrativeAuthorizationGrant(
      pairedSurrogateTarget,
      { userId: "33333333-3333-4333-8333-333333333333", employeeId: "44444444-4444-4444-8444-444444444444", role: "admin" },
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
        { userId: "33333333-3333-4333-8333-333333333333", employeeId: "44444444-4444-4444-8444-444444444444", role: "admin" },
        now,
      ),
    );
    await requireRejected(
      "lone low-surrogate reason issue",
      () => grants.issueAdministrativeAuthorizationGrant(
        { ...target, reason: "Synthetic lone \udc00 reason" },
        { userId: "33333333-3333-4333-8333-333333333333", employeeId: "44444444-4444-4444-8444-444444444444", role: "admin" },
        now,
      ),
    );
    const replacementCharacterTarget = { ...target, reason: "Synthetic replacement \ufffd reason" };
    const replacementCharacterIssued = grants.issueAdministrativeAuthorizationGrant(
      replacementCharacterTarget,
      { userId: "33333333-3333-4333-8333-333333333333", employeeId: "44444444-4444-4444-8444-444444444444", role: "admin" },
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
    const decodedJson = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const decodedPayload = JSON.parse(decodedJson);
    for (const forbiddenField of ["password", "bearer", "access_token", "email"]) {
      if (Object.prototype.hasOwnProperty.call(decodedPayload, forbiddenField)) fail(`grant payload contains ${forbiddenField}`);
    }
    const signSyntheticJson = (json) => {
      const payload = Buffer.from(json, "utf8").toString("base64url");
      const signature = createHmac(
        "sha256",
        process.env.RUNBOOK_ADMIN_AUTHORIZATION_SIGNING_SECRET,
      ).update(payload, "ascii").digest("base64url");
      return `${payload}.${signature}`;
    };
    const duplicateKeyGrant = signSyntheticJson(
      decodedJson.replace('"version":2', '"version":2,"version":2'),
    );
    await requireRejected(
      "signed duplicate claim name",
      () => grants.verifyAdministrativeAuthorizationGrant(
        duplicateKeyGrant,
        target,
        new Date(now.getTime() + 30_000),
      ),
    );
    const extraClaimGrant = signSyntheticJson(
      JSON.stringify({ ...decodedPayload, unexpected: false }),
    );
    await requireRejected(
      "signed extra claim",
      () => grants.verifyAdministrativeAuthorizationGrant(
        extraClaimGrant,
        target,
        new Date(now.getTime() + 30_000),
      ),
    );

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

    const syntheticMembershipId = "55555555-5555-4555-8555-555555555555";
    const syntheticUserId = "66666666-6666-4666-8666-666666666666";
    const syntheticShopId = "77777777-7777-4777-8777-777777777777";
    const syntheticAuthorizationId = "88888888-8888-4888-8888-888888888888";
    const syntheticEmployeeId = "99999999-9999-4999-8999-999999999999";
    const syntheticEmail = "synthetic@example.test";
    const syntheticPassword = "synthetic-password";
    const membershipRow = (overrides = {}) => ({
      id: syntheticMembershipId,
      shop_id: syntheticShopId,
      user_id: syntheticUserId,
      role: "admin",
      is_active: true,
      ...overrides,
    });
    const employeeRow = (overrides = {}) => ({
      id: syntheticEmployeeId,
      shop_id: syntheticShopId,
      auth_user_id: syntheticUserId,
      is_active: true,
      can_administrative_complete_close: true,
      ...overrides,
    });
    const createAuthorityAdmin = (responses, queries = []) => ({
      from(table) {
        const query = { table, select: null, predicates: [], limit: null };
        const builder = {
          select(columns) {
            query.select = columns;
            return builder;
          },
          eq(column, value) {
            query.predicates.push([column, value]);
            return builder;
          },
          async limit(count) {
            query.limit = count;
            queries.push({
              table: query.table,
              select: query.select,
              predicates: query.predicates.map((predicate) => predicate.slice()),
              limit: query.limit,
            });
            const response = responses.shift();
            if (!response) throw new Error("missing synthetic authority response");
            return response;
          },
        };
        return builder;
      },
    });
    const requireAuthorityRejected = async (label, responses, reasonCode, status = 403) => {
      try {
        await authority.resolveAdministrativeCompletionAuthority(
          createAuthorityAdmin(responses.slice()),
          syntheticShopId,
          syntheticUserId,
        );
      } catch (error) {
        if (error?.status !== status || error?.reasonCode !== reasonCode) {
          fail(`${label} returned ${String(error?.status)}/${String(error?.reasonCode)}`);
        }
        return;
      }
      fail(`${label} was accepted`);
    };

    const authorityQueries = [];
    const exactAuthority = await authority.resolveAdministrativeCompletionAuthority(
      createAuthorityAdmin([
        { data: [membershipRow()], error: null },
        { data: [employeeRow()], error: null },
      ], authorityQueries),
      syntheticShopId,
      syntheticUserId,
    );
    requireExactObject("exact administrative authority", exactAuthority, {
      membershipId: syntheticMembershipId,
      role: "admin",
      shopId: syntheticShopId,
      userId: syntheticUserId,
      employeeId: syntheticEmployeeId,
    });
    requireExactObject("unfiltered membership lookup", authorityQueries[0], {
      table: "rb_shop_members",
      select: "id,shop_id,user_id,role,is_active",
      predicates: [["shop_id", syntheticShopId], ["user_id", syntheticUserId]],
      limit: 2,
    });
    requireExactObject("unfiltered employee lookup", authorityQueries[1], {
      table: "employees",
      select: "id,shop_id,auth_user_id,is_active,can_administrative_complete_close",
      predicates: [["shop_id", syntheticShopId], ["auth_user_id", syntheticUserId]],
      limit: 2,
    });

    await requireAuthorityRejected(
      "missing employee mapping",
      [{ data: [membershipRow()], error: null }, { data: [], error: null }],
      "ADMINISTRATIVE_EMPLOYEE_MAPPING_MISSING",
    );
    await requireAuthorityRejected(
      "duplicate employee mapping",
      [{ data: [membershipRow()], error: null }, { data: [employeeRow(), employeeRow({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })], error: null }],
      "ADMINISTRATIVE_EMPLOYEE_MAPPING_AMBIGUOUS",
    );
    await requireAuthorityRejected(
      "inactive employee",
      [{ data: [membershipRow()], error: null }, { data: [employeeRow({ is_active: false })], error: null }],
      "ADMINISTRATIVE_EMPLOYEE_INACTIVE",
    );
    await requireAuthorityRejected(
      "missing explicit capability",
      [
        { data: [membershipRow()], error: null },
        { data: [employeeRow({ can_administrative_complete_close: false })], error: null },
      ],
      "ADMINISTRATIVE_COMPLETION_CAPABILITY_REQUIRED",
    );
    await requireAuthorityRejected(
      "FullAdmin alone",
      [
        { data: [membershipRow()], error: null },
        {
          data: [employeeRow({
            can_administrative_complete_close: false,
            FullAdmin: true,
          })],
          error: null,
        },
      ],
      "ADMINISTRATIVE_COMPLETION_CAPABILITY_REQUIRED",
    );
    await requireAuthorityRejected(
      "CanWorkOrders alone",
      [
        { data: [membershipRow()], error: null },
        {
          data: [employeeRow({
            can_administrative_complete_close: false,
            can_work_orders: true,
          })],
          error: null,
        },
      ],
      "ADMINISTRATIVE_COMPLETION_CAPABILITY_REQUIRED",
    );
    await requireAuthorityRejected(
      "non-boolean capability",
      [{ data: [membershipRow()], error: null }, { data: [employeeRow({ can_administrative_complete_close: 1 })], error: null }],
      "ADMINISTRATIVE_COMPLETION_CAPABILITY_REQUIRED",
    );
    await requireAuthorityRejected(
      "explicit capability with non-admin membership",
      [{ data: [membershipRow({ role: "member" })], error: null }],
      "ADMINISTRATIVE_MEMBERSHIP_INELIGIBLE",
    );
    await requireAuthorityRejected(
      "duplicate membership",
      [{ data: [membershipRow(), membershipRow({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })], error: null }],
      "ADMINISTRATIVE_MEMBERSHIP_AMBIGUOUS",
    );
    await requireAuthorityRejected(
      "revoked capability",
      [{ data: [membershipRow()], error: null }, { data: [employeeRow({ can_administrative_complete_close: false })], error: null }],
      "ADMINISTRATIVE_COMPLETION_CAPABILITY_REQUIRED",
    );
    await requireAuthorityRejected(
      "authority lookup unavailable",
      [{ data: null, error: { message: "synthetic unavailable" } }],
      "ADMINISTRATIVE_MEMBERSHIP_UNAVAILABLE",
      503,
    );

    const routeState = {
      authorityResponses: [],
      authorityCalls: [],
      events: [],
      freshAuthentication: null,
      throwLocalRateLimit: false,
      signInCalls: [],
      limiterCalls: [],
      issuedTarget: null,
      issuedPrincipal: null,
      issuedGrant: null,
    };
    const activeAuthority = (role = "admin", employeeId = syntheticEmployeeId) => ({
      membershipId: syntheticMembershipId,
      role,
      userId: syntheticUserId,
      shopId: syntheticShopId,
      employeeId,
    });
    const resetRouteState = (authorityResponses) => {
      routeState.authorityResponses = authorityResponses.slice();
      routeState.authorityCalls = [];
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
    const adminClient = {};
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
      "@/lib/administrativeCompletionAuthority": {
        ...authority,
        resolveAdministrativeCompletionAuthority: async (admin, shopId, userId) => {
          routeState.events.push("authority");
          routeState.authorityCalls.push({ admin, shopId, userId });
          const response = routeState.authorityResponses.shift();
          if (!response) throw new Error("missing synthetic authority response");
          if (response instanceof Error) throw response;
          return response;
        },
        administrativeAuthorityIsStable: (before, after) => {
          routeState.events.push("stable");
          return authority.administrativeAuthorityIsStable(before, after);
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

    resetRouteState([activeAuthority("admin"), activeAuthority("admin")]);
    const successfulIssue = await invokeIssueRoute();
    if (
      successfulIssue.response.status !== 200 ||
      successfulIssue.body.ok !== true ||
      routeState.events.join(",") !== "authority,limit,password,authority,stable,issue" ||
      routeState.issuedPrincipal?.role !== "admin" ||
      routeState.issuedPrincipal?.employeeId !== syntheticEmployeeId
    ) {
      fail(
        `issue route did not re-check and use stable exact employee authority after fresh authentication ` +
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
    const expectedAuthorityCall = {
      admin: adminClient,
      shopId: syntheticShopId,
      userId: syntheticUserId,
    };
    if (routeState.authorityCalls.length !== 2) {
      fail(`successful issue performed ${routeState.authorityCalls.length} authority resolutions instead of 2`);
    }
    for (const [index, call] of routeState.authorityCalls.entries()) {
      requireExactObject(`authority resolution ${index + 1}`, call, expectedAuthorityCall);
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
      employeeId: syntheticEmployeeId,
      role: "admin",
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
      successfulIssueClaims.employee_id !== syntheticEmployeeId ||
      successfulIssueClaims.role !== "admin" ||
      successfulIssueClaims.work_order_id !== expectedIssueTarget.workOrderId ||
      successfulIssueClaims.operation_id !== expectedIssueTarget.operationId
    ) {
      fail("issued grant did not preserve the exact target and post-authentication principal");
    }

    resetRouteState([
      activeAuthority("admin"),
      new authority.AdministrativeCompletionAuthorityError(403, "ADMINISTRATIVE_COMPLETION_CAPABILITY_REQUIRED"),
    ]);
    const revokedIssue = await invokeIssueRoute();
    if (
      revokedIssue.response.status !== 403 ||
      routeState.events.join(",") !== "authority,limit,password,authority"
    ) {
      fail("issue route did not fail closed when capability was revoked after fresh authentication");
    }

    resetRouteState([
      activeAuthority("admin"),
      new authority.AdministrativeCompletionAuthorityError(503, "ADMINISTRATIVE_EMPLOYEE_MAPPING_UNAVAILABLE"),
    ]);
    const unavailableRecheck = await invokeIssueRoute();
    if (
      unavailableRecheck.response.status !== 503 ||
      routeState.events.join(",") !== "authority,limit,password,authority"
    ) {
      fail("issue route did not fail closed when the final authority check was unavailable");
    }

    resetRouteState([
      activeAuthority("admin"),
      activeAuthority("admin", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ]);
    const changedIdentityIssue = await invokeIssueRoute();
    if (
      changedIdentityIssue.response.status !== 403 ||
      routeState.events.join(",") !== "authority,limit,password,authority,stable" ||
      routeState.issuedGrant !== null
    ) {
      fail("issue route accepted an employee identity change across fresh authentication");
    }

    resetRouteState([activeAuthority("admin")]);
    routeState.throwLocalRateLimit = true;
    const locallyRateLimited = await invokeIssueRoute();
    if (locallyRateLimited.response.status !== 429 || routeState.events.join(",") !== "authority,limit") {
      fail("issue route did not classify the local issuance throttle as 429");
    }

    resetRouteState([activeAuthority("admin")]);
    routeState.freshAuthentication = { data: { user: null }, error: { status: 429 } };
    const upstreamRateLimited = await invokeIssueRoute();
    if (upstreamRateLimited.response.status !== 429 || routeState.events.join(",") !== "authority,limit,password") {
      fail("issue route did not classify the Supabase Auth throttle as 429");
    }

    resetRouteState([activeAuthority("admin")]);
    const wrongPasswordIssue = await invokeIssueRoute({ password: "wrong-synthetic-password" });
    if (
      wrongPasswordIssue.response.status !== 401 ||
      routeState.events.join(",") !== "authority,limit,password" ||
      routeState.authorityCalls.length !== 1 ||
      routeState.issuedGrant !== null
    ) {
      fail("issue route did not reject a wrong password before the post-authentication membership check");
    }

    resetRouteState([activeAuthority("admin")]);
    routeState.freshAuthentication = {
      data: { user: { id: "99999999-9999-4999-8999-999999999999" } },
      error: null,
    };
    const wrongUserIssue = await invokeIssueRoute();
    if (
      wrongUserIssue.response.status !== 401 ||
      routeState.events.join(",") !== "authority,limit,password" ||
      routeState.authorityCalls.length !== 1 ||
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
    resetRouteState([]);
    const noncanonicalIssueUuid = await invokeIssueRoute({
      authorization_id: "ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF",
    });
    if (noncanonicalIssueUuid.response.status !== 400 || routeState.events.length !== 0) {
      fail("issue route accepted a noncanonical UUID");
    }

    const verifyAuthorityResponses = [];
    const verifyAuthorityCalls = [];
    const verifyRoute = loadCommonJsWithMocks(verifyRouteModulePath, {
      "next/server": { NextResponse: { json: jsonResponse } },
      "@/lib/authz": { assertUuid: assertSyntheticUuid },
      "@/lib/security/boundedJsonRequest": boundedJson,
      "@/lib/administrativeAuthorizationGrant": grants,
      "@/lib/administrativeCompletionAuthority": {
        ...authority,
        resolveAdministrativeCompletionAuthority: async (admin, shopId, userId) => {
          verifyAuthorityCalls.push({ admin, shopId, userId });
          const response = verifyAuthorityResponses.shift();
          if (!response) throw new Error("missing synthetic verify authority response");
          if (response instanceof Error) throw response;
          return response;
        },
      },
      "@/lib/supabase/admin": { supabaseAdmin: () => adminClient },
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
      { userId: syntheticUserId, employeeId: syntheticEmployeeId, role: "admin" },
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
    verifyAuthorityResponses.push(activeAuthority("admin"));
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
      employee_id: syntheticEmployeeId,
      role: "admin",
      capability_code: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE,
      capability_version: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION,
      action: authority.ADMINISTRATIVE_COMPLETION_ACTION,
      authenticated_utc: routeIssued.claims.authenticated_utc,
      expires_utc: routeIssued.claims.expires_utc,
    });
    requireExactObject("verify route current-authority lookup", verifyAuthorityCalls[0], {
      admin: adminClient,
      shopId: syntheticShopId,
      userId: syntheticUserId,
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
    const noncanonicalVerification = await verifyRoute.POST(verifyRequest({
      authorization_id: "ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF",
    }));
    if (noncanonicalVerification.status !== 400) {
      fail("verification route accepted a noncanonical UUID");
    }
    verifyAuthorityResponses.push(
      new authority.AdministrativeCompletionAuthorityError(
        403,
        "ADMINISTRATIVE_COMPLETION_CAPABILITY_REQUIRED",
      ),
    );
    const revokedVerification = await verifyRoute.POST(verifyRequest());
    if (revokedVerification.status !== 403) {
      fail("verification route accepted a cryptographically valid grant after capability revocation");
    }
    verifyAuthorityResponses.push(
      new authority.AdministrativeCompletionAuthorityError(
        503,
        "ADMINISTRATIVE_EMPLOYEE_MAPPING_UNAVAILABLE",
      ),
    );
    const unavailableVerification = await verifyRoute.POST(verifyRequest());
    if (unavailableVerification.status !== 503) {
      fail("verification route did not fail unavailable when current authority could not be checked");
    }

    let directorySessionAllowed = true;
    let directoryModernResponse = { data: [], error: null };
    let directoryLegacyResponse = { data: [], error: null };
    const directoryQueries = [];
    const directoryAdmin = {
      from(table) {
        const query = { table, select: "", predicates: [] };
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
            directoryQueries.push({ ...query, operation: "maybeSingle" });
            return {
              data: { shop_id: syntheticShopId, user_id: syntheticUserId, role: "admin" },
              error: null,
            };
          },
          async order() {
            directoryQueries.push({ ...query, operation: "order" });
            return query.select.includes("can_administrative_complete_close")
              ? directoryModernResponse
              : directoryLegacyResponse;
          },
        };
        return builder;
      },
      storage: {
        from() {
          return {
            async createSignedUrl() {
              throw new Error("synthetic avatar signing was not expected");
            },
          };
        },
      },
    };
    const directoryRoute = loadCommonJsWithMocks(directoryRouteModulePath, {
      "next/server": { NextResponse: { json: jsonResponse } },
      "@/lib/supabase/admin": { supabaseAdmin: () => directoryAdmin },
      "@/lib/desktopAuth": {
        requireSessionUser: async () => {
          if (!directorySessionAllowed) throw new Error("Not authenticated");
          return { user: { id: syntheticUserId } };
        },
      },
      "@/lib/administrativeCompletionAuthority": authority,
    });
    const directoryRequest = (host = "control.example.test") => ({
      nextUrl: new URL(`https://${host}/api/desktop/employee-directory?shop_id=${syntheticShopId}`),
      headers: new Headers({ host }),
    });
    const syntheticDirectoryEmployee = {
      id: syntheticEmployeeId,
      shop_id: syntheticShopId,
      auth_user_id: syntheticUserId,
      employee_code: "SYN-001",
      display_name: "Synthetic Employee",
      role: "foreman",
      status: "Active",
      is_active: true,
      can_administrative_complete_close: true,
    };

    directorySessionAllowed = true;
    directoryModernResponse = { data: [syntheticDirectoryEmployee], error: null };
    let directoryResponse = await directoryRoute.GET(directoryRequest());
    let directoryBody = await directoryResponse.json();
    if (
      directoryResponse.status !== 200 ||
      directoryResponse.headers.get("cache-control") !== "no-store, max-age=0" ||
      directoryBody.auth_mode !== "user" ||
      directoryBody.administrative_completion_contract_version !== 1 ||
      !authority.isCanonicalAdministrativeUuid(directoryBody.administrative_completion_snapshot_id) ||
      !Number.isFinite(Date.parse(directoryBody.administrative_completion_snapshot_issued_utc)) ||
      directoryBody.employees?.[0]?.is_active !== true ||
      JSON.stringify(directoryBody.employees?.[0]?.administrative_capabilities) !== JSON.stringify([{
        code: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE,
        version: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION,
      }])
    ) {
      fail("authenticated modern employee directory did not emit the exact versioned capability contract");
    }

    directorySessionAllowed = false;
    directoryResponse = await directoryRoute.GET(directoryRequest("localhost"));
    directoryBody = await directoryResponse.json();
    if (
      directoryResponse.status !== 200 ||
      directoryBody.auth_mode !== "local-dev" ||
      directoryBody.administrative_completion_contract_version !== 0 ||
      JSON.stringify(directoryBody.employees?.[0]?.administrative_capabilities) !== "[]"
    ) {
      fail("local-dev employee directory response qualified for administrative projection");
    }

    directorySessionAllowed = true;
    directoryModernResponse = { data: null, error: { message: "synthetic missing capability column" } };
    directoryLegacyResponse = {
      data: [{
        id: syntheticEmployeeId,
        shop_id: syntheticShopId,
        employee_code: "SYN-001",
        display_name: "Synthetic Employee",
        role: "foreman",
        is_active: true,
      }],
      error: null,
    };
    directoryResponse = await directoryRoute.GET(directoryRequest());
    directoryBody = await directoryResponse.json();
    if (
      directoryResponse.status !== 200 ||
      directoryBody.administrative_completion_contract_version !== 0 ||
      directoryBody.employees?.[0]?.auth_user_id !== "" ||
      JSON.stringify(directoryBody.employees?.[0]?.administrative_capabilities) !== "[]"
    ) {
      fail("legacy employee directory fallback qualified for administrative projection");
    }

    const assignmentState = {
      aal2: true,
      rpcResponse: null,
      rpcCalls: [],
      limiterCalls: [],
    };
    const assignmentAdmin = {
      async rpc(name, args) {
        assignmentState.rpcCalls.push({ name, args: { ...args } });
        if (!assignmentState.rpcResponse) throw new Error("missing synthetic assignment RPC response");
        return assignmentState.rpcResponse;
      },
    };
    const assignmentRoute = loadCommonJsWithMocks(assignmentRouteModulePath, {
      "next/server": { NextResponse: { json: jsonResponse } },
      "@/lib/authz": {
        requireAal2: async () => {
          if (!assignmentState.aal2) throw new Error("MFA required (AAL2)");
          return { user: { id: syntheticUserId } };
        },
      },
      "@/lib/administrativeCompletionAuthority": authority,
      "@/lib/security/boundedJsonRequest": boundedJson,
      "@/lib/security/rateLimit": {
        rateLimitOrThrow: (options) => assignmentState.limiterCalls.push({ ...options }),
      },
      "@/lib/supabase/admin": { supabaseAdmin: () => assignmentAdmin },
    });
    const assignmentRequest = (enabled) => syntheticJsonRequest(JSON.stringify({
      shop_id: syntheticShopId,
      employee_id: syntheticEmployeeId,
      enabled,
    }));
    const resetAssignmentState = (rpcResponse, aal2 = true) => {
      assignmentState.aal2 = aal2;
      assignmentState.rpcResponse = rpcResponse;
      assignmentState.rpcCalls = [];
      assignmentState.limiterCalls = [];
    };

    resetAssignmentState({
      data: {
        employee_id: syntheticEmployeeId,
        shop_id: syntheticShopId,
        capability_code: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE,
        capability_version: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION,
        enabled: true,
      },
      error: null,
    });
    let assignmentResponse = await assignmentRoute.POST(assignmentRequest(true));
    let assignmentBody = await assignmentResponse.json();
    if (
      assignmentResponse.status !== 200 ||
      assignmentBody.employee?.enabled !== true ||
      assignmentState.rpcCalls.length !== 1
    ) {
      fail("AAL2 capability assignment did not use exactly one transactional RPC");
    }
    requireExactObject("actor-bound capability assignment RPC", assignmentState.rpcCalls[0], {
      name: "rb_set_administrative_completion_capability",
      args: {
        p_shop_id: syntheticShopId,
        p_employee_id: syntheticEmployeeId,
        p_actor_user_id: syntheticUserId,
        p_enabled: true,
      },
    });

    resetAssignmentState({
      data: {
        employee_id: syntheticEmployeeId,
        shop_id: syntheticShopId,
        capability_code: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE,
        capability_version: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION,
        enabled: false,
      },
      error: null,
    });
    assignmentResponse = await assignmentRoute.POST(assignmentRequest(false));
    assignmentBody = await assignmentResponse.json();
    if (
      assignmentResponse.status !== 200 ||
      assignmentBody.employee?.enabled !== false ||
      assignmentState.rpcCalls.length !== 1 ||
      assignmentState.rpcCalls[0].args.p_enabled !== false
    ) {
      fail("capability assignment route did not allow safe disable after target deactivation/unlinking");
    }

    resetAssignmentState(null, false);
    assignmentResponse = await assignmentRoute.POST(assignmentRequest(true));
    if (assignmentResponse.status !== 403 || assignmentState.rpcCalls.length !== 0) {
      fail("capability assignment route did not require AAL2 before database access");
    }

    resetAssignmentState({ data: null, error: { code: "42501" } });
    assignmentResponse = await assignmentRoute.POST(assignmentRequest(true));
    if (assignmentResponse.status !== 403 || assignmentState.rpcCalls.length !== 1) {
      fail("capability assignment route did not preserve transactional actor denial");
    }

    resetAssignmentState({ data: null, error: { code: "23505" } });
    assignmentResponse = await assignmentRoute.POST(assignmentRequest(true));
    if (assignmentResponse.status !== 409 || assignmentState.rpcCalls.length !== 1) {
      fail("capability assignment route did not preserve transactional binding-conflict denial");
    }

    resetAssignmentState({ data: null, error: { code: "23503" } });
    assignmentResponse = await assignmentRoute.POST(assignmentRequest(true));
    if (assignmentResponse.status !== 503 || assignmentState.rpcCalls.length !== 1) {
      fail("capability assignment route retried or bypassed a transactional audit failure");
    }

    resetAssignmentState({
      data: {
        employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        shop_id: syntheticShopId,
        capability_code: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_CODE,
        capability_version: authority.ADMINISTRATIVE_COMPLETION_CAPABILITY_VERSION,
        enabled: true,
      },
      error: null,
    });
    assignmentResponse = await assignmentRoute.POST(assignmentRequest(true));
    if (assignmentResponse.status !== 503) {
      fail("capability assignment route trusted an RPC result for a different employee");
    }
  } finally {
    removeValidatedSyntheticTempDirectory(syntheticDirectory);
  }

  console.log(
    "F03 Control authorization verification passed: exact employee/capability authority; stable pre/post-password identity; canonical v2 HMAC grants; live verification recheck; versioned deny-legacy directory projection; one-RPC transactional AAL2 capability assignment; deny-by-default migration.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
