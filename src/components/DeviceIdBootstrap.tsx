// REPLACE ENTIRE FILE: src/components/DeviceIdBootstrap.tsx

"use client";

import { useEffect } from "react";

export default function DeviceIdBootstrap() {
  useEffect(() => {
    // ensures rb_device_id cookie exists (httpOnly) for trusted-device checks
    fetch("/api/user/ensure-device-id", { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  return null;
}
