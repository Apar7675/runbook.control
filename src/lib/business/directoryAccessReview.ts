// Presentation validation only. The existing Control endpoint owns authorization.
export const directoryCapabilities = ["parties.read", "parties.edit", "parties.archive", "parties.migrate"] as const;
export type DirectoryReview = {
  request_id: string; lease_id: string; action: "create" | "renew" | "revoke"; expected_version: number;
  shop_id: string; user_id: string; device_id: string; session_id: string;
  capability_code: typeof directoryCapabilities[number]; device_binding_hash: string;
  company_binding_version: 1; company_binding_sha256: string; company_binding_epoch: number;
  not_before_utc: string; expires_utc: string; reason: string;
};
const keys = ["request_id", "lease_id", "action", "expected_version", "shop_id", "user_id", "device_id", "session_id", "capability_code", "device_binding_hash", "company_binding_version", "company_binding_sha256", "company_binding_epoch", "not_before_utc", "expires_utc", "reason"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash = /^[A-F0-9]{64}$/;
export function parseDirectoryReview(text: string): DirectoryReview {
  if (text.length > 8192) throw new Error("The review file is too large.");
  const v: unknown = JSON.parse(text);
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("A directory review object is required.");
  const b = v as Record<string, unknown>;
  if (Object.keys(b).length !== keys.length || keys.some(k => !Object.hasOwn(b, k))) throw new Error("Unexpected or missing review fields.");
  for (const k of ["request_id", "lease_id", "shop_id", "user_id", "device_id", "session_id"]) {
    if (typeof b[k] !== "string" || !uuid.test(b[k])) throw new Error("Invalid review identity.");
  }
  if (!["create", "renew", "revoke"].includes(String(b.action)) ||
      !directoryCapabilities.includes(b.capability_code as typeof directoryCapabilities[number]) ||
      b.company_binding_version !== 1 || typeof b.company_binding_epoch !== "number" || !Number.isSafeInteger(b.company_binding_epoch) || b.company_binding_epoch < 1 ||
      typeof b.expected_version !== "number" || !Number.isInteger(b.expected_version) || b.expected_version < 0 || b.expected_version > 2147483646 ||
      typeof b.device_binding_hash !== "string" || !hash.test(b.device_binding_hash) ||
      typeof b.company_binding_sha256 !== "string" || !hash.test(b.company_binding_sha256)) throw new Error("Invalid directory operation or binding.");
  for (const k of ["not_before_utc", "expires_utc"]) {
    if (typeof b[k] !== "string" || !Number.isFinite(Date.parse(b[k])) || new Date(b[k]).toISOString() !== b[k]) throw new Error("Canonical UTC dates are required.");
  }
  if (Date.parse(String(b.expires_utc)) <= Date.parse(String(b.not_before_utc)) ||
      typeof b.reason !== "string" || b.reason.length < 8 || b.reason.length > 1000 || b.reason.trim() !== b.reason) throw new Error("Review the validity and reason.");
  // The existing wire parser requires this exact canonical property order.
  return Object.fromEntries(keys.map(k => [k, b[k]])) as DirectoryReview;
}
