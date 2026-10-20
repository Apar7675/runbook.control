import { constants, createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { requireSessionUser } from "@/lib/desktopAuth";
import { requireAal2 } from "@/lib/authz";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bindVerifiedControlSession, BusinessAuthorizationError, issueBusinessAuthorization,
  readBusinessSigningConfiguration, requireBusinessCapability, requireBusinessUuid,
  type BusinessRequest, type VerifiedControlSession } from "./directoryAuthorization";
import { administerDirectoryLease, directoryMutationPayloadHash, requireDirectoryPolicy,
  type DirectoryDevicePossessionVerifier, type DirectoryDeviceProof, type DirectoryLeaseApprovalVerifier,
  type DirectoryLeaseMutation, type VerifiedDirectoryApproval } from "./directoryLeaseAdministration";
import { SupabaseDirectoryTrustStore } from "./supabaseDirectoryTrustStore";
import { requireCompanyBinding, sameCompanyBinding, type DirectoryCompanyBinding } from "./directoryCompanyBinding";

export const DIRECTORY_PROOF_PATH = "/api/desktop/business-authorization";
export const DIRECTORY_PROOF_EPOCH_MAX = Number.MAX_SAFE_INTEGER;
const HASH = /^[A-F0-9]{64}$/;
const NONCE = /^[a-f0-9]{64}$/;
const ORIGIN = /^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?$/;
export type DirectoryTrustKey = DirectoryCompanyBinding & { key_id: string; key_epoch: number; public_spki: string;
  spki_sha256: string; device_binding_hash: string; valid_until_utc: string };
export type DirectoryChallenge = DirectoryCompanyBinding & { version: 2; origin: string; method: "POST"; path: typeof DIRECTORY_PROOF_PATH;
  challenge_id: string; nonce: string; key_id: string; key_epoch: number; request_id: string;
  user_id: string; session_id: string; shop_id: string; device_id: string;
  capability_code: BusinessRequest["capability_code"]; device_binding_hash: string;
  body_sha256: string; expires_utc: string };
export type DirectoryNonceArguments = { principal: VerifiedControlSession; request: BusinessRequest; bodyHash: string;
  origin: string; method: "POST"; path: typeof DIRECTORY_PROOF_PATH; keyId: string; nonceHash: string; expiresUtc: string };
export type DirectoryChallengeSnapshot = Pick<DirectoryChallenge, "challenge_id"|"key_id"|"key_epoch"|
  "device_binding_hash"|"company_binding_version"|"company_binding_sha256"|"company_binding_epoch"|
  "body_sha256"|"origin"|"method"|"path"|"expires_utc">;
export type DirectoryIssuedChallenge = Pick<DirectoryChallengeSnapshot, "challenge_id"|"key_id"|"key_epoch"|
  "device_binding_hash"|"company_binding_version"|"company_binding_sha256"|"company_binding_epoch"|"expires_utc">;
export interface DirectoryTrustStore {
  readKey(r: BusinessRequest, p: VerifiedControlSession, keyId: string): Promise<DirectoryTrustKey | null>;
  issueNonce(a: DirectoryNonceArguments): Promise<DirectoryIssuedChallenge>;
  readChallenge(r: BusinessRequest, p: VerifiedControlSession, keyId: string, challengeId: string): Promise<DirectoryChallengeSnapshot | null>;
  consumeNonce(a: DirectoryNonceArguments, challengeId: string, keyEpoch: number): Promise<DirectoryDeviceProof | null>;
  reserveApproval(r: DirectoryLeaseMutation, p: VerifiedControlSession, hash: string): Promise<VerifiedDirectoryApproval | null>;
}
export function trustDeny(code: string): never { throw new BusinessAuthorizationError(403, code); }
export function exactUtc(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) trustDeny("INVALID_PROOF_TIME");
  return value;
}
export function positiveEpoch(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > DIRECTORY_PROOF_EPOCH_MAX) trustDeny("INVALID_KEY_EPOCH");
  return value;
}
export function trustHash(value: unknown): string {
  if (typeof value !== "string" || !HASH.test(value)) trustDeny("INVALID_PROOF_HASH"); return value;
}
export function trustOrigin(value: unknown): string {
  if (typeof value !== "string" || !ORIGIN.test(value)) trustDeny("INVALID_PROOF_ORIGIN");
  const parsed = new URL(value); if (parsed.origin !== value || parsed.pathname !== "/") trustDeny("INVALID_PROOF_ORIGIN"); return value;
}
export function digest(bytes: Uint8Array | string): string { return createHash("sha256").update(bytes).digest("hex").toUpperCase(); }
function strictBase64(value: unknown, maximum: number): Buffer {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum || !/^[A-Za-z0-9_-]+$/.test(value)) trustDeny("INVALID_PROOF_ENCODING");
  const result = Buffer.from(value, "base64url"); if (result.toString("base64url") !== value) trustDeny("INVALID_PROOF_ENCODING"); return result;
}
// Shared byte contract: strict ASCII strings, fixed order, no escapes, safe integer decimal.
export function encodeDirectoryProof(c: DirectoryChallenge): Buffer {
  if (c.version !== 2 || c.method !== "POST" || c.path !== DIRECTORY_PROOF_PATH) trustDeny("PROOF_DOMAIN_MISMATCH");
  trustOrigin(c.origin); positiveEpoch(c.key_epoch); exactUtc(c.expires_utc);
  for (const id of [c.challenge_id,c.key_id,c.request_id,c.user_id,c.session_id,c.shop_id,c.device_id]) requireBusinessUuid(id);
  requireBusinessCapability(c.capability_code); trustHash(c.device_binding_hash); trustHash(c.body_sha256); requireCompanyBinding(c);
  if (!NONCE.test(c.nonce)) trustDeny("INVALID_PROOF_NONCE");
  return Buffer.from(JSON.stringify(["RB-DIRECTORY-PROOF",2,c.origin,c.method,c.path,c.challenge_id,c.nonce,c.key_id,
    c.key_epoch,c.request_id,c.user_id,c.session_id,c.shop_id,c.device_id,c.capability_code,c.device_binding_hash,c.company_binding_version,c.company_binding_sha256,c.company_binding_epoch,c.body_sha256,c.expires_utc]),"utf8");
}
function publicKey(k: DirectoryTrustKey) {
  requireCompanyBinding(k); requireBusinessUuid(k.key_id); positiveEpoch(k.key_epoch); trustHash(k.spki_sha256); trustHash(k.device_binding_hash); exactUtc(k.valid_until_utc);
  const der = strictBase64(k.public_spki, 2048); if (digest(der) !== k.spki_sha256) trustDeny("ENROLLED_KEY_HASH_MISMATCH");
  const key = createPublicKey({key:der,format:"der",type:"spki"});
  if (key.asymmetricKeyType !== "rsa" || !key.asymmetricKeyDetails?.modulusLength ||
      key.asymmetricKeyDetails.modulusLength < 2048 || key.asymmetricKeyDetails.modulusLength > 4096 ||
      !key.export({format:"der",type:"spki"}).equals(der)) trustDeny("INVALID_ENROLLED_KEY");
  return key;
}
export class EnrolledWindowsDirectoryProof implements DirectoryDevicePossessionVerifier {
  constructor(private readonly store: DirectoryTrustStore, private readonly origin: string, private readonly clock:()=>number=Date.now) { trustOrigin(origin); }
  async verifyAndConsume(raw: Request, r: BusinessRequest, p: VerifiedControlSession): Promise<DirectoryDeviceProof | null> {
    const url = new URL(raw.url); if (raw.method !== "POST" || url.origin !== this.origin || url.pathname !== DIRECTORY_PROOF_PATH || url.search) return null;
    const challengeId=requireBusinessUuid(raw.headers.get("x-runbook-directory-challenge"));
    const keyId=requireBusinessUuid(raw.headers.get("x-runbook-directory-key"));
    const nonce=raw.headers.get("x-runbook-directory-nonce");if(typeof nonce!=="string"||!NONCE.test(nonce))return null;
    const expiresUtc=exactUtc(raw.headers.get("x-runbook-directory-expires"));
    const signature=strictBase64(raw.headers.get("x-runbook-directory-signature"),684);
    const {body,bytes}=await readExactDirectoryJson(raw,REQUEST_KEYS,4096);
    const parsed=requestOf(body);if(!REQUEST_KEYS.every(k=>parsed[k]===r[k]))return null;
    const key=await this.store.readKey(r,p,keyId);
    if(!key||key.key_id!==keyId||!sameCompanyBinding(key,r))return null;
    // Snapshot comes from persisted current challenge/key/registry, not the caller expiry or hash.
    const stored=await this.store.readChallenge(r,p,keyId,challengeId);
    if(!stored||stored.challenge_id!==challengeId||stored.key_id!==keyId||stored.key_epoch!==key.key_epoch||
      stored.device_binding_hash!==key.device_binding_hash||!sameCompanyBinding(stored,r)||
      stored.origin!==this.origin||stored.method!=="POST"||stored.path!==DIRECTORY_PROOF_PATH||
      stored.expires_utc!==expiresUtc||stored.body_sha256!==digest(bytes))return null;
    const now=this.clock();if(!Number.isFinite(now)||Date.parse(stored.expires_utc)<=now||
      Date.parse(stored.expires_utc)>Math.min(now+30000,p.expires_ms,Date.parse(key.valid_until_utc)))return null;
    const challenge:DirectoryChallenge={...r,...stored,nonce,user_id:p.user_id,session_id:p.session_id};
    if(!verify("RSA-SHA256",encodeDirectoryProof(challenge),{key:publicKey(key),padding:constants.RSA_PKCS1_PADDING},signature))return null;
    // SQL rechecks current key epoch/session/eligibility after locks, then consumes exactly once.
    return this.store.consumeNonce({principal:p,request:r,bodyHash:challenge.body_sha256,origin:this.origin,
      method:"POST",path:DIRECTORY_PROOF_PATH,keyId,nonceHash:digest(nonce),expiresUtc},challengeId,key.key_epoch);
  }
}
export class ExplicitDirectoryLeaseApproval implements DirectoryLeaseApprovalVerifier {
  constructor(private readonly store:DirectoryTrustStore){}
  verifyAndConsume(r:DirectoryLeaseMutation,p:VerifiedControlSession,hash:string) {
    // Reservation is exact-request-only; final mutation STILL checks/consumes under its transaction.
    return this.store.reserveApproval(r,p,trustHash(hash));
  }
}

type JsonBody={body:Record<string,unknown>;bytes:Buffer};
export async function readExactDirectoryJson(req:Request,keys:readonly string[],maximum=8192):Promise<JsonBody>{
  if(req.method!=="POST"||!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type")??""))trustDeny("JSON_POST_REQUIRED");
  const reader=req.body?.getReader();if(!reader)trustDeny("BODY_REQUIRED");let length=0;const chunks:Uint8Array[]=[];const deadline=Date.now()+5000;
  try{while(true){if(Date.now()>=deadline)throw new BusinessAuthorizationError(400,"BODY_TIMEOUT");let timer:ReturnType<typeof setTimeout>|undefined;
    const item=await Promise.race([reader.read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new BusinessAuthorizationError(400,"BODY_TIMEOUT")),Math.max(1,deadline-Date.now()));})]).finally(()=>{if(timer)clearTimeout(timer);});
    if(item.done)break;length+=item.value.byteLength;if(length>maximum)trustDeny("BODY_TOO_LARGE");chunks.push(item.value);
  }}finally{void reader.cancel().catch(()=>undefined);}
  const bytes=Buffer.concat(chunks);let body:unknown;let text:string;
  try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);body=JSON.parse(text);}catch{trustDeny("INVALID_JSON");}
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).join("|")!==keys.join("|")||
      JSON.stringify(body)!==text!||!Buffer.from(text!,"utf8").equals(bytes))trustDeny("EXACT_CANONICAL_JSON_REQUIRED");
  // Comparison rejects duplicates, alternate escapes/numbers/whitespace; digest uses ORIGINAL bytes.
  return {body:body as Record<string,unknown>,bytes};
}
export const REQUEST_KEYS=["version","request_id","shop_id","device_id","capability_code",
  "company_binding_version","company_binding_sha256","company_binding_epoch"] as const;
function requestOf(b:Record<string,unknown>):BusinessRequest{
  if(b.version!==2)trustDeny("DIRECTORY_PROFILE_MISMATCH");
  return {version:2,request_id:requireBusinessUuid(b.request_id),shop_id:requireBusinessUuid(b.shop_id),
    device_id:requireBusinessUuid(b.device_id),capability_code:requireBusinessCapability(b.capability_code),...requireCompanyBinding(b)};
}
function mutationOf(b:Record<string,unknown>):DirectoryLeaseMutation{
  for(const id of [b.request_id,b.lease_id,b.shop_id,b.user_id,b.device_id,b.session_id])requireBusinessUuid(id);
  if(b.action!=="create"&&b.action!=="renew"&&b.action!=="revoke")trustDeny("INVALID_LEASE_ACTION");
  if(typeof b.expected_version!=="number"||!Number.isSafeInteger(b.expected_version)||b.expected_version<0||b.expected_version>2147483646)trustDeny("INVALID_LEASE_VERSION");
  requireCompanyBinding(b);requireBusinessCapability(b.capability_code);trustHash(b.device_binding_hash);exactUtc(b.not_before_utc);exactUtc(b.expires_utc);
  if(typeof b.reason!=="string"||b.reason.length<8||b.reason.length>1000||b.reason.trim()!==b.reason)trustDeny("INVALID_REVIEW_REASON");
  return b as DirectoryLeaseMutation;
}
function response(body:unknown,status=200){return Response.json(body,{status,headers:{"Cache-Control":"no-store, max-age=0"}});}
export type DirectoryTrustConfiguration={origin:string};
export function readDirectoryTrustConfiguration(env:NodeJS.ProcessEnv=process.env):DirectoryTrustConfiguration|null{
  if(env.RUNBOOK_DIRECTORY_TRUST_ENABLED!=="true")return null;
  if(env.RUNBOOK_DIRECTORY_CONTROL_ORIGIN!=="https://runbook-control.vercel.app"||
      env.NEXT_PUBLIC_SUPABASE_URL!=="https://qpykxraptlscihguclay.supabase.co")return null;
  // No default key, pin, policy, enrollment or delegation. Existing dedicated key parser denies missing config.
  readBusinessSigningConfiguration();return {origin:trustOrigin(env.RUNBOOK_DIRECTORY_CONTROL_ORIGIN)};
}
function compose(){const config=readDirectoryTrustConfiguration();if(!config)throw new BusinessAuthorizationError(503,"DIRECTORY_TRUST_OFF");
  return {config,store:new SupabaseDirectoryTrustStore(supabaseAdmin())};}
async function principalFor(req:Request){const {user,accessToken}=await requireSessionUser(req);if(user.is_anonymous===true)trustDeny("ANONYMOUS_SESSION");return bindVerifiedControlSession(accessToken,user.id,Date.now());}
function endpoint(req:Request,origin:string,path:string){const u=new URL(req.url);if(u.origin!==origin||u.pathname!==path||u.search||req.method!=="POST")trustDeny("ENDPOINT_MISMATCH");}
async function safe(action:()=>Promise<Response>){try{return await action();}catch(e){return response({ok:false,error:"Directory trust is unavailable."},e instanceof BusinessAuthorizationError?e.status:503);}}
export function directoryGrantPost(req:Request){return safe(async()=>{const {config,store}=compose();endpoint(req,config.origin,DIRECTORY_PROOF_PATH);
  const policy=await store.readPolicy();requireDirectoryPolicy(policy);const principal=await principalFor(req);const {body,bytes}=await readExactDirectoryJson(req,REQUEST_KEYS,4096);const request=requestOf(body);
  // An owned ArrayBuffer preserves exactly the bounded input bytes; no shared backing or reserialization.
  const proofBody=new ArrayBuffer(bytes.byteLength);new Uint8Array(proofBody).set(bytes);
  const issued=await issueBusinessAuthorization({request,principal,policy,proofRequest:new Request(req.url,{method:"POST",headers:req.headers,body:proofBody}),
    proofVerifier:new EnrolledWindowsDirectoryProof(store,config.origin),store,readEntitlement:getShopEntitlement,signingKey:readBusinessSigningConfiguration});return response({ok:true,...issued});});}
export function directoryChallengePost(req:Request){return safe(async()=>{const {config,store}=compose();endpoint(req,config.origin,DIRECTORY_PROOF_PATH+"/challenge");
  const policy=await store.readPolicy();requireDirectoryPolicy(policy);const principal=await principalFor(req);
  const {body}=await readExactDirectoryJson(req,[...REQUEST_KEYS,"key_id","body_sha256"],4096);const request=requestOf(body);const keyId=requireBusinessUuid(body.key_id);const bodyHash=trustHash(body.body_sha256);
  // The first eight fields are canonical and ordered; claimed final hash must match that exact body.
  if(bodyHash!==digest(Buffer.from(JSON.stringify(request),"utf8")))trustDeny("CHALLENGE_BODY_HASH_MISMATCH");
  const entitlement=await getShopEntitlement(request.shop_id);if(!entitlement.allowed||entitlement.restricted)trustDeny("ENTITLEMENT_RESTRICTED");
  const nonce=randomBytes(32).toString("hex");const expiresUtc=new Date(Math.min(Date.now()+policy.grantSeconds*1000,principal.expires_ms)).toISOString();
  const row=await store.issueNonce({principal,request,bodyHash,origin:config.origin,method:"POST",path:DIRECTORY_PROOF_PATH,keyId,nonceHash:digest(nonce),expiresUtc});
  if(row.key_id!==keyId||!sameCompanyBinding(row,request))trustDeny("CHALLENGE_COMPANY_MISMATCH");
  const challenge:DirectoryChallenge={...request,origin:config.origin,method:"POST",path:DIRECTORY_PROOF_PATH,...row,nonce,user_id:principal.user_id,session_id:principal.session_id,body_sha256:bodyHash};
  encodeDirectoryProof(challenge);return response({ok:true,challenge});});}
export function directoryLeaseApprovalPost(req:Request){return safe(async()=>{const {config,store}=compose();endpoint(req,config.origin,"/api/control/directory-lease-approvals");
  if(req.headers.get("origin")!==config.origin||(req.headers.has("sec-fetch-site")&&req.headers.get("sec-fetch-site")!=="same-origin"))trustDeny("ADMIN_ORIGIN_REQUIRED");
  const {supabase,user}=await requireAal2();const cached=await supabase.auth.getSession();const token=cached.data.session?.access_token;
  if(cached.error||!token)trustDeny("ADMIN_SESSION_REQUIRED");
  // getSession is not authority: verify THIS exact token, then bind session/AAL from it.
  const verified=await supabase.auth.getUser(token);const verifiedUser=verified.data.user;if(verified.error||!verifiedUser||verifiedUser.id!==user.id||verifiedUser.is_anonymous===true)trustDeny("ADMIN_SESSION_CHANGED");
  const actor=bindVerifiedControlSession(token,user.id,Date.now());const tokenClaims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8")) as Record<string,unknown>;
  if(tokenClaims.aal!=="aal2")trustDeny("ADMIN_AAL2_REQUIRED");
  const keys=["request_id","lease_id","action","expected_version","shop_id","user_id","device_id","session_id","capability_code","device_binding_hash","company_binding_version","company_binding_sha256","company_binding_epoch","not_before_utc","expires_utc","reason"];
  const {body}=await readExactDirectoryJson(req,keys);const request=mutationOf(body);const policy=await store.readPolicy();requireDirectoryPolicy(policy);
  // Explicit revocation only removes authority; billing loss must not prevent cleanup.
  if(request.action!=="revoke"){const entitlement=await getShopEntitlement(request.shop_id);if(!entitlement.allowed||entitlement.restricted)trustDeny("ENTITLEMENT_RESTRICTED");}
  const hash=directoryMutationPayloadHash(request,actor);await store.reviewLease(request,actor,hash,"aal2");
  const result=await administerDirectoryLease({request,actor,policy,approvalVerifier:new ExplicitDirectoryLeaseApproval(store),store});
  return response({ok:true,...result});});}
