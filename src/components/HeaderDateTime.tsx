"use client";

import React, { useEffect, useState } from "react";
import { formatDateHeader, formatTime } from "@/lib/ui/dates";
import { useIsMounted } from "@/lib/ui/useIsMounted";

function formatDateTime(date: Date) {
  return {
    date: formatDateHeader(date),
    time: formatTime(date),
  };
}

export default function HeaderDateTime() {
  const mounted = useIsMounted();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const tick = () => setNow(new Date());
    tick();
    const handle = window.setInterval(tick, 1000);
    return () => window.clearInterval(handle);
  }, [mounted]);

  const formatted = mounted && now ? formatDateTime(now) : { date: "Loading date", time: "--:--" };

  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "center",
        minHeight: 30,
        minWidth: 164,
        padding: "6px 12px",
        borderRadius: 999,
        border: "1px solid rgba(79,100,124,0.55)",
        background: "rgba(10,16,25,0.95)",
        boxShadow: "0 0 0 1px rgba(79,100,124,0.24) inset, 0 0 16px rgba(121,153,214,0.1)",
      }}
    >
      <span
        style={{
          color: "#dde6f3",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.1,
          textAlign: "right",
        }}
      >
        {formatted.date}
      </span>
      <span
        style={{
          color: "#f5f8fd",
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.15,
          textAlign: "right",
          marginTop: 2,
        }}
      >
        {formatted.time}
      </span>
    </span>
  );
}
