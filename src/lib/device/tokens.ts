// REPLACE ENTIRE FILE: src/lib/device/tokens.ts

import crypto from "crypto";

export function generateRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}
