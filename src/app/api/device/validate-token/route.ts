import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitOrThrow } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/audit/writeAudit";
import { hashToken } from "@/lib/device/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rbAssertUuid(label: string, value: string) {
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!ok) throw new Error(`${label} must be a UUID. Got: ${value}`);
}

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function normVer(v: string) {
  return String(v || "").trim().replace(/^v/i, "");
}

// Very tolerant semver-ish parse: "1.2.3", "1.2", "1", "v1.2.3", "1.2.3-alpha".
// We ignore prerelease/build for gating (treat "1.2.3-alpha" as 1.2.3).
function parseVer(v: string): { ok: true; parts: [number, number, number] } | { ok: false } {
  const s = normVer(v);
  if (!s) return { ok: false };
  const main = s.split(/[+-]/)[0]; // drop pre-release/build
  const bits = main.split(".").map((x) => x.trim()).filter(Boolean);
  if (bits.length === 0) return { ok: false };
  const nums = bits.slice(0, 3).map((x) => {
    if (!/^\d+$/.test(x)) return NaN;
    return Number(x);
  });
  while (nums.length < 3) nums.push(0);
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return { ok: false };
  return { ok: true, parts: [nums[0], nums[1], nums[2]] as [number, number, number] };
}

// returns -1 if a<b, 0 if equal, +1 if a>b; null if cannot compare
function cmpVer(a: string, b: string): number | null {
  const pa = parseVer(a);
  const pb = parseVer(b);
  if (!pa.ok || !pb.ok) return null;
  for (let i = 0; i < 3; i++) {
    if (pa.parts[i] < pb.parts[i]) return -1;
    if (pa.parts[i] > pb.parts[i]) return 1;
  }
  return 0;
}

function updateRequiredPayload(args: {
  reason: "missing_version" | "invalid_version" | "below_min" | "not_pinned";
  shop_id: string;
  channel: string | null;
  min_version: string | null;
  pinned_version: string | null;
  current_version: string | null;
}) {
  return {
    ok: false,
    error: "update_required",
    reason: args.reason,
    shop_id: args.shop_id,
    channel: args.channel,
    min_version: args.min_version,
    pinned_version: args.pinned_version,
    current_version: args.current_version,
  };
}

export async function GET(req: Request) {
  return validate(req);
}
export async function POST(req: Request) {
  return validate(req);
}

async function validate(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimitOrThrow({ key: `device:validate:${ip}`, limit: 240, windowMs: 60_000 });

    const raw = getBearerToken(req);
    if (!raw) return NextResponse.json({ ok: false, error: "Missing Authorization: Bearer <token>" }, { status: 401 });

    const tokenHash = hashToken(raw);
    const admin = supabaseAdmin();

    // 1) Lookup token by hash
    const { data: tok, error: tokErr } = await admin
      .from("rb_device_tokens")
      .select("id, device_id, revoked_at, label, issued_at, last_seen_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokErr) return NextResponse.json({ ok: false, error: tokErr.message }, { status: 500 });
    if (!tok) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

    rbAssertUuid("token_id", String(tok.id));
    rbAssertUuid("device_id", String(tok.device_id));

    if (tok.revoked_at) return NextResponse.json({ ok: false, error: "Token revoked" }, { status: 403 });

    // 2) Fetch device (no existence leak)
    const { data: dev, error: devErr } = await admin
      .from("rb_devices")
      .select("id, shop_id, name, device_type, status, created_at, reported_version, last_seen_at")
      .eq("id", tok.device_id)
      .maybeSingle();

    if (devErr) return NextResponse.json({ ok: false, error: devErr.message }, { status: 500 });
    if (!dev) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

    rbAssertUuid("device.id", String(dev.id));
    rbAssertUuid("device.shop_id", String(dev.shop_id));

    if (String(dev.status ?? "").toLowerCase() !== "active") {
      return NextResponse.json({ ok: false, error: "Device inactive" }, { status: 403 });
    }

    // 3) Ensure shop exists (best-effort)
    try {
      const { data: shop, error: sErr } = await admin.from("rb_shops").select("id").eq("id", dev.shop_id).maybeSingle();
      if (!sErr && !shop) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    } catch {
      // ignore
    }

    // 4) Enforce update policy (min_version / pinned_version)
    // Uses rb_update_policy (shop_id, channel, min_version, pinned_version)
    let policy: { channel: string | null; min_version: string | null; pinned_version: string | null } | null = null;

    try {
      const { data: pol, error: pErr } = await admin
        .from("rb_update_policy")
        .select("channel,min_version,pinned_version")
        .eq("shop_id", dev.shop_id)
        .maybeSingle();

      if (!pErr && pol) {
        policy = {
          channel: pol.channel ?? null,
          min_version: pol.min_version ?? null,
          pinned_version: pol.pinned_version ?? null,
        };
      }
      // If error, treat policy as missing (don’t outage device auth due to policy read issues)
    } catch {
      // ignore
    }

    const currentVersion = dev.reported_version ? String(dev.reported_version) : null;

    if (policy && (policy.min_version || policy.pinned_version)) {
      const minV = policy.min_version ? String(policy.min_version) : null;
      const pinV = policy.pinned_version ? String(policy.pinned_version) : null;

      // If device hasn't checked in with a version yet, block when any gate exists
      if (!currentVersion) {
        const payload = updateRequiredPayload({
          reason: "missing_version",
          shop_id: dev.shop_id,
          channel: policy.channel,
          min_version: minV,
          pinned_version: pinV,
          current_version: null,
        });

        try {
          await writeAudit({
            actor_user_id: null,
            actor_email: null,
            action: "device.update_required",
            target_type: "device",
            target_id: dev.id,
            shop_id: dev.shop_id ?? null,
            meta: { ...payload, token_id: tok.id, device_name: dev.name ?? null, device_type: dev.device_type ?? null, at: new Date().toISOString() },
          });
        } catch {}

        return NextResponse.json(payload, { status: 403 });
      }

      // Pinned must match exactly (after trimming leading v)
      if (pinV && normVer(currentVersion) !== normVer(pinV)) {
        const payload = updateRequiredPayload({
          reason: "not_pinned",
          shop_id: dev.shop_id,
          channel: policy.channel,
          min_version: minV,
          pinned_version: pinV,
          current_version: currentVersion,
        });

        try {
          await writeAudit({
            actor_user_id: null,
            actor_email: null,
            action: "device.update_required",
            target_type: "device",
            target_id: dev.id,
            shop_id: dev.shop_id ?? null,
            meta: { ...payload, token_id: tok.id, device_name: dev.name ?? null, device_type: dev.device_type ?? null, at: new Date().toISOString() },
          });
        } catch {}

        return NextResponse.json(payload, { status: 403 });
      }

      // Min version compare
      if (minV) {
        const c = cmpVer(currentVersion, minV);
        if (c === null) {
          const payload = updateRequiredPayload({
            reason: "invalid_version",
            shop_id: dev.shop_id,
            channel: policy.channel,
            min_version: minV,
            pinned_version: pinV,
            current_version: currentVersion,
          });

          try {
            await writeAudit({
              actor_user_id: null,
              actor_email: null,
              action: "device.update_required",
              target_type: "device",
              target_id: dev.id,
              shop_id: dev.shop_id ?? null,
              meta: { ...payload, token_id: tok.id, device_name: dev.name ?? null, device_type: dev.device_type ?? null, at: new Date().toISOString() },
            });
          } catch {}

          return NextResponse.json(payload, { status: 403 });
        }

        if (c < 0) {
          const payload = updateRequiredPayload({
            reason: "below_min",
            shop_id: dev.shop_id,
            channel: policy.channel,
            min_version: minV,
            pinned_version: pinV,
            current_version: currentVersion,
          });

          try {
            await writeAudit({
              actor_user_id: null,
              actor_email: null,
              action: "device.update_required",
              target_type: "device",
              target_id: dev.id,
              shop_id: dev.shop_id ?? null,
              meta: { ...payload, token_id: tok.id, device_name: dev.name ?? null, device_type: dev.device_type ?? null, at: new Date().toISOString() },
            });
          } catch {}

          return NextResponse.json(payload, { status: 403 });
        }
      }
    }

    const now = new Date().toISOString();

    // 5) Update last_seen_at (best-effort) for BOTH token + device
    try {
      await admin.from("rb_device_tokens").update({ last_seen_at: now }).eq("id", tok.id);
    } catch {}
    try {
      await admin.from("rb_devices").update({ last_seen_at: now }).eq("id", dev.id);
    } catch {}

    // 6) Audit validated (best-effort)
    try {
      await writeAudit({
        actor_user_id: null,
        actor_email: null,
        action: "device_token.validated",
        target_type: "device",
        target_id: dev.id,
        shop_id: dev.shop_id ?? null,
        meta: {
          token_id: tok.id,
          label: tok.label ?? null,
          device_name: dev.name ?? null,
          device_type: dev.device_type ?? null,
          reported_version: currentVersion,
          at: now,
        },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      token_id: tok.id,
      device: {
        id: dev.id,
        shop_id: dev.shop_id,
        name: dev.name,
        device_type: dev.device_type,
        status: dev.status,
        created_at: dev.created_at,
        reported_version: currentVersion,
      },
      policy: policy
        ? {
            channel: policy.channel,
            min_version: policy.min_version,
            pinned_version: policy.pinned_version,
          }
        : null,
    });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = /missing authorization/i.test(msg) ? 401 : /must be a uuid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
