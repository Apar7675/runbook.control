// REPLACE ENTIRE FILE: src/app/api/user/trust-device/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const ip =
      (cookies().get("x-forwarded-for")?.value ?? "") ||
      "local";
    rateLimitOrThrow({ key: `trust:${ip}`, limit: 20, windowMs: 60_000 });

    const supabase = await supabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user ?? null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel as "aal1" | "aal2" | "aal3" | null) ?? "aal1";
    if (aal !== "aal2") return NextResponse.json({ error: "MFA required (AAL2)" }, { status: 403 });

    const deviceId = cookies().get("rb_device_id")?.value ?? "";
    if (!deviceId) return NextResponse.json({ error: "Missing device id cookie" }, { status: 400 });

    const trustedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const admin = supabaseAdmin();
    await admin
      .from("rb_trusted_devices")
      .upsert(
        { user_id: user.id, device_id: deviceId, trusted_until: trustedUntil },
        { onConflict: "user_id,device_id" }
      );

    await writeAudit({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "trusted_device.set",
      target_type: "user",
      target_id: user.id,
      meta: { hours: 24 },
    });

    return NextResponse.json({ ok: true, trusted_until: trustedUntil });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
