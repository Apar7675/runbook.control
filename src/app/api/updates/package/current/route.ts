import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { requirePlatformAdminAal2 } from "@/lib/authz";
import { getReleaseById, publishRelease, validateReleaseSafety } from "@/lib/updates/releases";

export async function POST(req: Request) {
  try {
    await requirePlatformAdminAal2();
    const body = await req.json();
    const packageId = String(body.package_id ?? "").trim();
    if (!packageId) return NextResponse.json({ ok: false, error: "package_id is required." }, { status: 400 });

    const previous = await getReleaseById(packageId);
    if (!previous) return NextResponse.json({ ok: false, error: "Release package not found." }, { status: 404 });
    try {
      validateReleaseSafety(previous);
    } catch (error: any) {
      return NextResponse.json(
        {
          ok: false,
          error: error?.message ?? "That older release no longer satisfies the current update safety rules and cannot be made current.",
        },
        { status: 400 }
      );
    }

    const release = await publishRelease(packageId);

    await auditLog({
      shop_id: null,
      action: "update.release_made_current",
      entity_type: "update",
      entity_id: packageId,
      details: {
        app_id: release.app_id,
        channel: release.channel,
        version: release.version,
      },
    });

    return NextResponse.json({ ok: true, release });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: /not authenticated/i.test(msg) ? 401 : /mfa required/i.test(msg) || /not a platform admin/i.test(msg) ? 403 : 500 }
    );
  }
}
