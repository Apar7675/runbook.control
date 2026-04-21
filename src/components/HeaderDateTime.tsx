"use client";

import React, { useEffect, useState } from "react";
import { formatDateHeader, formatTime } from "@/lib/ui/dates";
import { useIsMounted } from "@/lib/ui/useIsMounted";
import { theme } from "@/lib/ui/theme";

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
        minHeight: 40,
        minWidth: 176,
        padding: "7px 13px",
        borderRadius: theme.radius.pill,
        border: "1px solid rgba(110,132,164,0.34)",
        background: "linear-gradient(180deg, rgba(10,16,27,0.95), rgba(7,11,20,0.92))",
        boxShadow:
          "0 0 0 1px rgba(79,100,124,0.18) inset, 0 0 18px rgba(121,153,214,0.08)",
      }}
    >
      <span
        style={{
          color: theme.text.muted,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.1,
          textAlign: "right",
        }}
      >
        {formatted.date}
      </span>
      <span
        style={{
          color: theme.text.primary,
          fontSize: 16,
          fontWeight: 800,
          lineHeight: 1.15,
          textAlign: "right",
          marginTop: 3,
          letterSpacing: -0.18,
        }}
      >
        {formatted.time}
      </span>
    </span>
  );
}
