import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { newToken, sha256Hex } from "@/lib/crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "").trim(); // toggle_status | regen_activation | delete_device | deactivate_token | force_reactivation
    const deviceId = String(body.deviceId ?? "").trim();

    if (!action || !deviceId) {
      return NextResponse.json({ error: "Missing action or deviceId" }, { status: 400 });
    }

    const supabase = await supabaseServer();
    const { data: me } = await supabase.auth.getUser();
    if (!me.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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

      if (error) return NextResponse.json({ error: error.message }, { status: mapRpcError(error.message) });

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

      if (error) return NextResponse.json({ error: error.message }, { status: mapRpcError(error.message) });

      // Only plaintext token is returned once, from server
      return NextResponse.json({ ok: true, activationPlain, expiresAt }, { status: 200 });
    }

    if (action === "deactivate_token") {
      const { error } = await supabase.rpc("rb_device_deactivate_token", {
        p_device_id: deviceId,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: mapRpcError(error.message) });

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === "delete_device") {
      const confirmName = String(body.confirmName ?? "").trim();

      const { error } = await supabase.rpc("rb_device_delete", {
        p_device_id: deviceId,
        p_confirm_name: confirmName,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: mapRpcError(error.message) });

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
