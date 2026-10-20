import type { supabaseAdmin } from "@/lib/supabase/admin";
import { BusinessAuthorizationError, requireBusinessUuid, type BusinessAuthority, type BusinessAuthorityStore,
  type BusinessRequest, type VerifiedControlSession } from "./directoryAuthorization";
import type { DirectoryPolicy, DirectoryLeaseMutation, DirectoryLeaseMutationStore, VerifiedDirectoryApproval, DirectoryLeaseResult, DirectoryDeviceProof } from "./directoryLeaseAdministration";
import type { DirectoryChallengeSnapshot, DirectoryIssuedChallenge, DirectoryNonceArguments, DirectoryTrustKey, DirectoryTrustStore } from "./directoryTrustAdapters";
import { companyIdentitySha256, requireCompanyBinding, sameCompanyBinding,
  type DirectoryCompanyBinding, type DirectoryCompanyIdentity } from "./directoryCompanyBinding";

// Service-only V5 RPCs. No V4 fallback, direct DML, caller enrollment or hash-only authority.
export class SupabaseDirectoryTrustStore implements BusinessAuthorityStore, DirectoryLeaseMutationStore, DirectoryTrustStore {
  constructor(private readonly admin: ReturnType<typeof supabaseAdmin>) {}
  private async rows(name: string, args: Record<string, unknown>) {
    const x = await this.admin.rpc(name, args);
    if (x.error || !Array.isArray(x.data)) throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_STORE_UNAVAILABLE");
    return x.data as Record<string, unknown>[];
  }
  private one(rows: Record<string, unknown>[], optional = false) {
    if (rows.length === 0 && optional) return null;
    if (rows.length !== 1) throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_ROW_COUNT"); return rows[0];
  }
  private utc(value: unknown) {
    const match = typeof value === "string" ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(value) : null;
    if (!match || /[1-9]/.test((match[1] ?? "").slice(3)) || !Number.isFinite(Date.parse(value as string)))
      throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_TIME");
    const iso = new Date(value as string).toISOString(), expected = (value as string).slice(0, 19) + "." + (match[1] ?? "").padEnd(3, "0").slice(0, 3) + "Z";
    if (iso !== expected) throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_TIME"); return iso;
  }
  private number(v: unknown, max = Number.MAX_SAFE_INTEGER) {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 1 || v > max)
      throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_EPOCH"); return v;
  }
  private hash(v: unknown) {
    if (typeof v !== "string" || !/^[A-F0-9]{64}$/.test(v)) throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_HASH"); return v;
  }
  private text(v: unknown) { if (typeof v !== "string") throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_TEXT"); return v; }
  private binding(x: Record<string, unknown>, expected: DirectoryCompanyBinding) {
    const b = requireCompanyBinding(x);
    if (!sameCompanyBinding(b, expected)) throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_COMPANY_MISMATCH"); return b;
  }
  private bindingArgs(r: DirectoryCompanyBinding) {
    const b = requireCompanyBinding(r); return { p_company_binding_version: b.company_binding_version,
      p_company_binding_sha256: b.company_binding_sha256, p_company_binding_epoch: b.company_binding_epoch };
  }
  private reviewedIdentity(x: Record<string, unknown>): DirectoryCompanyIdentity {
    if (x.authority_status !== "ActivePrimary") throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_COMPANY_STATUS");
    return { shop_id: this.text(x.shop_id), company_id: this.text(x.company_id), database_id: this.text(x.database_id),
      active_primary_desktop_id: this.text(x.active_primary_desktop_id), active_primary_computer_name: this.text(x.active_primary_computer_name),
      active_primary_machine_fingerprint: this.text(x.active_primary_machine_fingerprint), restore_generation: this.text(x.restore_generation),
      activated_utc: this.text(x.activated_utc), authority_status: "ActivePrimary" };
  }
  async readPolicy(): Promise<DirectoryPolicy> {
    const x = this.one(await this.rows("rb_directory_policy_v5", {}), true);
    return x ? { enabled: x.enabled === true, standardLeaseSeconds: x.max_standard_seconds as number | null,
      maintenanceLeaseSeconds: x.max_migrate_seconds as number | null, grantSeconds: x.max_grant_seconds as number | null } :
      { enabled: false, standardLeaseSeconds: null, maintenanceLeaseSeconds: null, grantSeconds: null };
  }
  async readCurrent(r: BusinessRequest, p: VerifiedControlSession): Promise<BusinessAuthority | null> {
    const x = this.one(await this.rows("rb_directory_authority_v5", { p_user_id: p.user_id, p_session_id: p.session_id,
      p_shop_id: r.shop_id, p_device_id: r.device_id, p_capability_code: r.capability_code, ...this.bindingArgs(r) }), true);
    if (!x) return null;
    return { authority_id: requireBusinessUuid(x.authority_id), authority_version: this.number(x.authority_version, 2147483647),
      user_id: requireBusinessUuid(x.user_id), shop_id: requireBusinessUuid(x.shop_id), device_id: requireBusinessUuid(x.device_id),
      session_id: requireBusinessUuid(x.session_id), capability_code: x.capability_code as BusinessAuthority["capability_code"],
      capability_version: x.capability_version as 1, valid_until_utc: this.utc(x.valid_until_utc),
      device_binding_hash: this.hash(x.device_binding_hash), ...this.binding(x, r) };
  }
  async readKey(r: BusinessRequest, p: VerifiedControlSession, keyId: string): Promise<DirectoryTrustKey | null> {
    const x = this.one(await this.rows("rb_directory_key_v5", { p_user_id: p.user_id, p_session_id: p.session_id,
      p_shop_id: r.shop_id, p_device_id: r.device_id, p_key_id: keyId, ...this.bindingArgs(r) }), true);
    if (!x) return null;
    const binding = this.binding(x, r), identity = this.reviewedIdentity(x);
    // Independently reconstruct all nine protected registry fields; never bless a supplied hash alone.
    if (identity.shop_id !== r.shop_id || companyIdentitySha256(identity) !== binding.company_binding_sha256)
      throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_IDENTITY_DIGEST_MISMATCH");
    return { key_id: requireBusinessUuid(x.key_id), key_epoch: this.number(x.key_epoch), public_spki: this.text(x.public_spki),
      spki_sha256: this.hash(x.spki_sha256), device_binding_hash: this.hash(x.device_binding_hash),
      valid_until_utc: this.utc(x.valid_until_utc), ...binding };
  }
  private nonceArgs(a: DirectoryNonceArguments) {
    return { p_user_id: a.principal.user_id, p_session_id: a.principal.session_id, p_request_id: a.request.request_id,
      p_shop_id: a.request.shop_id, p_device_id: a.request.device_id, p_capability_code: a.request.capability_code,
      p_body_hash: a.bodyHash, p_origin: a.origin, p_method: a.method, p_path: a.path, p_key_id: a.keyId,
      p_nonce_hash: a.nonceHash, p_expires: a.expiresUtc };
  }
  async issueNonce(a: DirectoryNonceArguments): Promise<DirectoryIssuedChallenge> {
    const x = this.one(await this.rows("rb_directory_challenge_v5", { ...this.nonceArgs(a), ...this.bindingArgs(a.request) }))!;
    return { challenge_id: requireBusinessUuid(x.challenge_id), key_id: requireBusinessUuid(x.key_id), key_epoch: this.number(x.key_epoch),
      device_binding_hash: this.hash(x.device_binding_hash), expires_utc: this.utc(x.expires_utc), ...this.binding(x, a.request) };
  }
  async readChallenge(r: BusinessRequest, p: VerifiedControlSession, keyId: string, challengeId: string): Promise<DirectoryChallengeSnapshot | null> {
    const x = this.one(await this.rows("rb_directory_challenge_snapshot_v5", { p_user_id: p.user_id, p_session_id: p.session_id,
      p_request_id: r.request_id, p_shop_id: r.shop_id, p_device_id: r.device_id, p_capability_code: r.capability_code,
      p_key_id: keyId, p_challenge_id: challengeId, ...this.bindingArgs(r) }), true);
    if (!x) return null;
    if (x.method !== "POST" || x.path !== "/api/desktop/business-authorization")
      throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_CHALLENGE_DOMAIN");
    return { challenge_id: requireBusinessUuid(x.challenge_id), key_id: requireBusinessUuid(x.key_id), key_epoch: this.number(x.key_epoch),
      device_binding_hash: this.hash(x.device_binding_hash), body_sha256: this.hash(x.body_hash), origin: this.text(x.origin),
      method: "POST", path: "/api/desktop/business-authorization", expires_utc: this.utc(x.expires_utc), ...this.binding(x, r) };
  }
  async consumeNonce(a: DirectoryNonceArguments, challengeId: string, keyEpoch: number): Promise<DirectoryDeviceProof | null> {
    const x = this.one(await this.rows("rb_directory_consume_nonce_v5", { ...this.nonceArgs(a), p_challenge_id: challengeId,
      p_key_epoch: keyEpoch, ...this.bindingArgs(a.request) }), true);
    return x ? { request_id: requireBusinessUuid(x.request_id), user_id: requireBusinessUuid(x.user_id), session_id: requireBusinessUuid(x.session_id),
      shop_id: requireBusinessUuid(x.shop_id), device_id: requireBusinessUuid(x.device_id), capability_code: x.capability_code as DirectoryDeviceProof["capability_code"],
      device_binding_hash: this.hash(x.device_binding_hash), verified_utc: this.utc(x.verified_utc), expires_utc: this.utc(x.expires_utc), ...this.binding(x, a.request) } : null;
  }
  private mutationArgs(r: DirectoryLeaseMutation, p: VerifiedControlSession, hash: string) {
    return { p_request_id: r.request_id, p_lease_id: r.lease_id, p_action: r.action, p_expected_version: r.expected_version,
      p_shop_id: r.shop_id, p_user_id: r.user_id, p_device_id: r.device_id, p_session_id: r.session_id,
      p_capability_code: r.capability_code, p_device_binding_hash: r.device_binding_hash, p_not_before: r.not_before_utc,
      p_expires: r.expires_utc, p_reason: r.reason, p_actor_id: p.user_id, p_actor_session_id: p.session_id, p_payload_hash: hash };
  }
  private approval(x: Record<string, unknown>, r: DirectoryLeaseMutation): VerifiedDirectoryApproval {
    return { approval_id: requireBusinessUuid(x.approval_id), request_id: requireBusinessUuid(x.request_id), actor_id: requireBusinessUuid(x.actor_id),
      actor_session_id: requireBusinessUuid(x.actor_session_id), payload_hash: this.hash(x.payload_hash), expires_utc: this.utc(x.expires_utc), ...this.binding(x, r) };
  }
  async reviewLease(r: DirectoryLeaseMutation, p: VerifiedControlSession, hash: string, aal: "aal2") {
    return this.approval(this.one(await this.rows("rb_directory_review_lease_v5", { ...this.mutationArgs(r, p, hash),
      p_actor_aal: aal, ...this.bindingArgs(r) }))!, r);
  }
  async reserveApproval(r: DirectoryLeaseMutation, p: VerifiedControlSession, hash: string) {
    const x = this.one(await this.rows("rb_directory_approval_v5", { p_request_id: r.request_id, p_actor_id: p.user_id,
      p_actor_session_id: p.session_id, p_payload_hash: hash, ...this.bindingArgs(r) }), true); return x ? this.approval(x, r) : null;
  }
  async change(r: DirectoryLeaseMutation, p: VerifiedControlSession, a: VerifiedDirectoryApproval, hash: string): Promise<DirectoryLeaseResult> {
    if (!sameCompanyBinding(a, r)) throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_APPROVAL_COMPANY");
    const x = this.one(await this.rows("rb_directory_change_lease_v5", { ...this.mutationArgs(r, p, hash), p_approval_id: a.approval_id,
      p_approval_expires: a.expires_utc, ...this.bindingArgs(r) }))!;
    if (x.action !== r.action || typeof x.replayed !== "boolean") throw new BusinessAuthorizationError(503, "DIRECTORY_TRUST_RESULT");
    return { lease_id: requireBusinessUuid(x.lease_id), request_id: requireBusinessUuid(x.request_id),
      authority_version: this.number(x.authority_version, 2147483647), action: r.action, replayed: x.replayed, ...this.binding(x, r) };
  }
}
