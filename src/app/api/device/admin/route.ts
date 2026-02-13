// REPLACE ENTIRE FILE: src/app/api/device/admin/route.ts
//
// HARDENING (this pass):
// - Rate limit.
// - UUID tripwire for deviceId.
// - Centralized authz: requires platform admin + AAL2.
// - Keeps DB-enforced RPC model (best place to centralize permissions + auditing).
// - Normalizes response shape to { ok, ... }.
// - Keeps activation token generation server-side and returns plaintext once.
// - Uses consistent status mapping from RPC errors.

import { NextResponse } from "next/server";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { newToken, sha256Hex } from "@/lib/crypto";
import { assertUuid, requirePlatformAdminAal2 } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:admin:${ip}`, limit: 120, windowMs: 60_000 });

    const body = await req.json().catch(() => ({}));
    const action = String((body as any)?.action ?? "").trim(); // toggle_status | regen_activation | delete_device | deactivate_token | force_reactivation
    const deviceId = String((body as any)?.deviceId ?? "").trim();

    if (!action || !deviceId) {
      return NextResponse.json({ ok: false, error: "Missing action or deviceId" }, { status: 400 });
    }

    assertUuid("deviceId", deviceId);

    // Require platform admin with MFA
    await requirePlatformAdminAal2();

    const supabase = await supabaseServer();

    // Helper to map common business errors to better status codes
    const mapRpcError = (msg: string) => {
      const lower = msg.toLowerCase();
      if (lower.includes("not authorized")) return 403;
      if (lower.includes("confirmation") || lower.includes("not found") || lower.includes("missing")) return 400;
      return 500;
    };

    if (action === "toggle_status") {
      const { data, error } = await supabase.rpc("rb_device_toggle_status", {
        p_device_id: deviceId,
      });

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: mapRpcError(error.message) });

      return NextResponse.json({ ok: true, status: data }, { status: 200 });
    }

    if (action === "regen_activation" || action === "force_reactivation") {
      const activationPlain = newToken("activate");
      const token_hash = sha256Hex(activationPlain);
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const expiresAt = expires.toISOString();

      const { error } = await supabase.rpc("rb_device_set_activation_token", {
        p_device_id: deviceId,
        p_token_hash: token_hash,
        p_expires_at: expiresAt,
        p_force: action === "force_reactivation",
      });

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: mapRpcError(error.message) });

      // Only plaintext token is returned once, from server
      return NextResponse.json({ ok: true, activationPlain, expiresAt }, { status: 200 });
    }

    if (action === "deactivate_token") {
      const { error } = await supabase.rpc("rb_device_deactivate_token", {
        p_device_id: deviceId,
      });

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: mapRpcError(error.message) });

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === "delete_device") {
      const confirmName = String((body as any)?.confirmName ?? "").trim();

      const { error } = await supabase.rpc("rb_device_delete", {
        p_device_id: deviceId,
        p_confirm_name: confirmName,
      });

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: mapRpcError(error.message) });

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status =
      /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) ? 403 : /not a platform admin/i.test(msg) ? 403 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
