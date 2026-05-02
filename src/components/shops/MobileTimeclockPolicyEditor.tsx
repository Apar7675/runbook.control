"use client";

import React from "react";
import { ControlActionButtonV2 } from "@/components/control/v2/ControlActionButtonV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import ControlPanelV2 from "@/components/control/v2/ControlPanelV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { safeFetch } from "@/lib/http/safeFetch";
import type { MobilePunchFailureMode, MobilePunchPolicy, ShopMobileTimeclockPolicy } from "@/lib/mobileTimeclockPolicy";

type PolicyResponse = {
  ok?: boolean;
  error?: string;
  shop?: ShopMobileTimeclockPolicy;
};

const POLICY_OPTIONS: Array<{ value: MobilePunchPolicy; label: string }> = [
  { value: "DISABLED", label: "Disabled" },
  { value: "ALLOW_ANYWHERE", label: "Allow anywhere" },
  { value: "GPS_GEOFENCE", label: "Require phone to be at the shop" },
  { value: "LOCAL_NETWORK", label: "Require shop Wi-Fi/LAN" },
  { value: "GPS_OR_LOCAL_NETWORK", label: "GPS or local network" },
  { value: "GPS_AND_LOCAL_NETWORK", label: "GPS and local network" },
];

const FAILURE_OPTIONS: Array<{ value: MobilePunchFailureMode; label: string }> = [
  { value: "BLOCK", label: "Block punch" },
  { value: "PENDING_REVIEW", label: "Send failed checks for review" },
];

function arrayText(value: string[] | null | undefined) {
  return (value ?? []).join("\n");
}

function splitList(value: string) {
  return Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)));
}

function field(label: string, children: React.ReactNode, detail?: string) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ color: t.color.textQuiet, ...t.type.label }}>{label}</span>
      {children}
      {detail ? <span style={{ color: t.color.textQuiet, fontSize: 11.5, lineHeight: 1.4 }}>{detail}</span> : null}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail?: string;
}) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} style={{ marginTop: 2 }} />
      <span style={{ display: "grid", gap: 3 }}>
        <span style={{ color: t.color.text, fontSize: 13, fontWeight: 700 }}>{label}</span>
        {detail ? <span style={{ color: t.color.textQuiet, fontSize: 12, lineHeight: 1.45 }}>{detail}</span> : null}
      </span>
    </label>
  );
}

export default function MobileTimeclockPolicyEditor({
  initialPolicy,
}: {
  initialPolicy: ShopMobileTimeclockPolicy;
}) {
  const [policy, setPolicy] = React.useState(initialPolicy);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [networkCidrs, setNetworkCidrs] = React.useState(arrayText(initialPolicy.mobile_allowed_network_cidrs));
  const [wifiSsids, setWifiSsids] = React.useState(arrayText(initialPolicy.mobile_allowed_wifi_ssids));
  const [wifiBssids, setWifiBssids] = React.useState(arrayText(initialPolicy.mobile_allowed_wifi_bssids));

  function setField<K extends keyof ShopMobileTimeclockPolicy>(key: K, value: ShopMobileTimeclockPolicy[K]) {
    setPolicy((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setStatus("");

    const response = await safeFetch<PolicyResponse>("/api/shops/mobile-timeclock-policy", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...policy,
        shop_id: policy.id,
        mobile_allowed_network_cidrs: splitList(networkCidrs),
        mobile_allowed_wifi_ssids: splitList(wifiSsids),
        mobile_allowed_wifi_bssids: splitList(wifiBssids),
      }),
    });

    if (!response.ok || !response.data?.ok || !response.data.shop) {
      setStatus(response.ok ? response.data?.error ?? "Could not save Mobile Time Clock policy." : `${response.status}: ${response.error}`);
      setBusy(false);
      return;
    }

    const updatedShop = response.data.shop;
    setPolicy(updatedShop);
    setNetworkCidrs(arrayText(updatedShop.mobile_allowed_network_cidrs));
    setWifiSsids(arrayText(updatedShop.mobile_allowed_wifi_ssids));
    setWifiBssids(arrayText(updatedShop.mobile_allowed_wifi_bssids));
    setStatus("Mobile Time Clock policy saved.");
    setBusy(false);
  }

  return (
    <ControlPanelV2
      title="Mobile Time Clock"
      description="Control decides whether Mobile punches are approved, blocked, or sent for review. These settings do not make Control the payroll authority."
      actions={<ControlActionButtonV2 tone="primary" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save policy"}</ControlActionButtonV2>}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <Toggle
          checked={policy.mobile_timeclock_enabled}
          onChange={(checked) => {
            setField("mobile_timeclock_enabled", checked);
            if (!checked) setField("mobile_punch_policy", "DISABLED");
          }}
          label="Allow mobile clock in/out"
          detail="Employees still need general Mobile access and their own phone-punch permission."
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {field(
            "Verification method",
            <ControlSelectV2
              value={policy.mobile_punch_policy}
              onChange={(event) => setField("mobile_punch_policy", event.target.value as MobilePunchPolicy)}
            >
              {POLICY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </ControlSelectV2>
          )}
          {field(
            "If verification fails",
            <ControlSelectV2
              value={policy.mobile_punch_failure_mode}
              onChange={(event) => setField("mobile_punch_failure_mode", event.target.value as MobilePunchFailureMode)}
            >
              {FAILURE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </ControlSelectV2>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {field("Shop latitude", <ControlInputV2 inputMode="decimal" value={policy.mobile_geofence_lat ?? ""} onChange={(event) => setField("mobile_geofence_lat", event.target.value === "" ? null : Number(event.target.value))} />)}
          {field("Shop longitude", <ControlInputV2 inputMode="decimal" value={policy.mobile_geofence_lng ?? ""} onChange={(event) => setField("mobile_geofence_lng", event.target.value === "" ? null : Number(event.target.value))} />)}
          {field("Allowed radius in meters", <ControlInputV2 inputMode="numeric" value={policy.mobile_geofence_radius_meters ?? ""} onChange={(event) => setField("mobile_geofence_radius_meters", event.target.value === "" ? null : Number(event.target.value))} />)}
          {field("Max GPS accuracy in meters", <ControlInputV2 inputMode="numeric" placeholder="100" value={policy.mobile_max_gps_accuracy_meters ?? ""} onChange={(event) => setField("mobile_max_gps_accuracy_meters", event.target.value === "" ? null : Number(event.target.value))} />, "Defaults to 100 meters for GPS policies if blank.")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {field("Allowed local network CIDRs", <textarea value={networkCidrs} onChange={(event) => setNetworkCidrs(event.target.value)} rows={4} style={textAreaStyle} />, "One per line, for example 192.168.1.0/24.")}
          {field("Allowed Wi-Fi names", <textarea value={wifiSsids} onChange={(event) => setWifiSsids(event.target.value)} rows={4} style={textAreaStyle} />)}
          {field("Allowed Wi-Fi BSSIDs", <textarea value={wifiBssids} onChange={(event) => setWifiBssids(event.target.value)} rows={4} style={textAreaStyle} />)}
        </div>

        {status ? <div style={{ color: status.toLowerCase().includes("saved") ? t.color.success : t.color.danger, fontSize: 12.5 }}>{status}</div> : null}
      </div>
    </ControlPanelV2>
  );
}

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  borderRadius: t.radius.sm,
  border: `1px solid ${t.color.border}`,
  background: t.color.surfaceMuted,
  color: t.color.text,
  padding: "8px 10px",
  fontSize: 12.5,
  outline: "none",
  resize: "vertical",
};
