const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const paths = {
  migration: path.join(root, "supabase", "migrations", "20260904131500_messaging_client_authority_boundary.sql"),
  contract: path.join(root, "supabase", "blocked", "f06_messaging_legacy_contract_after_mobile_adoption.BLOCKED.sql"),
  catalog: path.join(root, "supabase", "tests", "f06_messaging_boundary_catalog.sql"),
  actors: path.join(root, "supabase", "tests", "f06_messaging_actor_matrix.sql"),
  route: path.join(root, "src", "app", "api", "desktop", "messaging", "route.ts"),
  summary: path.join(root, "src", "app", "api", "desktop", "messaging-summary", "route.ts"),
  bearer: path.join(root, "src", "lib", "supabase", "bearer.ts"),
  billingGuard: path.join(root, "src", "lib", "billing", "writeGuard.ts"),
  onboarding: path.join(root, "src", "app", "api", "onboarding", "create-shop", "route.ts"),
  provisioning: path.join(root, "src", "app", "api", "desktop", "provision-employee", "route.ts"),
};

function fail(message) {
  throw new Error(`F06 static verification failed: ${message}`);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`missing ${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requirePattern(source, pattern, label) {
  if (!pattern.test(source)) fail(`missing ${label}`);
}

function forbidPattern(source, pattern, label) {
  if (pattern.test(source)) fail(`contains forbidden ${label}`);
}

function functionBlock(sql, name) {
  const start = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${escapeRegex(name)}\\s*\\(`,
    "i",
  ).exec(sql);
  if (!start) fail(`missing public.${name}`);
  const open = sql.indexOf("$function$", start.index);
  const close = sql.indexOf("$function$;", open + 10);
  if (open < 0 || close < 0) fail(`malformed public.${name}`);
  return sql.slice(start.index, close + 11);
}

const migration = stripComments(read(paths.migration));
const rawContract = read(paths.contract);
const contract = stripComments(rawContract);
const route = read(paths.route);
const summary = read(paths.summary);
const bearer = read(paths.bearer);
const onboarding = read(paths.onboarding);
const provisioning = read(paths.provisioning);

const tables = [
  "conversation_archives",
  "conversation_members",
  "conversations",
  "message_reactions",
  "message_reads",
  "messages",
  "messaging_roster",
];

for (const table of tables) {
  requirePattern(
    migration,
    new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
    `${table} RLS enablement`,
  );
  requirePattern(
    migration,
    new RegExp(`revoke\\s+all\\s+privileges\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated`, "i"),
    `${table} client ACL reset`,
  );
}

requirePattern(migration, /pg_catalog\.pg_policies[\s\S]*tablename\s*=\s*any\s*\(\s*array\[/i, "complete prior-policy removal");
requirePattern(migration, /grant\s+select\s+on\s+table\s+public\.messages\s+to\s+authenticated/i, "Realtime messages SELECT");
requirePattern(migration, /grant\s+select\s+on\s+table\s+public\.message_reactions\s+to\s+authenticated/i, "Realtime reactions SELECT");
requirePattern(migration, /grant\s+insert\s*\(\s*shop_id\s*,\s*conversation_id\s*,\s*sender_employee_id\s*,\s*body\s*\)[\s\S]*?public\.messages\s+to\s+authenticated/i, "expand-phase sender-bound message INSERT");
requirePattern(migration, /grant\s+delete\s+on\s+table\s+public\.conversation_archives\s+to\s+authenticated/i, "expand-phase self-bound archive DELETE");
requirePattern(migration, /grant\s+select\s*\(\s*shop_id\s*,\s*conversation_id\s*,\s*employee_id\s*\)[\s\S]*?public\.conversation_archives\s+to\s+authenticated/i, "archive DELETE predicate column reads");

let grantsWithoutCompatibility = migration
  .replace(/grant\s+insert\s*\(\s*shop_id\s*,\s*conversation_id\s*,\s*sender_employee_id\s*,\s*body\s*\)[\s\S]*?to\s+authenticated\s*;/i, "")
  .replace(/grant\s+delete\s+on\s+table\s+public\.conversation_archives\s+to\s+authenticated\s*;/i, "");
forbidPattern(
  grantsWithoutCompatibility,
  /grant\s+(?:insert|update|delete|all)[^;]*to\s+(?:anon|authenticated)/i,
  "unscoped direct client table write",
);
requirePattern(migration, /information_schema\.columns[\s\S]*revoke select \(%1\$I\), insert \(%1\$I\), update \(%1\$I\), references \(%1\$I\)/i, "defensive column ACL reset");

const syncRoster = functionBlock(migration, "rb_sync_employee_messaging_roster");
for (const [pattern, label] of [
  [/security\s+definer/i, "SECURITY DEFINER"],
  [/set\s+search_path\s*=\s*pg_catalog\s*,\s*public/i, "fixed search_path"],
  [/set\s+row_security\s*=\s*off/i, "fixed row_security"],
  [/new\.is_active\s+and\s+new\.can_messaging/i, "employee-derived active projection"],
  [/on\s+conflict\s*\(\s*shop_id\s*,\s*employee_id\s*\)/i, "atomic roster upsert"],
]) requirePattern(syncRoster, pattern, `roster trigger ${label}`);
requirePattern(migration, /create\s+trigger\s+trg_rb_sync_employee_messaging_roster[\s\S]*after\s+insert\s+or\s+update\s+of\s+shop_id\s*,\s*is_active\s*,\s*can_messaging\s+on\s+public\.employees/i, "employee roster projection trigger");
requirePattern(migration, /insert\s+into\s+public\.messaging_roster[\s\S]*from\s+public\.employees\s+as\s+employee[\s\S]*do\s+update\s+set\s+is_active\s*=\s*excluded\.is_active/i, "pre-existing employee roster backfill");
forbidPattern(onboarding, /from\s*\(\s*["']messaging_roster["']\s*\)/i, "non-transactional onboarding roster write");
forbidPattern(provisioning, /from\s*\(\s*["']messaging_roster["']\s*\)/i, "non-transactional provisioning roster write");

const fullAccess = functionBlock(migration, "rb_messaging_shop_has_full_remote_access");
for (const [pattern, label] of [
  [/deletion_status/i, "deletion status"],
  [/deletion_started_at\s+is\s+not\s+null/i, "deletion start"],
  [/entitlement_override[\s\S]*restricted/i, "restricted entitlement override"],
  [/entitlement_override[\s\S]*allow/i, "allow entitlement override"],
  [/manual_billing_override/i, "manual billing switch"],
  [/trial_active[\s\S]*trial_extended[\s\S]*paid_active/i, "manual full-access statuses"],
  [/billing_status[\s\S]*active[\s\S]*trialing/i, "system full-access statuses"],
  [/statement_timestamp\(\)\s*<=\s*shop\.trial_ends_at/i, "inclusive canonical trial expiry"],
]) requirePattern(fullAccess, pattern, `canonical full entitlement ${label}`);

const actor = functionBlock(migration, "rb_messaging_actor_employee_id");
for (const [pattern, label] of [
  [/auth\.uid\(\)/i, "bearer user derivation"],
  [/membership\.shop_id\s*=\s*p_shop_id/i, "exact shop membership"],
  [/membership\.user_id\s*=\s*auth\.uid\(\)/i, "exact user membership"],
  [/membership\.is_active\s*=\s*true/i, "active membership"],
  [/e\.is_active\s*=\s*true/i, "active employee"],
  [/e\.runbook_access_enabled\s*=\s*true/i, "RunBook access"],
  [/e\.mobile_access_enabled\s*=\s*true/i, "Mobile access"],
  [/e\.can_messaging\s*=\s*true/i, "messaging capability"],
  [/roster\.is_active\s*=\s*true/i, "active roster"],
  [/rb_messaging_shop_has_full_remote_access/i, "full remote entitlement"],
  [/cardinality[\s\S]*<>\s*1/i, "exactly one actor"],
]) requirePattern(actor, pattern, `actor resolver ${label}`);

const assertion = functionBlock(migration, "rb_messaging_assert_actor_employee_id");
requirePattern(assertion, /rb_messaging_require_actor_employee_id/i, "Desktop assertion server actor derivation");
requirePattern(assertion, /p_asserted_employee_id\s*<>\s*actor_employee_id/i, "Desktop assertion equality check");
requirePattern(assertion, /errcode\s*=\s*'42501'/i, "Desktop assertion authorization failure");

const entrypoints = [
  ["rb_messaging_actor_employee_id", "uuid"],
  ["rb_messaging_assert_actor_employee_id", "uuid, uuid"],
  ["rb_messaging_can_read_conversation", "uuid, uuid"],
  ["rb_messaging_can_read_message", "uuid, uuid, uuid"],
  ["rb_messaging_roster", "uuid"],
  ["rb_messaging_find_dm", "uuid, uuid"],
  ["rb_messaging_get_or_create_dm", "uuid, uuid"],
  ["rb_messaging_create_conversation", "uuid, text, text, uuid[]"],
  ["rb_messaging_list_messages", "uuid, uuid, integer"],
  ["rb_messaging_send_message", "uuid, uuid, text"],
  ["rb_messaging_send_dm", "uuid, uuid, text"],
  ["rb_messaging_conversation_header", "uuid, uuid"],
  ["rb_messaging_inbox", "uuid"],
  ["rb_messaging_archived_inbox", "uuid"],
  ["rb_messaging_dm_summary", "uuid"],
  ["rb_messaging_mark_read", "uuid, uuid"],
  ["rb_messaging_archive_for_me", "uuid, uuid"],
  ["rb_messaging_unarchive_for_me", "uuid, uuid"],
  ["rb_messaging_reaction_summary", "uuid, uuid"],
  ["rb_messaging_toggle_reaction", "uuid, uuid, uuid, text"],
];

for (const [name, signature] of entrypoints) {
  const block = functionBlock(migration, name);
  requirePattern(block, /security\s+definer/i, `${name} SECURITY DEFINER`);
  requirePattern(block, /set\s+search_path\s*=\s*pg_catalog\s*,\s*public/i, `${name} fixed search_path`);
  requirePattern(block, /set\s+row_security\s*=\s*off/i, `${name} fixed row_security`);
  const args = signature.replace(/\s+/g, "\\s*").replace(/\[\]/g, "\\[\\]");
  requirePattern(
    migration,
    new RegExp(`revoke\\s+all\\s+privileges\\s+on\\s+function\\s+public\\.${escapeRegex(name)}\\s*\\(\\s*${args}\\s*\\)\\s+from\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`, "i"),
    `${name} four-role ACL reset`,
  );
  requirePattern(
    migration,
    new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${escapeRegex(name)}\\s*\\(\\s*${args}\\s*\\)\\s+to\\s+authenticated\\s*,\\s*service_role`, "i"),
    `${name} exact entrypoint grant`,
  );
}

const createConversation = functionBlock(migration, "rb_messaging_create_conversation");
requirePattern(createConversation, /cardinality\s*\(\s*coalesce\s*\(\s*p_member_employee_ids[\s\S]*>\s*50/i, "group member array pre-UNNEST bound");
requirePattern(createConversation, /pg_catalog\.left\s*\([\s\S]*pg_catalog\.string_agg[\s\S]*,\s*200\s*\)/i, "blank generated group title bound");
const createDm = functionBlock(migration, "rb_messaging_get_or_create_dm");
requirePattern(createDm, /pg_advisory_xact_lock[\s\S]*hashtextextended/i, "serialized DM creation");

const compatibility = [
  ["get_inbox", "uuid"],
  ["get_conversation_header", "uuid, uuid"],
  ["get_archived_inbox", "uuid"],
  ["archive_conversation_for_me", "uuid, uuid"],
  ["create_conversation", "uuid, text, text, uuid[]"],
  ["get_or_create_dm", "uuid, uuid, uuid"],
  ["get_or_create_dm", "uuid, uuid"],
  ["mark_conversation_read_now", "uuid"],
  ["mark_conversation_read_now", "uuid, uuid"],
  ["get_reaction_summary_for_conversation", "uuid, uuid"],
  ["toggle_my_message_reaction", "uuid, uuid, uuid, text"],
];
for (const [name, signature] of compatibility) {
  const args = signature.replace(/\s+/g, "\\s*").replace(/\[\]/g, "\\[\\]");
  requirePattern(
    migration,
    new RegExp(`revoke\\s+all\\s+privileges\\s+on\\s+function\\s+public\\.${escapeRegex(name)}\\s*\\(\\s*${args}\\s*\\)\\s+from\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`, "i"),
    `${name}(${signature}) compatibility ACL reset`,
  );
  requirePattern(
    migration,
    new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${escapeRegex(name)}\\s*\\(\\s*${args}\\s*\\)\\s+to\\s+authenticated`, "i"),
    `${name}(${signature}) authenticated compatibility grant`,
  );
}

requirePattern(migration, /to_regprocedure\s*\(\s*signature\s*\)[\s\S]*revoke all privileges on function[\s\S]*PUBLIC, anon, authenticated, service_role/i, "drift-safe four-role legacy retirement");
forbidPattern(migration, /revoke\s+all\s+privileges\s+on\s+function\s+public\.(?:archive_conversation|create_conversation_with_members|get_conversation_titles|get_unread_counts|rename_group_conversation|my_roster_active|rb_is_active_in_messaging|rb_is_conversation_member|rb_me_roster_active|bump_conversation_updated_at|conversations_title_check)\b/i, "unconditional absent-sensitive legacy REVOKE");

requirePattern(rawContract, /BLOCKED[\s\S]*DO NOT AUTO-APPLY/i, "blocked contract warning");
requirePattern(contract, /raise\s+exception[\s\S]*BLOCKED pending Mobile minimum-version adoption/i, "fail-closed contract guard");
requirePattern(contract, /revoke\s+insert[\s\S]*public\.messages[\s\S]*revoke\s+delete[\s\S]*public\.conversation_archives/i, "contract direct-write removal");
requirePattern(contract, /drop\s+policy\s+if\s+exists\s+"rb_messaging_messages_insert_actor_compat"[\s\S]*rb_messaging_conversation_archives_delete_actor_compat/i, "contract compatibility policy removal");
requirePattern(contract, /revoke\s+execute\s+on\s+function\s+public\.rb_messaging_actor_employee_id\s*\(\s*uuid\s*\)[\s\S]*from\s+authenticated/i, "contract returns nullable actor resolver to private scope");
if (paths.contract.includes(`${path.sep}migrations${path.sep}`)) fail("blocked contract is in the automatic migration path");

for (const [label, source] of [["messaging route", route], ["summary route", summary]]) {
  forbidPattern(source, /headers\.get\s*\(\s*["']host["']|localhost|127\.0\.0\.1|local-dev/i, `${label} local auth bypass`);
  forbidPattern(source, /supabaseAdmin|SUPABASE_SERVICE_ROLE_KEY/, `${label} service-role bypass`);
  requirePattern(source, /requireSessionUser\s*\(/, `${label} verified bearer`);
  requirePattern(source, /supabaseForAccessToken\s*\(/, `${label} bearer-scoped Supabase client`);
  requirePattern(source, /sender_employee_id/, `${label} Desktop sender assertion field`);
  requirePattern(source, /rb_messaging_assert_actor_employee_id/, `${label} server actor assertion`);
  requirePattern(source, /Cache-Control["']?\s*:\s*["']no-store/i, `${label} no-store responses`);
  requirePattern(source, /MAXIMUM_JSON_RESPONSE_BYTES/, `${label} response size bound`);
  requirePattern(source, /rateLimitOrThrow\s*\(/, `${label} request rate limit`);
  forbidPattern(source, /throw\s+new\s+Error\s*\(\s*(?:error|\w+Error)\.message\s*\)/, `${label} raw database error throw`);
}
requirePattern(route, /readBoundedExactJsonObject\s*\(/, "bounded Desktop send JSON parser");
forbidPattern(route, /req\.json\s*\(/, "raw Desktop send req.json");
requirePattern(route, /shop_id:\s*["']string["'][\s\S]*sender_employee_id:\s*["']string["'][\s\S]*recipient_employee_id:\s*["']string["'][\s\S]*body:\s*["']string["']/, "exact Desktop send body schema");
requirePattern(route, /UUID_PATTERN[\s\S]*MAXIMUM_MESSAGE_CHARACTERS\s*=\s*10_000/, "Desktop UUID/body bounds");
const post = route.slice(route.indexOf("export async function POST"));
const auth = post.indexOf("requireMessagingSession(req)");
const parser = post.indexOf("readBoundedExactJsonObject(req");
const assertionCall = post.indexOf("await assertDesktopActor(");
const entitlement = post.indexOf("requireShopEntitlementWriteAllowed(");
const send = post.indexOf('client.rpc("rb_messaging_send_dm"');
if (auth < 0 || parser <= auth || assertionCall <= parser || entitlement <= assertionCall || send <= entitlement) {
  fail("Desktop POST is not auth -> bounded parse -> actor assertion -> entitlement -> atomic send");
}
const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
if (get.indexOf("requireMessagingSession(req)") < 0 || get.indexOf("await assertDesktopActor(") < 0 || get.indexOf('client.rpc("rb_messaging_find_dm"') <= get.indexOf("await assertDesktopActor(")) {
  fail("Desktop GET does not assert the bearer-bound sender before reading the conversation");
}
forbidPattern(get, /rb_messaging_get_or_create_dm|rb_messaging_send_dm|\.insert\s*\(/, "Desktop GET mutation");
if (summary.indexOf("rb_messaging_assert_actor_employee_id") > summary.indexOf("rb_messaging_dm_summary")) {
  fail("summary reads messages before asserting the bearer-bound sender");
}
requirePattern(bearer, /Authorization:\s*`Bearer\s+\$\{token\}`/, "verified bearer forwarding");
requirePattern(route, /@\/lib\/billing\/writeGuard/, "explicit billing guard dependency");
read(paths.billingGuard);

const membershipBlock = provisioning.slice(
  provisioning.indexOf("async function getShopMembership"),
  provisioning.indexOf("async function getSeatInfo"),
);
requirePattern(membershipBlock, /\.select\s*\(\s*["']id, role["']\s*\)/, "provisioner role lookup");
requirePattern(membershipBlock, /\.eq\s*\(\s*["']is_active["']\s*,\s*true\s*\)/, "provisioner active membership lookup");
requirePattern(membershipBlock, /role\s*!==\s*["']owner["'][\s\S]*role\s*!==\s*["']admin["']/, "provisioner owner/admin restriction");
const handler = provisioning.slice(provisioning.indexOf("export async function POST"));
const membershipCheck = handler.indexOf("await getShopMembership(admin, shopId, user.id)");
const firstMutation = Math.min(
  ...[".auth.admin.createUser(", "await upsertShopMember(", '.from("employees")\n        .update(', '.from("employees")\n        .insert(']
    .map((needle) => handler.indexOf(needle))
    .filter((index) => index >= 0),
);
if (membershipCheck < 0 || !Number.isFinite(firstMutation) || membershipCheck >= firstMutation) {
  fail("provisioner does not establish active owner/admin authority before every mutation");
}

const catalog = read(paths.catalog);
const actors = read(paths.actors);
for (const [pattern, label] of [
  [/begin\s+transaction\s+read\s+only/i, "read-only transaction"],
  [/pg_catalog\.pg_policies/i, "policy catalog checks"],
  [/has_function_privilege/i, "function ACL checks"],
  [/service_role/i, "service_role ACL checks"],
  [/absent[\s\S]*no.execute|function_oid\s+is\s+not\s+null/i, "absent-or-no-execute retirement checks"],
  [/rollback\s*;/i, "catalog rollback"],
]) requirePattern(catalog, pattern, `catalog ${label}`);
for (const [pattern, label] of [
  [/begin\s*;/i, "transaction"],
  [/insert\s+into\s+auth\.users/i, "synthetic auth fixtures"],
  [/runbook_access_enabled/i, "RunBook denial case"],
  [/mobile_access_enabled/i, "Mobile denial case"],
  [/can_messaging/i, "messaging denial case"],
  [/deletion_status/i, "shop deletion denial case"],
  [/entitlement_override/i, "entitlement override cases"],
  [/manual_billing_status/i, "manual entitlement cases"],
  [/rb_messaging_assert_actor_employee_id/i, "Desktop sender assertion case"],
  [/get_inbox/i, "legacy compatibility case"],
  [/set\s+local\s+role\s+authenticated/i, "authenticated execution"],
  [/set\s+local\s+role\s+anon/i, "anonymous denial"],
  [/rollback\s*;/i, "fixture rollback"],
]) requirePattern(actors, pattern, `actor matrix ${label}`);
requirePattern(actors, /@example\.invalid/i, "clearly synthetic actor fixtures");

let topLevel = migration
  .replace(/as\s+\$function\$[\s\S]*?\$function\$\s*;/gi, "")
  .replace(/do\s+\$([a-z0-9_]+)\$[\s\S]*?\$\1\$\s*;/gi, "");
const expectedBackfill = /insert\s+into\s+public\.messaging_roster\s*\([\s\S]*?do\s+update\s+set\s+is_active\s*=\s*excluded\.is_active\s*;/i;
if (!expectedBackfill.test(topLevel)) fail("could not isolate the one expected top-level roster backfill");
topLevel = topLevel.replace(expectedBackfill, "");
if (/\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate\s+table|merge\s+into)\b/i.test(topLevel)) {
  fail("migration contains an unexpected top-level row-changing statement");
}

console.log(
  `F06 static verification passed: ${tables.length} RLS tables, ${entrypoints.length} hardened entrypoints, expand/contract compatibility, atomic roster projection, and bearer-asserted Desktop routes.`,
);
