import { createHash } from "node:crypto";
import { BusinessAuthorizationError, canonicalUtc, requireBusinessCapability, requireBusinessUuid,
  type BusinessCapabilityCode, type BusinessRequest, type VerifiedControlSession } from "./directoryAuthorization";

import { requireCompanyBinding, sameCompanyBinding, type DirectoryCompanyBinding } from "./directoryCompanyBinding";

export type DirectoryPolicy = { enabled: boolean; standardLeaseSeconds: number | null;
  maintenanceLeaseSeconds: number | null; grantSeconds: number | null };
export type ActiveDirectoryPolicy = { enabled: true; standardLeaseSeconds: number;
  maintenanceLeaseSeconds: number; grantSeconds: number };
// Review ceilings, not configured production defaults. Missing configuration remains OFF.
export const DIRECTORY_POLICY_OFF: DirectoryPolicy = Object.freeze({ enabled: false,
  standardLeaseSeconds: null, maintenanceLeaseSeconds: null, grantSeconds: null });
export const PROPOSED_DIRECTORY_CEILINGS = Object.freeze({ standardLeaseSeconds: 28_800,
  maintenanceLeaseSeconds: 900, grantSeconds: 30 });
export function requireDirectoryPolicy(p: DirectoryPolicy): asserts p is ActiveDirectoryPolicy {
  if (!p || p.enabled !== true || !Number.isSafeInteger(p.standardLeaseSeconds) ||
      !Number.isSafeInteger(p.maintenanceLeaseSeconds) || !Number.isSafeInteger(p.grantSeconds) ||
      p.standardLeaseSeconds! < 1 || p.standardLeaseSeconds! > 28_800 ||
      p.maintenanceLeaseSeconds! < 1 || p.maintenanceLeaseSeconds! > 900 ||
      p.grantSeconds! < 1 || p.grantSeconds! > 30)
    throw new BusinessAuthorizationError(503, "DIRECTORY_POLICY_UNCONFIGURED");
}
export type DirectoryDeviceProof = DirectoryCompanyBinding & { request_id: string; user_id: string; session_id: string;
  shop_id: string; device_id: string; capability_code: BusinessCapabilityCode;
  device_binding_hash: string; verified_utc: string; expires_utc: string };
// Missing production seam: must cryptographically verify Windows-bound possession, bind
// exact Auth/session/request/capability, and atomically consume replay protection. A client
// device UUID, enrollment eligibility, opaque device token or legacy deviceKey is insufficient.
export interface DirectoryDevicePossessionVerifier {
  verifyAndConsume(raw: Request, request: BusinessRequest, principal: VerifiedControlSession): Promise<DirectoryDeviceProof | null>;
}
export const DENY_DIRECTORY_DEVICE_PROOF: DirectoryDevicePossessionVerifier = Object.freeze({
  async verifyAndConsume() { return null; },
});
export async function verifyDirectoryProof(verifier: DirectoryDevicePossessionVerifier, raw: Request,
  request: BusinessRequest, principal: VerifiedControlSession, clock: () => number, policy: DirectoryPolicy) {
  requireDirectoryPolicy(policy);
  const proof = await verifier.verifyAndConsume(raw, request, principal);
  const now = clock();
  if (!Number.isFinite(now) || !proof || proof.request_id !== request.request_id || proof.user_id !== principal.user_id ||
      proof.session_id !== principal.session_id || proof.shop_id !== request.shop_id ||
      proof.device_id !== request.device_id || proof.capability_code !== request.capability_code ||
      !sameCompanyBinding(proof, request) ||
      !/^[A-F0-9]{64}$/.test(proof.device_binding_hash) || canonicalUtc(proof.verified_utc) > now ||
      now - canonicalUtc(proof.verified_utc) > 30_000 || canonicalUtc(proof.expires_utc) <= now ||
      canonicalUtc(proof.expires_utc) > Math.min(now + 30_000, principal.expires_ms))
    throw new BusinessAuthorizationError(403, "WINDOWS_DEVICE_POSSESSION_UNVERIFIED");
  return proof;
}
export type DirectoryLeaseMutation = DirectoryCompanyBinding & { request_id: string; lease_id: string;
  action: "create" | "renew" | "revoke"; expected_version: number; shop_id: string;
  user_id: string; device_id: string; session_id: string; capability_code: BusinessCapabilityCode;
  device_binding_hash: string; not_before_utc: string; expires_utc: string; reason: string };
export type VerifiedDirectoryApproval = DirectoryCompanyBinding & { approval_id: string; request_id: string; actor_id: string;
  actor_session_id: string; payload_hash: string; expires_utc: string };
// This is not owner/admin membership or an administrative-completion grant. Production
// assignment-administration authority is an explicit unresolved adapter and denies by default.
// Exact request/payload retries must return the same consumed approval receipt; a changed
// payload or another request must not reuse it. No production adapter exists in this delta.
export interface DirectoryLeaseApprovalVerifier {
  verifyAndConsume(request: DirectoryLeaseMutation, actor: VerifiedControlSession, payloadHash: string): Promise<VerifiedDirectoryApproval | null>;
}
export const DENY_DIRECTORY_LEASE_APPROVAL: DirectoryLeaseApprovalVerifier = Object.freeze({
  async verifyAndConsume() { return null; },
});
export type DirectoryLeaseResult = DirectoryCompanyBinding & { lease_id: string; authority_version: number; action: string;
  request_id: string; replayed: boolean };
export interface DirectoryLeaseMutationStore {
  change(request: DirectoryLeaseMutation, actor: VerifiedControlSession, approval: VerifiedDirectoryApproval,
    payloadHash: string): Promise<DirectoryLeaseResult>;
}
export function directoryMutationPayloadHash(r: DirectoryLeaseMutation, actor: VerifiedControlSession) {
  // Fixed fields/order; no secret/token/proof payload is retained in this audit fingerprint.
  return createHash("sha256").update(JSON.stringify({ action: r.action, request_id: r.request_id,
    lease_id: r.lease_id, expected_version: r.expected_version, shop_id: r.shop_id, user_id: r.user_id,
    device_id: r.device_id, session_id: r.session_id, capability_code: r.capability_code,
    device_binding_hash: r.device_binding_hash, ...requireCompanyBinding(r), not_before_utc: r.not_before_utc,
    expires_utc: r.expires_utc, reason: r.reason, actor_id: actor.user_id,
    actor_session_id: actor.session_id })).digest("hex").toUpperCase();
}
export async function administerDirectoryLease(input: { request: DirectoryLeaseMutation;
  actor: VerifiedControlSession; policy: DirectoryPolicy; approvalVerifier: DirectoryLeaseApprovalVerifier;
  store: DirectoryLeaseMutationStore; now?: () => number }) {
  requireDirectoryPolicy(input.policy);
  const clock = input.now ?? Date.now;
  const r = input.request, actor = input.actor, now = clock();
  for (const v of [r.request_id, r.lease_id, r.shop_id, r.user_id, r.device_id, r.session_id,
    actor.user_id, actor.session_id]) requireBusinessUuid(v);
  requireBusinessCapability(r.capability_code); requireCompanyBinding(r);
  if (!Number.isFinite(now) || !Number.isSafeInteger(actor.expires_ms) || actor.expires_ms <= now ||
      !["create", "renew", "revoke"].includes(r.action) || !Number.isSafeInteger(r.expected_version) ||
      r.expected_version < 0 || r.expected_version >= 2147483647 ||
      (r.action === "create" ? r.expected_version !== 0 : r.expected_version === 0) ||
      !/^[A-F0-9]{64}$/.test(r.device_binding_hash) || typeof r.reason !== "string" ||
      r.reason.trim() !== r.reason || r.reason.length < 8 || r.reason.length > 1000)
    throw new BusinessAuthorizationError(403, "LEASE_MUTATION_INVALID");
  const start = canonicalUtc(r.not_before_utc), end = canonicalUtc(r.expires_utc);
  const maximum = (r.capability_code === "parties.migrate" ? input.policy.maintenanceLeaseSeconds : input.policy.standardLeaseSeconds) * 1000;
  if (r.action !== "revoke" && (end <= now || end <= start || end - start > maximum))
    throw new BusinessAuthorizationError(403, "LEASE_WINDOW_INVALID");
  const hash = directoryMutationPayloadHash(r, actor);
  const approval = await input.approvalVerifier.verifyAndConsume(r, actor, hash);
  const checkedNow = clock();
  if (!Number.isFinite(checkedNow) || checkedNow < now || checkedNow - now > 10_000 || actor.expires_ms <= checkedNow)
    throw new BusinessAuthorizationError(503, "STALE_LEASE_APPROVAL");
  if (!approval || approval.request_id !== r.request_id || approval.actor_id !== actor.user_id ||
      approval.actor_session_id !== actor.session_id || approval.payload_hash !== hash ||
      !sameCompanyBinding(approval, r) ||
      canonicalUtc(approval.expires_utc) <= checkedNow || canonicalUtc(approval.expires_utc) > actor.expires_ms)
    throw new BusinessAuthorizationError(403, "LEASE_ADMINISTRATION_UNVERIFIED");
  requireBusinessUuid(approval.approval_id);
  // The real store must perform CAS, audit, idempotency and terminal-revocation checks
  // atomically. No read/update pair or client-side permission can replace that transaction.
  const result = await input.store.change(r, actor, approval, hash);
  if (result.lease_id !== r.lease_id || result.request_id !== r.request_id || result.action !== r.action ||
      result.authority_version !== r.expected_version + 1 || typeof result.replayed !== "boolean" ||
      !sameCompanyBinding(result, r))
    throw new BusinessAuthorizationError(503, "LEASE_MUTATION_RECEIPT_INVALID");
  return result;
}
