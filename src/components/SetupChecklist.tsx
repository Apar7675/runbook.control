import React from "react";

export type ChecklistItem = {
  key: string;
  title: string;
  done: boolean;
  hint: string;
  ctaLabel: string;
  ctaHref: string;
};

export default function SetupChecklist({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: ChecklistItem[];
}) {
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 0.4, color: "#9fa3ff", textTransform: "uppercase" }}>
            {title}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>{subtitle}</div>
        </div>

        <div style={{ fontSize: 13, opacity: 0.8 }}>
          <b>{doneCount}</b> / <b>{items.length}</b>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {items.map((i) => (
          <div
            key={i.key}
            style={{
              display: "grid",
              gridTemplateColumns: "26px 1fr auto",
              gap: 12,
              alignItems: "center",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: i.done ? "rgba(139,140,255,0.10)" : "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 900,
                opacity: i.done ? 1 : 0.55,
              }}
              title={i.done ? "Done" : "Not done yet"}
            >
              {i.done ? "✓" : "•"}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900 }}>
                {i.title}{" "}
                <span title={i.hint} style={{ fontWeight: 900, opacity: 0.5, marginLeft: 6, cursor: "help" }}>
                  ⓘ
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{i.hint}</div>
            </div>

            <a
              href={i.ctaHref}
              style={{
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.05)",
                fontWeight: 900,
                color: "inherit",
                opacity: i.done ? 0.65 : 1,
                pointerEvents: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {i.ctaLabel}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
