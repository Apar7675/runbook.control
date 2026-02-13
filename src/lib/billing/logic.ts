import type { BillingGateMode } from "@/components/billing/BillingGate";

export function safeMode(m?: string | null): BillingGateMode {
  const s = (m ?? "").trim().toLowerCase();
  if (s === "hard" || s === "soft" || s === "hybrid") return s;
  return "hybrid";
}

export function parseCsv(input?: string | null): string[] {
  return (input ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function clampGraceDays(n: any, fallback = 14): number {
  const v = Number.parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v) || v < 0 || v > 120) return fallback;
  return v;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

export function isWithinGrace(
  periodEndIso: string | null,
  graceDays: number
): { inGrace: boolean; graceUntilIso?: string } {
  if (!periodEndIso) return { inGrace: false };
  const end = new Date(periodEndIso);
  if (Number.isNaN(end.getTime())) return { inGrace: false };

  const graceUntil = addDays(end, graceDays);
  const now = new Date();

  return {
    inGrace: now.getTime() <= graceUntil.getTime(),
    graceUntilIso: graceUntil.toISOString(),
  };
}
