import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlPanel from "@/components/control/ControlPanel";
import { controlTheme as t } from "@/components/control/controlTheme";
import { supabaseServer } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function RestrictedPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = user?.id ? await isPlatformAdmin(user.id).catch(() => false) : false;

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
      <div style={{ width: "100%", maxWidth: 680 }}>
        <ControlPanel>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: t.color.textMuted }}>
              RunBook Control
            </div>
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.08, color: t.color.text }}>Platform administrators only</h1>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: t.color.textSecondary }}>
              RunBook Control is restricted to platform administrators. Customer setup is completed from RunBook Desktop.
            </p>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: t.color.textMuted }}>
              Control stores cloud/admin data such as shop identity, billing outcomes, access decisions, update metadata, and support telemetry like device capability snapshots. It is not a customer portal and it does not own Desktop manufacturing files or Service runtime truth.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {admin ? (
                <ControlActionLink href="/dashboard" tone="primary">Open Command Center</ControlActionLink>
              ) : (
                <ControlActionLink href="/login" tone="primary">Return to login</ControlActionLink>
              )}
            </div>
          </div>
        </ControlPanel>
      </div>
    </div>
  );
}
