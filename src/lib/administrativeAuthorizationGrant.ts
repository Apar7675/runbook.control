import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMINISTRATIVE_COMPLETION_SCOPE = "work-order.complete-close.override";
export const ADMINISTRATIVE_GRANT_LIFETIME_SECONDS = 120;
export const MAXIMUM_ADMINISTRATIVE_TARGET_ID = 2_147_483_647;

const GRANT_AUDIENCE = "runbook-service-administrative-completion";
const GRANT_ISSUER = "runbook-control";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNPADDED_BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type AdministrativeAuthorizationGrantClaims = {
  version: 1;
  issuer: typeof GRANT_ISSUER;
  audience: typeof GRANT_AUDIENCE;
  authorization_id: string;
  shop_id: string;
  user_id: string;
  role: "owner" | "admin";
  scope: typeof ADMINISTRATIVE_COMPLETION_SCOPE;
  work_order_id: number;
  operation_id: number;
  reason_sha256: string;
  authenticated_utc: string;
  expires_utc: string;
};

export type AdministrativeAuthorizationGrantTarget = {
  authorizationId: string;
  shopId: string;
  workOrderId: number;
  operationId: number;
  reason: string;
};

function signingKey() {
  const value = process.env.RUNBOOK_ADMIN_AUTHORIZATION_SIGNING_SECRET ?? "";
  if (Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("Administrative authorization signing is not configured.");
  }
  return value;
}

function normalizeUuid(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new Error("Administrative authorization UUID is invalid.");
  return normalized;
}

function normalizePositiveInteger(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAXIMUM_ADMINISTRATIVE_TARGET_ID) {
    throw new Error("Administrative authorization target is invalid.");
  }
  return value;
}

function assertNoUnpairedUtf16Surrogates(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) {
        throw new Error("Administrative authorization reason contains invalid Unicode.");
      }
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) {
        throw new Error("Administrative authorization reason contains invalid Unicode.");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new Error("Administrative authorization reason contains invalid Unicode.");
    }
  }
}

function reasonDigest(reason: string) {
  const normalized = String(reason ?? "").trim();
  assertNoUnpairedUtf16Surrogates(normalized);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function sign(encodedPayload: string) {
  return createHmac("sha256", signingKey()).update(encodedPayload, "ascii").digest();
}

function decodeCanonicalBase64Url(segment: string) {
  if (!UNPADDED_BASE64URL_PATTERN.test(segment)) {
    throw new Error("Administrative authorization grant is invalid.");
  }
  const decoded = Buffer.from(segment, "base64url");
  if (decoded.length === 0 || decoded.toString("base64url") !== segment) {
    throw new Error("Administrative authorization grant is invalid.");
  }
  return decoded;
}

export function issueAdministrativeAuthorizationGrant(
  target: AdministrativeAuthorizationGrantTarget,
  principal: { userId: string; role: "owner" | "admin" },
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime())) throw new Error("Administrative authorization time is invalid.");
  const authenticatedUtc = now.toISOString();
  const expiresUtc = new Date(now.getTime() + ADMINISTRATIVE_GRANT_LIFETIME_SECONDS * 1000).toISOString();
  const claims: AdministrativeAuthorizationGrantClaims = {
    version: 1,
    issuer: GRANT_ISSUER,
    audience: GRANT_AUDIENCE,
    authorization_id: normalizeUuid(target.authorizationId),
    shop_id: normalizeUuid(target.shopId),
    user_id: normalizeUuid(principal.userId),
    role: principal.role,
    scope: ADMINISTRATIVE_COMPLETION_SCOPE,
    work_order_id: normalizePositiveInteger(target.workOrderId),
    operation_id: normalizePositiveInteger(target.operationId),
    reason_sha256: reasonDigest(target.reason),
    authenticated_utc: authenticatedUtc,
    expires_utc: expiresUtc,
  };

  const encodedPayload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const encodedSignature = sign(encodedPayload).toString("base64url");
  return {
    grant: `${encodedPayload}.${encodedSignature}`,
    claims,
  };
}

export function verifyAdministrativeAuthorizationGrant(
  grant: string,
  expected: AdministrativeAuthorizationGrantTarget,
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime())) throw new Error("Administrative authorization time is invalid.");
  const suppliedGrant = String(grant ?? "");
  if (
    suppliedGrant.length === 0 ||
    suppliedGrant.length > 4096 ||
    suppliedGrant !== suppliedGrant.trim()
  ) {
    throw new Error("Administrative authorization grant is invalid.");
  }

  const segments = suppliedGrant.split(".");
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error("Administrative authorization grant is invalid.");
  }

  let encodedClaims: Buffer;
  let suppliedSignature: Buffer;
  try {
    encodedClaims = decodeCanonicalBase64Url(segments[0]);
    suppliedSignature = decodeCanonicalBase64Url(segments[1]);
  } catch {
    throw new Error("Administrative authorization grant is invalid.");
  }
  const expectedSignature = sign(segments[0]);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new Error("Administrative authorization grant signature is invalid.");
  }

  let claims: AdministrativeAuthorizationGrantClaims;
  try {
    claims = JSON.parse(encodedClaims.toString("utf8")) as AdministrativeAuthorizationGrantClaims;
  } catch {
    throw new Error("Administrative authorization grant payload is invalid.");
  }

  const authenticatedMs = Date.parse(String(claims.authenticated_utc ?? ""));
  const expiresMs = Date.parse(String(claims.expires_utc ?? ""));
  const expectedAuthorizationId = normalizeUuid(expected.authorizationId);
  const expectedShopId = normalizeUuid(expected.shopId);
  const expectedWorkOrderId = normalizePositiveInteger(expected.workOrderId);
  const expectedOperationId = normalizePositiveInteger(expected.operationId);
  const validRole = claims.role === "owner" || claims.role === "admin";
  if (
    claims.version !== 1 ||
    claims.issuer !== GRANT_ISSUER ||
    claims.audience !== GRANT_AUDIENCE ||
    normalizeUuid(claims.authorization_id) !== expectedAuthorizationId ||
    normalizeUuid(claims.shop_id) !== expectedShopId ||
    !UUID_PATTERN.test(String(claims.user_id ?? "")) ||
    !validRole ||
    claims.scope !== ADMINISTRATIVE_COMPLETION_SCOPE ||
    claims.work_order_id !== expectedWorkOrderId ||
    claims.operation_id !== expectedOperationId ||
    claims.reason_sha256 !== reasonDigest(expected.reason) ||
    !Number.isFinite(authenticatedMs) ||
    !Number.isFinite(expiresMs) ||
    expiresMs <= authenticatedMs ||
    expiresMs - authenticatedMs > ADMINISTRATIVE_GRANT_LIFETIME_SECONDS * 1000 ||
    now.getTime() < authenticatedMs - 30_000 ||
    now.getTime() >= expiresMs
  ) {
    throw new Error("Administrative authorization grant does not match the requested action.");
  }

  return claims;
}
