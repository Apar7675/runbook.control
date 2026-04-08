const STRICT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/;

export function normalizeVersion(value: string | null | undefined) {
  return String(value ?? "").trim();
}

type ParsedVersion = [number, number, number, number];

export function isStrictReleaseVersion(value: string | null | undefined) {
  const raw = String(value ?? "");
  const normalized = normalizeVersion(raw);
  if (!normalized || raw !== normalized) return false;
  return STRICT_VERSION_PATTERN.test(normalized);
}

export function ensureStrictReleaseVersion(value: string | null | undefined, label = "Version") {
  const normalized = normalizeVersion(value);
  if (!isStrictReleaseVersion(value)) {
    throw new Error(`${label} must use strict numeric format like 1.2.3 or 1.2.3.4.`);
  }

  return normalized;
}

function parseVersion(value: string | null | undefined): ParsedVersion | null {
  const normalized = normalizeVersion(value);
  if (!STRICT_VERSION_PATTERN.test(normalized)) return null;

  const bits = normalized.split(".");
  const numbers = bits.map((part) => Number(part));
  while (numbers.length < 4) numbers.push(0);
  if (numbers.some((part) => !Number.isFinite(part) || part < 0)) return null;
  return [numbers[0], numbers[1], numbers[2], numbers[3]];
}

export function compareVersions(left: string | null | undefined, right: string | null | undefined): number | null {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;

  for (let index = 0; index < 4; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }

  return 0;
}

export function isVersionGreater(left: string | null | undefined, right: string | null | undefined) {
  return compareVersions(left, right) === 1;
}
