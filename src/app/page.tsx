import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlPanel from "@/components/control/ControlPanel";
import { controlTheme as t } from "@/components/control/controlTheme";

export const dynamic = "force-static";

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 18,
        background: t.color.appBg,
      }}
    >
      <div style={{ width: "100%", maxWidth: 700 }}>
        <ControlPanel>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: t.color.textMuted }}>
              RunBook Control
            </div>
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.08, color: t.color.text }}>
              Platform admin command center
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: t.color.textSecondary }}>
              Control is restricted to platform administrators. Customer setup and onboarding stay inside RunBook Desktop.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ControlActionLink href="/login" tone="primary">Platform admin login</ControlActionLink>
              <ControlActionLink href="/restricted">Access policy</ControlActionLink>
            </div>
          </div>
        </ControlPanel>
      </div>
    </div>
  );
}
