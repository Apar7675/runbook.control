import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireSessionUser } from "@/lib/desktopAuth";
import { POST as issueEntitlement } from "../entitlement/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canonicalId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) &&
    id !== "00000000-0000-0000-0000-000000000000" ? id : null;
}

// Recover the existing global issuer's public verification material over the
// original trusted HTTPS Control connection. This creates no key, module grant,
// enrollment or role. A client must verify the actual returned signed envelope
// before initializing missing installation trust; it must not auto-rotate a pin.
export async function POST(req: Request) {
  let userId: string;
  try {
    const { user } = await requireSessionUser(req);
    userId = user.id;
  } catch {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    const request = await req.clone().json().catch(() => null);
    const shopId = canonicalId(request?.shop_id);
    const deviceId = canonicalId(request?.device_id);
    if (!shopId || !deviceId) {
      return NextResponse.json({ ok: false, error: "A valid shop_id and device_id are required." }, { status: 400 });
    }

    // Reuse the genuine issuer, including current active membership/device,
    // cleanup denial and its existing commercial/offline policy. The request
    // bearer remains identical; no caller-supplied identity or role is trusted.
    const canonicalRequest = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ shop_id: shopId, device_id: deviceId }),
    });
    const issued = await issueEntitlement(canonicalRequest);
    if (!issued.ok) return issued;
    const signed = await issued.json();
    if (!signed?.ok || !signed.envelope) {
      throw new Error("The issuer returned inconsistent verification material.");
    }

    const privatePem = process.env.RUNBOOK_DESKTOP_ENTITLEMENT_PRIVATE_KEY_PEM?.replace(/\\n/g, "\n");
    if (!privatePem) throw new Error("The existing issuer is not configured.");
    const privateKey = crypto.createPrivateKey(privatePem);
    if (privateKey.asymmetricKeyType !== "rsa") throw new Error("The existing issuer is not RS256.");
    const publicKey = crypto.createPublicKey(privateKey);
    const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const keyId = (process.env.RUNBOOK_DESKTOP_ENTITLEMENT_KEY_ID ?? "desktop-entitlement-v1").trim() || "desktop-entitlement-v1";
    if (signed.envelope.version !== 1 || signed.envelope.algorithm !== "RS256" || signed.envelope.key_id !== keyId ||
        !crypto.verify("RSA-SHA256", Buffer.from(signed.envelope.payload_b64, "base64url"), publicKey,
          Buffer.from(signed.envelope.signature_b64, "base64url"))) {
      throw new Error("The existing issuer changed during verification recovery.");
    }

    const payload = JSON.parse(Buffer.from(signed.envelope.payload_b64, "base64url").toString("utf8"));
    if (payload.ver !== 1 || payload.iss !== "runbook.control" || payload.shop_id !== shopId ||
        payload.device_id !== deviceId || typeof payload.server_time_utc !== "string") {
      throw new Error("Signed verification scope differs from the authenticated request.");
    }

    return NextResponse.json({
      ok: true,
      trust: {
        version: 1,
        issuer: "runbook.control",
        algorithm: "RS256",
        key_id: keyId,
        public_key_pem: publicPem,
        user_id: userId,
        shop_id: shopId,
        device_id: deviceId,
        issued_at_utc: payload.server_time_utc,
      },
      envelope: signed.envelope,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Global issuer verification could not be recovered. Existing installation trust was not changed." },
      { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
