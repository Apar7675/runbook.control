import Link from "next/link";
import React from "react";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";

export default function ControlTabsV2({
  tabs,
  activeKey,
}: {
  tabs: Array<{ key: string; label: string; href: string }>;
  activeKey: string;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", paddingBottom: 8, borderBottom: `1px solid ${t.color.border}` }}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 30,
              padding: "5px 10px",
              borderRadius: t.radius.sm,
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 700,
              color: active ? t.color.text : t.color.textQuiet,
              border: active ? `1px solid ${t.color.borderStrong}` : "1px solid transparent",
              background: active ? t.color.surface : "transparent",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
