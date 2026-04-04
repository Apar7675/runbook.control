export type DateInput = string | number | Date;

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateShort(input: DateInput): string {
  const d = toDate(input);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatDateHeader(input: DateInput): string {
  const d = toDate(input);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(input: DateInput): string {
  const d = toDate(input);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatRelative(input: DateInput): string {
  const now = Date.now();
  const diff = Math.floor((now - toDate(input).getTime()) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;

  return formatDateShort(input);
}
