const fs = require("node:fs");
const path = require("node:path");

const expectedTables = Object.freeze([
  "attachments",
  "balloon_sets",
  "component_aliases",
  "component_files",
  "components",
  "daily_logs",
  "inspection_sets",
  "jobs",
  "op_sessions",
  "operations",
  "operators",
  "po_line_items",
  "purchase_orders",
  "routing_operations",
  "tenants",
  "travelers",
]);

const repositoryRoot = path.resolve(__dirname, "..");
const migrationPath = path.join(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260904123134_deny_legacy_manufacturing_client_access.sql",
);
const assertionPath = path.join(
  repositoryRoot,
  "supabase",
  "tests",
  "f04_legacy_manufacturing_lockdown.sql",
);

function fail(message) {
  throw new Error(`F04 static verification failed: ${message}`);
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

function assertExactCoverage(label, actualTables) {
  const counts = new Map();
  for (const table of actualTables) {
    counts.set(table, (counts.get(table) ?? 0) + 1);
  }

  const missing = expectedTables.filter((table) => !counts.has(table));
  const extra = [...counts.keys()].filter((table) => !expectedTables.includes(table));
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count !== 1)
    .map(([table, count]) => `${table} (${count})`);

  if (missing.length || extra.length || duplicates.length) {
    fail(
      `${label} coverage mismatch; missing=[${missing.join(", ")}], ` +
      `extra=[${extra.join(", ")}], duplicates=[${duplicates.join(", ")}]`,
    );
  }
}

const migrationSql = readRequired(migrationPath);
const executableMigrationSql = stripSqlComments(migrationSql);
const statements = executableMigrationSql
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

const revokePattern = /^revoke\s+all\s+privileges\s+on\s+table\s+public\.([a-z_]+)\s+from\s+anon\s*,\s*authenticated$/i;
const rlsPattern = /^alter\s+table\s+public\.([a-z_]+)\s+enable\s+row\s+level\s+security$/i;
const revokedTables = [];
const rlsTables = [];

for (const statement of statements) {
  const revokeMatch = revokePattern.exec(statement);
  if (revokeMatch) {
    revokedTables.push(revokeMatch[1].toLowerCase());
    continue;
  }

  const rlsMatch = rlsPattern.exec(statement);
  if (rlsMatch) {
    rlsTables.push(rlsMatch[1].toLowerCase());
    continue;
  }

  fail(`unexpected migration statement: ${statement.replace(/\s+/g, " ")}`);
}

if (statements.length !== expectedTables.length * 2) {
  fail(`expected 32 migration statements, found ${statements.length}`);
}

assertExactCoverage("REVOKE", revokedTables);
assertExactCoverage("RLS", rlsTables);

if (/\bgrant\b/i.test(executableMigrationSql)) {
  fail("migration contains a GRANT statement");
}
if (/\b(?:create|alter)\s+policy\b/i.test(executableMigrationSql)) {
  fail("migration creates or alters an RLS policy");
}
if (/\bdisable\s+row\s+level\s+security\b/i.test(executableMigrationSql)) {
  fail("migration disables RLS");
}
if (/\b(?:insert\s+into|update|delete\s+from|truncate\s+table|merge\s+into)\b/i.test(executableMigrationSql)) {
  fail("migration contains row-changing SQL");
}

const assertionSql = readRequired(assertionPath);
const assertionTargets = [
  ...assertionSql.matchAll(/'public\.([a-z_]+)'/g),
].map((match) => match[1]);
assertExactCoverage("SQL assertion", assertionTargets);

for (const requiredPattern of [
  /begin\s+transaction\s+read\s+only/i,
  /relrowsecurity/i,
  /has_table_privilege/i,
  /has_any_column_privilege/i,
  /pg_catalog\.pg_policies/i,
  /rollback\s*;/i,
]) {
  if (!requiredPattern.test(assertionSql)) {
    fail(`SQL assertion is missing ${requiredPattern}`);
  }
}

console.log(
  `F04 static verification passed: ${expectedTables.length} exact tables, ` +
  `${statements.length} authorization-only migration statements.`,
);
