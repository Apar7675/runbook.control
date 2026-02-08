// REPLACE ENTIRE FILE: src/app/api/user/ensure-device-id/route.ts

import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const existing = req.headers.get("cookie") ?? "";

  // If cookie already exists, do nothing
  if (existing.includes("rb_device_id=")) {
    return NextResponse.json({ ok: true, device_id: "set" });
  }

  const id = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.json({ ok: true, device_id: "set" });

  // NOTE: secure=false for localhost; set true behind HTTPS in prod.
  res.cookies.set("rb_device_id", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
