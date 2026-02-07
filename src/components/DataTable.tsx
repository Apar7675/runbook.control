import React from "react";
import { theme } from "@/lib/ui/theme";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: string;
};

export default function DataTable<T>({
  rows,
  columns,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div style={{ opacity: 0.7 }}>
        {empty ?? "No records found."}
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        border: theme.border.soft,
        borderRadius: theme.radius.md,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  padding: "10px 12px",
                  color: theme.text.muted,
                  borderBottom: theme.border.soft,
                  width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              style={{
                background:
                  i % 2 === 0
                    ? "transparent"
                    : "rgba(255,255,255,0.03)",
              }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: "10px 12px",
                    borderBottom: theme.border.soft,
                    verticalAlign: "middle",
                  }}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
