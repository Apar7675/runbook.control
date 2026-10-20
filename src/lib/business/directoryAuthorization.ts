import { createPrivateKey, createSign, randomUUID } from "node:crypto";
import { requireDirectoryPolicy, verifyDirectoryProof, type DirectoryPolicy, type DirectoryDevicePossessionVerifier } from "./directoryLeaseAdministration";

import { requireCompanyBinding, sameCompanyBinding, type DirectoryCompanyBinding } from "./directoryCompanyBinding";

// This is an operation allowlist, not a role or module-visibility mapping.
export const BUSINESS_CAPABILITIES = [
  "parties.read", "parties.edit", "parties.archive", "parties.migrate",
  "estimates.read", "estimates.edit", "ledger.read", "receivables.read", "receivables.edit",
  "banking.read", "statement-imports.read", "statement-imports.import", "statement-imports.review",
  "reconciliation.read", "reconciliation.review", "quotes.read", "quotes.edit",
] as const;
export type BusinessCapabilityCode = typeof BUSINESS_CAPABILITIES[number];
export const BUSINESS_GRANT_LIFETIME_MS = 30_000;
export const BUSINESS_GRANT_AUDIENCE = "runbook-desktop-business";
export const BUSINESS_GRANT_ISSUER = "runbook-control";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class BusinessAuthorizationError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 503, readonly code: string) {
    super("Business authorization is unavailable.");
  }
}
export function requireBusinessUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new BusinessAuthorizationError(400, "INVALID_ID");
  return value;
}
export function requireBusinessCapability(value: unknown): BusinessCapabilityCode {
  if (typeof value !== "string" || !(BUSINESS_CAPABILITIES as readonly string[]).includes(value))
    throw new BusinessAuthorizationError(400, "UNKNOWN_CAPABILITY");
  return value as BusinessCapabilityCode;
}
export function canonicalUtc(value: unknown): number {
  if (typeof value !== "string") throw new BusinessAuthorizationError(503, "INVALID_AUTHORITY_TIME");
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
    throw new BusinessAuthorizationError(503, "INVALID_AUTHORITY_TIME");
  return time;
}

export type BusinessRequest = DirectoryCompanyBinding & {
  version: 2; request_id: string; shop_id: string; device_id: string; capability_code: BusinessCapabilityCode;
};
export type VerifiedControlSession = { user_id: string; session_id: string; expires_ms: number };

// Call ONLY after the existing requireSessionUser has validated this exact bearer with Auth.getUser.
// Decoding does not authenticate a token. The authority store additionally checks auth.sessions.
export function bindVerifiedControlSession(accessToken: string, verifiedUserId: string, nowMs: number): VerifiedControlSession {
  requireBusinessUuid(verifiedUserId);
  if (!Number.isFinite(nowMs) || accessToken.length > 16384) throw new BusinessAuthorizationError(401, "INVALID_SESSION");
  const segments = accessToken.split(".");
  if (segments.length !== 3 || !segments.every(x => /^[A-Za-z0-9_-]+$/.test(x)))
    throw new BusinessAuthorizationError(401, "INVALID_SESSION");
  let payload: Record<string, unknown>;
  try {
    const bytes = Buffer.from(segments[1], "base64url");
    if (bytes.toString("base64url") !== segments[1]) throw new Error();
    payload = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  } catch { throw new BusinessAuthorizationError(401, "INVALID_SESSION"); }
  if (!payload || Array.isArray(payload) || payload.sub !== verifiedUserId || payload.role !== "authenticated" ||
      typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp) || payload.exp <= 0 ||
      payload.exp > 253402300799 || payload.exp * 1000 <= nowMs)
    throw new BusinessAuthorizationError(401, "INVALID_SESSION");
  let sessionId: string;
  try { sessionId = requireBusinessUuid(payload.session_id); }
  catch { throw new BusinessAuthorizationError(401, "INVALID_SESSION"); }
  return { user_id: verifiedUserId, session_id: sessionId, expires_ms: payload.exp * 1000 };
}

export type BusinessAuthority = DirectoryCompanyBinding & {
  authority_id: string; authority_version: number; user_id: string; shop_id: string;
  device_id: string; session_id: string; capability_code: BusinessCapabilityCode;
  capability_version: 1; valid_until_utc: string; device_binding_hash: string;
};
export interface BusinessAuthorityStore {
  readCurrent(request: BusinessRequest, principal: VerifiedControlSession): Promise<BusinessAuthority | null>;
}
export type BusinessEntitlement = { allowed: boolean; restricted: boolean };
export type BusinessGrantClaims = DirectoryCompanyBinding & {
  version: 2; issuer: typeof BUSINESS_GRANT_ISSUER; audience: typeof BUSINESS_GRANT_AUDIENCE;
  grant_id: string; request_id: string; actor_id: string; user_id: string; shop_id: string;
  device_id: string; session_id: string; capability_code: BusinessCapabilityCode; capability_version: 1;
  authority_id: string; authority_version: number; issued_utc: string; not_before_utc: string; expires_utc: string;
};
export type BusinessSigningKey = { key_id: string; private_key_pem: string };

function validateAuthority(a: BusinessAuthority | null, request: BusinessRequest, principal: VerifiedControlSession, now: number): BusinessAuthority {
  if (!a) throw new BusinessAuthorizationError(403, "CAPABILITY_DENIED");
  requireBusinessUuid(a.authority_id); requireCompanyBinding(a);
  if (!sameCompanyBinding(a, request)) throw new BusinessAuthorizationError(403, "COMPANY_AUTHORITY_MISMATCH");
  if (a.user_id !== principal.user_id || a.session_id !== principal.session_id || a.shop_id !== request.shop_id ||
      a.device_id !== request.device_id || a.capability_code !== request.capability_code || a.capability_version !== 1 ||
      !/^[A-F0-9]{64}$/.test(a.device_binding_hash) ||
      !Number.isSafeInteger(a.authority_version) || a.authority_version < 1 || a.authority_version > 2147483647 ||
      canonicalUtc(a.valid_until_utc) <= now)
    throw new BusinessAuthorizationError(403, "AUTHORITY_MISMATCH");
  return a;
}
function sameAuthority(a: BusinessAuthority, b: BusinessAuthority): boolean {
  return Object.keys(a).length === Object.keys(b).length &&
    (Object.keys(a) as (keyof BusinessAuthority)[]).every(k => a[k] === b[k]);
}

export async function issueBusinessAuthorization(input: {
  request: BusinessRequest; principal: VerifiedControlSession; store: BusinessAuthorityStore;
  readEntitlement: (shopId: string) => Promise<BusinessEntitlement>;
  signingKey: () => BusinessSigningKey; policy: DirectoryPolicy; proofVerifier: DirectoryDevicePossessionVerifier; proofRequest: Request; now?: () => number;
}): Promise<{ grant: string; expires_utc: string }> {
  const clock = input.now ?? Date.now;
  const { request, principal } = input;
  requireBusinessUuid(request.request_id); requireBusinessUuid(request.shop_id); requireBusinessUuid(request.device_id);
  requireBusinessCapability(request.capability_code); requireBusinessUuid(principal.user_id); requireBusinessUuid(principal.session_id);
  if (request.version !== 2) throw new BusinessAuthorizationError(403, "DIRECTORY_PROFILE_MISMATCH");
  requireCompanyBinding(request);
  requireDirectoryPolicy(input.policy);
  const configuredGrantLifetimeMs = input.policy.grantSeconds * 1000;
  const start = clock();
  if (!Number.isFinite(start) || !Number.isSafeInteger(principal.expires_ms) || principal.expires_ms <= start)
    throw new BusinessAuthorizationError(401, "SESSION_EXPIRED");
  const before = validateAuthority(await input.store.readCurrent(request, principal), request, principal, start);
  const proof = await verifyDirectoryProof(input.proofVerifier, input.proofRequest, request, principal, clock, input.policy);
  if (proof.device_binding_hash !== before.device_binding_hash || !sameCompanyBinding(proof, before))
    throw new BusinessAuthorizationError(403, "DEVICE_COMPANY_BINDING_MISMATCH");
  const entitlement = await input.readEntitlement(request.shop_id);
  if (entitlement.allowed !== true || entitlement.restricted !== false)
    throw new BusinessAuthorizationError(403, "ENTITLEMENT_RESTRICTED");
  const after = validateAuthority(await input.store.readCurrent(request, principal), request, principal, clock());
  if (!sameAuthority(before, after)) throw new BusinessAuthorizationError(403, "AUTHORITY_CHANGED");
  const now = clock();
  if (now < start || now - start > 10_000) throw new BusinessAuthorizationError(503, "STALE_AUTHORITY_READ");
  const expiry = Math.min(now + Math.min(BUSINESS_GRANT_LIFETIME_MS, configuredGrantLifetimeMs), principal.expires_ms, canonicalUtc(after.valid_until_utc), canonicalUtc(proof.expires_utc));
  if (expiry <= now) throw new BusinessAuthorizationError(403, "AUTHORITY_EXPIRED");
  const claims: BusinessGrantClaims = {
    version: 2, issuer: BUSINESS_GRANT_ISSUER, audience: BUSINESS_GRANT_AUDIENCE,
    ...requireCompanyBinding(after),
    grant_id: randomUUID(), request_id: request.request_id, actor_id: principal.user_id, user_id: principal.user_id,
    shop_id: request.shop_id, device_id: request.device_id, session_id: principal.session_id,
    capability_code: request.capability_code, capability_version: 1,
    authority_id: after.authority_id, authority_version: after.authority_version,
    issued_utc: new Date(now).toISOString(), not_before_utc: new Date(now).toISOString(), expires_utc: new Date(expiry).toISOString(),
  };
  const configured = input.signingKey();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(configured.key_id)) throw new BusinessAuthorizationError(503, "SIGNING_UNAVAILABLE");
  let key: ReturnType<typeof createPrivateKey>;
  try { key = createPrivateKey(configured.private_key_pem); }
  catch { throw new BusinessAuthorizationError(503, "SIGNING_UNAVAILABLE"); }
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
    throw new BusinessAuthorizationError(503, "SIGNING_UNAVAILABLE");
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: configured.key_id, typ: "RB-BUSINESS+JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256"); signer.update(signingInput, "ascii"); signer.end();
  return { grant: `${signingInput}.${signer.sign(key).toString("base64url")}`, expires_utc: claims.expires_utc };
}

export function readBusinessSigningConfiguration(): BusinessSigningKey {
  // A separate key/audience: never fall back to administrative completion or entitlement keys.
  const pem = process.env.RUNBOOK_BUSINESS_AUTHORIZATION_PRIVATE_KEY_PEM ?? "";
  const keyId = process.env.RUNBOOK_BUSINESS_AUTHORIZATION_KEY_ID ?? "";
  if (!pem || !keyId) throw new BusinessAuthorizationError(503, "SIGNING_UNAVAILABLE");
  return { key_id: keyId, private_key_pem: pem.replace(/\\n/g, "\n") };
}
