export type ConnectionHealth = "Healthy" | "Degraded" | "Disconnected";

export type ConnectionStatusItem = {
  key: string;
  label: string;
  health: ConnectionHealth;
  reason: string;
  lastCheckedUtc?: string;
};

export function toneForHealth(health: ConnectionHealth) {
  switch (health) {
    case "Healthy":
      return {
        background: "rgba(80,220,140,0.14)",
        borderColor: "rgba(80,220,140,0.34)",
        dot: "#7DF1AE",
      };
    case "Degraded":
      return {
        background: "rgba(255,180,80,0.14)",
        borderColor: "rgba(255,180,80,0.34)",
        dot: "#FFD089",
      };
    default:
      return {
        background: "rgba(255,120,120,0.14)",
        borderColor: "rgba(255,120,120,0.34)",
        dot: "#FFB0B0",
      };
  }
}

export function buildControlHeaderStatuses(args: {
  hasSession: boolean;
  hasUser: boolean;
  dataHealthy: boolean;
  dataReason?: string;
}): ConnectionStatusItem[] {
  const nowUtc = new Date().toISOString();
  return [
    {
      key: "control_api",
      label: "API",
      health: args.hasSession && args.hasUser ? "Healthy" : "Disconnected",
      reason: args.hasSession && args.hasUser
        ? "Authenticated Control session is active."
        : "Control auth session is unavailable.",
      lastCheckedUtc: nowUtc,
    },
    {
      key: "control_data",
      label: "Data",
      health: args.dataHealthy ? "Healthy" : "Disconnected",
      reason: args.dataHealthy
        ? "Core data dependency is reachable."
        : (args.dataReason?.trim() || "Core data dependency is unavailable."),
      lastCheckedUtc: nowUtc,
    },
  ];
}
