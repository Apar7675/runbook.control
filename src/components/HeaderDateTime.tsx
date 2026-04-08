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
    <span className="rb-dateTime">
      <span className="rb-dateTimeLabel">{formatted.date}</span>
      <span className="rb-dateTimeValue">{formatted.time}</span>
    </span>
  );
}
