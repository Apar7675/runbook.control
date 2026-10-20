import { createHash } from "node:crypto";
import { BusinessAuthorizationError } from "./directoryAuthorization";

export type DirectoryCompanyBinding = {
  company_binding_version: 1; company_binding_sha256: string; company_binding_epoch: number;
};
export type DirectoryCompanyIdentity = {
  shop_id: string; company_id: string; database_id: string; active_primary_desktop_id: string;
  active_primary_computer_name: string; active_primary_machine_fingerprint: string;
  restore_generation: string; activated_utc: string; authority_status: "ActivePrimary";
};
const IDENTITY_KEYS = ["shop_id", "company_id", "database_id", "active_primary_desktop_id",
  "active_primary_computer_name", "active_primary_machine_fingerprint", "restore_generation",
  "activated_utc", "authority_status"] as const;
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Match .NET IsNullOrWhiteSpace, without trimming or treating U+FEFF as whitespace.
const BLANK = /^[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]*$/;
function deny(): never { throw new BusinessAuthorizationError(403, "COMPANY_BINDING_INVALID"); }
export function requireCompanyBinding(x: unknown): DirectoryCompanyBinding {
  if (!x || typeof x !== "object" || Array.isArray(x)) deny();
  const b = x as Record<string, unknown>;
  if (b.company_binding_version !== 1 || typeof b.company_binding_sha256 !== "string" ||
      !/^[A-F0-9]{64}$/.test(b.company_binding_sha256) || typeof b.company_binding_epoch !== "number" ||
      !Number.isSafeInteger(b.company_binding_epoch) || b.company_binding_epoch < 1) deny();
  return { company_binding_version: 1, company_binding_sha256: b.company_binding_sha256,
    company_binding_epoch: b.company_binding_epoch };
}
export function sameCompanyBinding(a: DirectoryCompanyBinding, b: DirectoryCompanyBinding): boolean {
  requireCompanyBinding(a); requireCompanyBinding(b);
  return a.company_binding_version === b.company_binding_version &&
    a.company_binding_sha256 === b.company_binding_sha256 && a.company_binding_epoch === b.company_binding_epoch;
}
function scalarBytes(value: unknown): Buffer {
  // UTF-8 cannot use fewer bytes than these UTF-16 code units; bound work before scanning/allocation.
  if (typeof value !== "string" || value.length > 4096 || BLANK.test(value)) deny();
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      const low = value.charCodeAt(++i); if (!(low >= 0xDC00 && low <= 0xDFFF)) deny();
    } else if (c >= 0xDC00 && c <= 0xDFFF) deny();
  }
  if (Buffer.byteLength(value, "utf8") > 4096) deny(); return Buffer.from(value, "utf8");
}
// Input is reviewed registry metadata, never caller identity or a client-supplied digest.
export function companyIdentityBytes(identity: DirectoryCompanyIdentity): Buffer {
  if (!identity || typeof identity !== "object" || Array.isArray(identity) ||
      Object.keys(identity).sort().join("|") !== [...IDENTITY_KEYS].sort().join("|")) deny();
  if (typeof identity.shop_id !== "string" || !CANONICAL_UUID.test(identity.shop_id) || identity.shop_id === "00000000-0000-0000-0000-000000000000" ||
      identity.authority_status !== "ActivePrimary" || typeof identity.restore_generation !== "string" ||
      !/^(0|[1-9][0-9]{0,18})$/.test(identity.restore_generation) ||
      (identity.restore_generation.length === 19 && identity.restore_generation > "9223372036854775807")) deny();
  const domain = Buffer.from("RB-DIRECTORY-COMPANY-BINDING\0", "ascii");
  const prefix = Buffer.alloc(8); prefix.writeUInt32BE(1, 0); prefix.writeUInt32BE(9, 4);
  const parts: Buffer[] = [domain, prefix]; let total = domain.byteLength + prefix.byteLength;
  for (const key of IDENTITY_KEYS) {
    const value = scalarBytes(identity[key]); const length = Buffer.alloc(4); length.writeUInt32BE(value.byteLength);
    total += 4 + value.byteLength; if (total > 32768) deny(); parts.push(length, value);
  }
  return Buffer.concat(parts, total);
}
export function companyIdentitySha256(identity: DirectoryCompanyIdentity): string {
  return createHash("sha256").update(companyIdentityBytes(identity)).digest("hex").toUpperCase();
}
