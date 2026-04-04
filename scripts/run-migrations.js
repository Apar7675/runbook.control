const { spawnSync } = require("node:child_process");

function getDatabaseUrl() {
  const value = String(process.env.SUPABASE_DB_URL ?? "").trim();
  if (value) {
    return value;
  }

  throw new Error("Supabase not configured. Set SUPABASE_DB_URL or run `npx supabase link`.");
}

function runSupabasePush(args) {
  return spawnSync("npx", ["supabase", "db", "push", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

function printChecklist() {
  console.log("Run these tests:");
  console.log("1. Fresh onboarding");
  console.log("2. Refresh at every step");
  console.log("3. Direct URL bypass attempts");
  console.log("4. Duplicate submit (shop + complete)");
  console.log("5. Stale completion recovery");
}

try {
  const dbUrl = getDatabaseUrl();
  const result = runSupabasePush(["--db-url", dbUrl]);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  printChecklist();
  process.exit(0);
} catch (error) {
  console.log("No SUPABASE_DB_URL found. Attempting local Supabase CLI...");

  const result = runSupabasePush([]);
  if (result.status === 0) {
    printChecklist();
    process.exit(0);
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message) {
    console.error(message);
  }
  console.error("You must either:");
  console.error("- run `npx supabase link`");
  console.error("- OR set SUPABASE_DB_URL");
  process.exit(result.status ?? 1);
}
