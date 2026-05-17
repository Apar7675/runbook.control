export const READINESS_STATUSES = ["ready", "needs_attention", "not_ready", "not_checked"] as const;

export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export type ReadinessCheck = {
  key: string;
  label: string;
  status: ReadinessStatus;
  message: string | null;
};

export type ReadinessReportRow = {
  id: string;
  shop_id: string;
  device_id: string | null;
  computer_name: string;
  reported_by_user_id: string | null;
  overall_status: ReadinessStatus;
  score: number | null;
  summary: string | null;
  checks: ReadinessCheck[];
  app_version: string | null;
  service_version: string | null;
  os_summary: string | null;
  machine_summary: Record<string, string | number | boolean | null> | null;
  created_at: string | null;
  updated_at: string | null;
  reported_at: string | null;
};

type UnsafeJson = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function isReadinessStatus(value: string): value is ReadinessStatus {
  return READINESS_STATUSES.includes(value as ReadinessStatus);
}

export function normalizeReadinessStatus(value: unknown): ReadinessStatus {
  const status = text(value).toLowerCase();
  return isReadinessStatus(status) ? status : "not_checked";
}

function looksLikeLocalPath(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[a-z]:\\/.test(normalized) || normalized.startsWith("\\\\") || normalized.includes("/users/") || normalized.includes("/home/");
}

function safeText(value: unknown, fallback = "") {
  const normalized = text(value, fallback);
  return looksLikeLocalPath(normalized) ? "" : normalized;
}

export function sanitizeMachineSummary(value: unknown): Record<string, string | number | boolean | null> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const source = value as UnsafeJson;
  const allowedKeys = [
    "cpu_model",
    "logical_cores",
    "ram_gb",
    "disk_total_gb",
    "disk_free_gb",
    "gpu",
    "is_virtual_machine",
    "service_running",
    "internet_reachable",
  ];

  const result: Record<string, string | number | boolean | null> = {};

  for (const key of allowedKeys) {
    const current = source[key];
    if (typeof current === "string") {
      const next = safeText(current);
      result[key] = next || null;
    } else if (typeof current === "number" || typeof current === "boolean" || current === null) {
      result[key] = current;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function sanitizeReadinessChecks(value: unknown): ReadinessCheck[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const row = entry as UnsafeJson;
      const key = safeText(row.key, `check_${index + 1}`) || `check_${index + 1}`;
      const label = safeText(row.label, key) || key;
      const status = normalizeReadinessStatus(row.status);
      const message = safeText(row.message);

      return {
        key,
        label,
        status,
        message: message || null,
      } satisfies ReadinessCheck;
    })
    .filter((entry): entry is ReadinessCheck => !!entry);
}

export function sanitizeReadinessPayload(body: unknown) {
  const source = body && typeof body === "object" && !Array.isArray(body) ? (body as UnsafeJson) : {};
  const overall_status = normalizeReadinessStatus(source.overall_status);
  const scoreRaw = Number(source.score);
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : null;
  const computer_name = safeText(source.computer_name);
  const summary = safeText(source.summary) || null;
  const app_version = safeText(source.app_version) || null;
  const service_version = safeText(source.service_version) || null;
  const os_summary = safeText(source.os_summary) || null;
  const reported_at = safeText(source.reported_at) || null;
  const checks = sanitizeReadinessChecks(source.checks);
  const machine_summary = sanitizeMachineSummary(source.machine_summary);
  const device_id = text(source.device_id) || null;

  return {
    computer_name,
    device_id,
    overall_status,
    score,
    summary,
    checks,
    app_version,
    service_version,
    os_summary,
    machine_summary,
    reported_at,
  };
}

export function countIssueChecks(checks: ReadinessCheck[]) {
  return checks.filter((check) => check.status === "needs_attention" || check.status === "not_ready").length;
}

export function formatReadinessStatus(status: ReadinessStatus) {
  if (status === "ready") return "Ready";
  if (status === "needs_attention") return "Needs Attention";
  if (status === "not_ready") return "Not Ready";
  return "Not Checked";
}
