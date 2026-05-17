import React from "react";
import ControlSidebar from "@/components/control/ControlSidebar";
import { controlTheme as t } from "@/components/control/controlTheme";
import type { ControlStatusTone } from "@/components/control/ControlStatusChip";

export default function ControlAppShell({
  email,
  roleLabel,
  statuses,
  children,
}: {
  email: string;
  roleLabel: string;
  statuses: Array<{ key: string; label: string; tone: ControlStatusTone }>;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.color.appBg,
        color: t.color.text,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 16% 18%, rgba(124, 58, 237, 0.18), transparent 26%), radial-gradient(circle at 82% 0%, rgba(6, 182, 212, 0.12), transparent 24%), linear-gradient(180deg, rgba(7, 10, 15, 0.2), rgba(7, 10, 15, 0.92))",
        }}
      />
      <div
        className="control-shell"
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: `${t.layout.sidebarWidth}px minmax(0, 1fr)`,
        }}
      >
        <ControlSidebar email={email} roleLabel={roleLabel} statuses={statuses} />

        <main
          style={{
            minWidth: 0,
            minHeight: "100vh",
            overflow: "auto",
          }}
        >
          <div
            style={{
              maxWidth: t.layout.contentMaxWidth,
              margin: "0 auto",
              padding: 18,
              display: "grid",
              gap: 16,
            }}
          >
            {children}
          </div>
        </main>
      </div>
      <style>{`
        @media (max-width: 1100px) {
          .control-shell {
            grid-template-columns: 240px minmax(0, 1fr) !important;
          }
        }
        @media (max-width: 900px) {
          .control-shell {
            grid-template-columns: 1fr !important;
          }
          .control-shell > aside {
            position: relative !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
