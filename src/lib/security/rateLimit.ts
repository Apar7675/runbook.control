// REPLACE ENTIRE FILE: src/lib/security/rateLimit.ts

type Bucket = { count: number; resetAt: number };

function nowMs() {
  return Date.now();
}

// In-memory limiter (dev/single instance). Swap to Redis later if needed.
export function rateLimitOrThrow(opts: { key: string; limit: number; windowMs: number }) {
  const g = globalThis as any;
  if (!g.__rb_rate__) g.__rb_rate__ = new Map<string, Bucket>();
  const map: Map<string, Bucket> = g.__rb_rate__;

  const t = nowMs();
  const b = map.get(opts.key);

  if (!b || t >= b.resetAt) {
    map.set(opts.key, { count: 1, resetAt: t + opts.windowMs });
    return;
  }

  b.count += 1;
  if (b.count > opts.limit) {
    const waitSec = Math.max(1, Math.ceil((b.resetAt - t) / 1000));
    throw new Error(`Rate limit exceeded. Try again in ${waitSec}s.`);
  }
}
