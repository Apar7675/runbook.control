import crypto from "crypto";

export const EMAIL_CODE_TTL_MS = 10 * 60_000;
export const SMS_CODE_TTL_MS = 10 * 60_000;

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
  "throwawaymail.com",
  "getnada.com",
  "temp-mail.org",
]);

function s(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeEmail(value: unknown) {
  return s(value).toLowerCase();
}

export function normalizePhone(value: unknown) {
  const digits = s(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return "";
}

export function isObviouslyInvalidPhone(value: string) {
  const normalized = normalizePhone(value);
  if (!normalized) return true;
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 11 || digits.length > 15) return true;
  if (/^(\d)\1+$/.test(digits)) return true;
  if (digits === "12345678901") return true;
  return false;
}

export function isDisposableEmail(value: string) {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf("@");
  if (at <= 0) return false;
  const domain = email.slice(at + 1);
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

export function splitFullName(fullName: string) {
  const parts = s(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

export function generateSixDigitCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function onboardingSecret() {
  return (
    process.env.RUNBOOK_ONBOARDING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "runbook-onboarding-dev-secret"
  );
}

export function hashIdentityValue(value: string) {
  return crypto.createHash("sha256").update(`${onboardingSecret()}|identity|${value}`).digest("hex");
}

export function hashVerificationCode(args: {
  channel: "email" | "sms";
  userId: string;
  destination: string;
  code: string;
}) {
  return crypto
    .createHash("sha256")
    .update(`${onboardingSecret()}|${args.channel}|${args.userId}|${args.destination}|${args.code}`)
    .digest("hex");
}

export function timingSafeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
