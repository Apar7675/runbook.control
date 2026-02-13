export type BillingFeature =
  | "po.write"
  | "components.write"
  | "ballooning.save"
  | "inspection.submit"
  | "timeclock.punch"
  | "employees.manage"
  | "settings.write";

export const WRITE_FEATURES: Record<BillingFeature, true> = {
  "po.write": true,
  "components.write": true,
  "ballooning.save": true,
  "inspection.submit": true,
  "timeclock.punch": true,
  "employees.manage": true,
  "settings.write": true,
};
