import crypto from "crypto";
import { NextResponse } from "next/server";

export type WorkstationModule = "timeclock" | "dashboard" | "jobs" | "inspection" | "camera";

export type WorkstationSessionPayload = {
  shop_id: string;
  workstation_id: string;
  employee_id: string;
  display_name: string;
  role: string;
  modules: WorkstationModule[];
  issued_at_utc: string;
  expires_at_utc: string;
};

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBuffer(input: string) {
  const normalized = String(input ?? "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  return Buffer.from(padded, "base64");
}

function getSecret() {
  return env("RUNBOOK_WORKSTATION_SESSION_SECRET");
}

export function signWorkstationSession(payload: WorkstationSessionPayload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = b64url(Buffer.from(JSON.stringify(header), "utf8"));
  const encodedPayload = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const data = `${encodedHeader}.${encodedPayload}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

export function verifyWorkstationSession(token: string): WorkstationSessionPayload {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) throw new Error("Not authenticated");

  const parts = trimmed.split(".");
  if (parts.length !== 3) throw new Error("Not authenticated");

  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(data).digest();
  const actualSig = base64UrlToBuffer(encodedSig);
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    throw new Error("Not authenticated");
  }

  const payload = JSON.parse(base64UrlToBuffer(encodedPayload).toString("utf8")) as WorkstationSessionPayload;
  if (!payload?.employee_id || !payload?.shop_id || !payload?.workstation_id) {
    throw new Error("Not authenticated");
  }

  const expires = Date.parse(payload.expires_at_utc ?? "");
  if (!Number.isFinite(expires) || expires <= Date.now()) {
    throw new Error("Session expired");
  }

  return payload;
}

export function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Not authenticated");
  return match[1].trim();
}

export function requireWorkstationSession(req: Request) {
  return verifyWorkstationSession(getBearerToken(req));
}

export function workstationAuthError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const status = /expired/i.test(msg) ? 401 : /not authenticated/i.test(msg) ? 401 : 400;
  return NextResponse.json({ ok: false, error: msg }, { status });
}
