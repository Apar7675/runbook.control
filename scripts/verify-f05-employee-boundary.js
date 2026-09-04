const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const migrationPath = path.join(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260904124500_employee_client_access_boundary.sql",
);
const catalogTestPath = path.join(
  repositoryRoot,
  "supabase",
  "tests",
  "f05_employee_client_boundary_catalog.sql",
);
const actorTestPath = path.join(
  repositoryRoot,
  "supabase",
  "tests",
  "f05_employee_client_boundary_actor.sql",
);

const employeePolicies = Object.freeze([
  "employees read self",
  "employees_foreman_manage",
  "employees_read_if_active_in_messaging",
  "employees_select_own",
  "employees_select_same_shop",
  "employees_select_self",
  "employees_update_self",
]);
const dependentPolicies = Object.freeze([
  ["conversation_members_select_self", "public.conversation_members"],
  ["roster_select_shop_member", "public.messaging_roster"],
]);
const retiredAvatarPolicies = Object.freeze([
  "avatars_read 1oj01fe_0",
  "avatars_read 1oj01fe_1",
  "avatars_read",
  "avatars_update_authenticated",
  "avatars_upload_authenticated 1oj01fe_0",
  "avatars_upload_authenticated",
]);
const expectedAvatarPolicies = Object.freeze([
  ["rb_avatars_select_active_shop_member", "select", "rb_can_read_shop_avatar_object"],
  ["rb_avatars_insert_self", "insert", "rb_can_manage_my_avatar_object"],
  ["rb_avatars_update_self", "update", "rb_can_manage_my_avatar_object"],
]);
const projectionFunctions = Object.freeze([
  ["rb_mobile_employee_self", "uuid"],
  ["rb_mobile_employee_directory", "uuid"],
  ["rb_mobile_update_my_avatar", "uuid, text, text"],
]);
const hardenedFunctions = Object.freeze([
  ["current_employee", ""],
  ["current_employee_clock", ""],
  ["current_employee_id", "uuid"],
  ["get_my_employee_id", "uuid"],
  ["is_foreman_employee", "uuid"],
  ["is_messaging_active_employee", "uuid"],
  ["my_employee", ""],
  ["my_employee_id", "uuid"],
  ["rb_current_employee_id", "uuid"],
  ["rb_my_employee_id", "uuid"],
  ["rb_can_read_shop_avatar_object", "text"],
  ["rb_can_manage_my_avatar_object", "text"],
  ...projectionFunctions,
]);
const expectedProjectionFields = Object.freeze([
  "id",
  "shop_id",
  "display_name",
  "is_active",
  "avatar_url_256",
  "avatar_url_512",
]);

function fail(message) {
  throw new Error(`F05 static verification failed: ${message}`);
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`missing ${path.relative(repositoryRoot, filePath)}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function functionBlock(sql, name) {
  const startPattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${regexEscape(name)}\\s*\\(`,
    "i",
  );
  const startMatch = startPattern.exec(sql);
  if (!startMatch) fail(`missing function definition public.${name}`);

  const openingDelimiter = sql.indexOf("$function$", startMatch.index);
  const closingDelimiter = sql.indexOf("$function$;", openingDelimiter + "$function$".length);
  if (openingDelimiter < 0 || closingDelimiter < 0) {
    fail(`malformed function delimiter for public.${name}`);
  }
  return sql.slice(startMatch.index, closingDelimiter + "$function$;".length);
}

const migrationSql = readRequired(migrationPath);
const executableMigrationSql = stripSqlComments(migrationSql);

if (!/alter\s+table\s+public\.employees\s+enable\s+row\s+level\s+security\s*;/i.test(executableMigrationSql)) {
  fail("employees RLS is not explicitly enabled");
}
if (!/revoke\s+all\s+privileges\s+on\s+table\s+public\.employees\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;/i.test(executableMigrationSql)) {
  fail("employees table privileges are not revoked from PUBLIC, anon, and authenticated");
}
if (!/revoke select \(%1\$s\), insert \(%1\$s\), update \(%1\$s\), references \(%1\$s\)/i.test(executableMigrationSql)) {
  fail("employees column privileges are not revoked defensively");
}
if (/grant\s+[^;]*on\s+(?:table\s+)?public\.employees\b/i.test(executableMigrationSql)) {
  fail("migration grants a privilege on the employees table");
}
if (/disable\s+row\s+level\s+security/i.test(executableMigrationSql)) {
  fail("migration disables RLS");
}
if (/create\s+policy\s+[^;]*\s+on\s+public\.employees\b/i.test(executableMigrationSql)) {
  fail("migration creates a client policy on employees");
}
const privateBucketPattern = /insert\s+into\s+storage\.buckets\s*\(\s*id\s*,\s*name\s*,\s*public\s*\)\s*values\s*\(\s*'avatars'\s*,\s*'avatars'\s*,\s*false\s*\)\s*on\s+conflict\s*\(\s*id\s*\)\s*do\s+update\s+set\s+public\s*=\s*false\s*;/i;
if (!privateBucketPattern.test(executableMigrationSql)) {
  fail("avatars bucket is not explicitly private");
}

const actualPolicyDrops = [
  ...executableMigrationSql.matchAll(
    /drop\s+policy\s+if\s+exists\s+"([^"]+)"\s+on\s+(public|storage)\.([a-z_]+)\s*;/gi,
  ),
].map((match) => [match[1], `${match[2].toLowerCase()}.${match[3].toLowerCase()}`]);
const expectedPolicyDrops = [
  ...employeePolicies.map((name) => [name, "public.employees"]),
  ...dependentPolicies,
  ...retiredAvatarPolicies.map((name) => [name, "storage.objects"]),
];
if (
  actualPolicyDrops.length !== expectedPolicyDrops.length ||
  expectedPolicyDrops.some(
    ([name, table]) =>
      actualPolicyDrops.filter(([actualName, actualTable]) => actualName === name && actualTable === table)
        .length !== 1,
  )
) {
  fail(`policy-drop scope mismatch: ${JSON.stringify(actualPolicyDrops)}`);
}

const actualAvatarPolicyNames = [
  ...executableMigrationSql.matchAll(
    /create\s+policy\s+"([^"]+)"\s+on\s+storage\.objects\s+as\s+permissive\s+for\s+(select|insert|update)\s+to\s+authenticated/gi,
  ),
].map((match) => [match[1], match[2].toLowerCase()]);
if (
  actualAvatarPolicyNames.length !== expectedAvatarPolicies.length ||
  expectedAvatarPolicies.some(
    ([name, command]) =>
      actualAvatarPolicyNames.filter(
        ([actualName, actualCommand]) => actualName === name && actualCommand === command,
      ).length !== 1,
  )
) {
  fail(`avatar-policy scope mismatch: ${JSON.stringify(actualAvatarPolicyNames)}`);
}
for (const [name, , helper] of expectedAvatarPolicies) {
  const start = executableMigrationSql.indexOf(`create policy "${name}"`);
  const end = executableMigrationSql.indexOf(";", start);
  const policy = executableMigrationSql.slice(start, end + 1);
  if (!/bucket_id\s*=\s*'avatars'/i.test(policy) || !policy.includes(`public.${helper}(name)`)) {
    fail(`${name} is not pinned to the avatars bucket and ${helper}`);
  }
}

for (const [name, signature] of hardenedFunctions) {
  const block = functionBlock(executableMigrationSql, name);
  for (const requiredPattern of [
    /security\s+definer/i,
    /set\s+search_path\s*=\s*pg_catalog\s*,\s*public/i,
    /set\s+row_security\s*=\s*off/i,
  ]) {
    if (!requiredPattern.test(block)) {
      fail(`public.${name} is missing ${requiredPattern}`);
    }
  }

  if (!/rb_shop_members/i.test(block) || !/\.is_active\s*=\s*true/i.test(block)) {
    fail(`public.${name} does not require an active rb_shop_members row`);
  }

  const normalizedSignature = signature.replace(/\s+/g, "\\s*");
  const revokePattern = new RegExp(
    `revoke\\s+all\\s+privileges\\s+on\\s+function\\s+public\\.${regexEscape(name)}\\s*\\(\\s*${normalizedSignature}\\s*\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
    "i",
  );
  const grantPattern = new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${regexEscape(name)}\\s*\\(\\s*${normalizedSignature}\\s*\\)\\s+to\\s+authenticated\\s*,\\s*service_role\\s*;`,
    "i",
  );
  if (!revokePattern.test(executableMigrationSql) || !grantPattern.test(executableMigrationSql)) {
    fail(`public.${name} does not have the exact client execution ACL`);
  }
}

const currentEmployeeBlock = functionBlock(executableMigrationSql, "current_employee");
if (/select\s+e\.\*/i.test(currentEmployeeBlock)) {
  fail("current_employee still returns the stored employees row");
}
if (!/jsonb_build_object\s*\(\s*'id'\s*,\s*e\.id\s*,\s*'shop_id'\s*,\s*e\.shop_id\s*\)/i.test(currentEmployeeBlock)) {
  fail("current_employee is not reduced to the id/shop compatibility projection");
}

for (const [name] of projectionFunctions) {
  const block = functionBlock(executableMigrationSql, name);
  const resultMatch = /returns\s+table\s*\(([\s\S]*?)\)\s*language/i.exec(block);
  if (!resultMatch) fail(`public.${name} does not declare a TABLE projection`);
  const actualFields = [
    ...resultMatch[1].matchAll(/^\s*([a-z_][a-z0-9_]*)\s+[a-z_]+\s*,?\s*$/gim),
  ].map((match) => match[1].toLowerCase());
  if (
    actualFields.length !== expectedProjectionFields.length ||
    expectedProjectionFields.some((field, index) => actualFields[index] !== field)
  ) {
    fail(`public.${name} projection fields are [${actualFields.join(", ")}]`);
  }
}

const avatarBlock = functionBlock(executableMigrationSql, "rb_mobile_update_my_avatar");
if (/p_employee_id/i.test(avatarBlock)) {
  fail("self-avatar RPC accepts an employee id");
}
if (!/where\s+e\.id\s*=\s*v_employee_id[\s\S]*e\.shop_id\s*=\s*p_shop_id/i.test(avatarBlock)) {
  fail("self-avatar RPC is not pinned to the caller's resolved employee and shop");
}

let migrationWithoutFunctions = executableMigrationSql;
for (const [name] of hardenedFunctions) {
  migrationWithoutFunctions = migrationWithoutFunctions.replace(functionBlock(migrationWithoutFunctions, name), "");
}
migrationWithoutFunctions = migrationWithoutFunctions.replace(privateBucketPattern, "");
if (/\b(?:insert\s+into|update\s+public\.employees|delete\s+from|truncate\s+table|merge\s+into)\b/i.test(migrationWithoutFunctions)) {
  fail("migration performs top-level row-changing SQL");
}

const catalogTestSql = readRequired(catalogTestPath);
for (const requiredPattern of [
  /begin\s+transaction\s+read\s+only/i,
  /has_table_privilege/i,
  /has_any_column_privilege/i,
  /pg_catalog\.pg_policies/i,
  /storage\.buckets/i,
  /has_function_privilege/i,
  /prosecdef/i,
  /proconfig/i,
  /rollback\s*;/i,
]) {
  if (!requiredPattern.test(catalogTestSql)) {
    fail(`catalog assertion is missing ${requiredPattern}`);
  }
}

const actorTestSql = readRequired(actorTestPath);
for (const requiredPattern of [
  /begin\s*;/i,
  /insert\s+into\s+auth\.users/i,
  /insert\s+into\s+public\.employees/i,
  /set\s+local\s+role\s+authenticated/i,
  /set\s+local\s+role\s+anon/i,
  /from\s+public\.employees\s+limit\s+1/i,
  /rb_mobile_employee_self/i,
  /rb_mobile_employee_directory/i,
  /rb_mobile_update_my_avatar/i,
  /rb_can_read_shop_avatar_object/i,
  /rb_can_manage_my_avatar_object/i,
  /current_employee/i,
  /rollback\s*;/i,
]) {
  if (!requiredPattern.test(actorTestSql)) {
    fail(`actor assertion is missing ${requiredPattern}`);
  }
}
if (!/@example\.invalid/i.test(actorTestSql) || /@(?:gmail|outlook|yahoo)\./i.test(actorTestSql)) {
  fail("actor assertion does not use clearly synthetic email fixtures");
}

console.log(
  `F05 static verification passed: server-only employees table, ${expectedProjectionFields.length}-field ` +
    `Mobile projections, ${hardenedFunctions.length} hardened functions, and catalog/actor assertions.`,
);
