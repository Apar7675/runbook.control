export const MOBILE_PUNCH_POLICIES = [
  "DISABLED",
  "ALLOW_ANYWHERE",
  "GPS_GEOFENCE",
  "LOCAL_NETWORK",
  "GPS_OR_LOCAL_NETWORK",
  "GPS_AND_LOCAL_NETWORK",
] as const;

export const MOBILE_PUNCH_FAILURE_MODES = ["BLOCK", "PENDING_REVIEW"] as const;

export type MobilePunchPolicy = (typeof MOBILE_PUNCH_POLICIES)[number];
export type MobilePunchFailureMode = (typeof MOBILE_PUNCH_FAILURE_MODES)[number];

export const SHOP_MOBILE_TIMECLOCK_SELECT_COLUMNS = [
  "id",
  "name",
  "mobile_timeclock_enabled",
  "mobile_punch_policy",
  "mobile_punch_failure_mode",
  "mobile_geofence_lat",
  "mobile_geofence_lng",
  "mobile_geofence_radius_meters",
  "mobile_max_gps_accuracy_meters",
  "mobile_allowed_network_cidrs",
  "mobile_allowed_wifi_ssids",
  "mobile_allowed_wifi_bssids",
] as const;

export type ShopMobileTimeclockPolicy = {
  id: string;
  name: string;
  mobile_timeclock_enabled: boolean;
  mobile_punch_policy: MobilePunchPolicy;
  mobile_punch_failure_mode: MobilePunchFailureMode;
  mobile_geofence_lat: number | null;
  mobile_geofence_lng: number | null;
  mobile_geofence_radius_meters: number | null;
  mobile_max_gps_accuracy_meters: number | null;
  mobile_allowed_network_cidrs: string[] | null;
  mobile_allowed_wifi_ssids: string[] | null;
  mobile_allowed_wifi_bssids: string[] | null;
};

export function hasGpsPolicy(policy: MobilePunchPolicy) {
  return policy === "GPS_GEOFENCE" || policy === "GPS_OR_LOCAL_NETWORK" || policy === "GPS_AND_LOCAL_NETWORK";
}

export function hasLanPolicy(policy: MobilePunchPolicy) {
  return policy === "LOCAL_NETWORK" || policy === "GPS_OR_LOCAL_NETWORK" || policy === "GPS_AND_LOCAL_NETWORK";
}

export function isMobilePunchPolicy(value: string): value is MobilePunchPolicy {
  return (MOBILE_PUNCH_POLICIES as readonly string[]).includes(value);
}

export function isMobilePunchFailureMode(value: string): value is MobilePunchFailureMode {
  return (MOBILE_PUNCH_FAILURE_MODES as readonly string[]).includes(value);
}
