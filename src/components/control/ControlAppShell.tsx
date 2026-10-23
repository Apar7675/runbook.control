import React from "react";
import CompanyScope, { CompanyScopeNotice } from "@/components/control/CompanyScope";
import type { CompanyOption } from "@/lib/control/companyScope";
import ControlSidebar from "@/components/control/ControlSidebar";
import { controlTheme as t } from "@/components/control/controlTheme";
import type { ControlStatusTone } from "@/components/control/ControlStatusChip";

export default function ControlAppShell({ email, roleLabel, statuses, companies = [], selectedCompanyId = null, companyUnavailable = false, companyError = null, children }: {
  email: string;
  roleLabel: string;
  statuses: Array<{ key: string; label: string; tone: ControlStatusTone }>;
  companies?: CompanyOption[];
  selectedCompanyId?: string | null;
  companyUnavailable?: boolean;
  companyError?: string | null;
  children: React.ReactNode;
}) {
  return (
    <CompanyScope key={selectedCompanyId ?? "unavailable"} companies={companies} selectedId={selectedCompanyId} unavailable={companyUnavailable} error={companyError}>
    <div className="control-shell" style={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: "clamp(208px, 15vw, 232px) minmax(0, 1fr)", background: "linear-gradient(135deg, #EFE8FF 0%, #DAECFF 45%, #E7E2FF 100%)", color: t.color.text }}>
      <ControlSidebar email={email} roleLabel={roleLabel} statuses={statuses} />
      <main className="control-main" style={{ minWidth: 0, minHeight: "100dvh" }}>
        <div className="control-main-content" style={{ maxWidth: t.layout.contentMaxWidth, margin: "0 auto", padding: "14px 18px 18px", display: "grid", gap: 10 }}>
          <CompanyScopeNotice />
          {children}
        </div>
      </main>
      <style>{`
        .control-shell { font-family: "Segoe UI", Arial, sans-serif; font-size: 14px; line-height: 1.4; }
        .control-shell *, .control-shell *::before, .control-shell *::after { box-sizing: border-box; }
        .control-main { overflow-wrap: anywhere; }
        .control-shell input, .control-shell select, .control-shell button { font-family: inherit; font-size: inherit; }
        .control-page-actions a, .control-page-actions button { min-height: 34px !important; padding: 0 12px !important; font-size: 14px !important; }
        .control-shell .control-sidebar a:focus-visible, .control-shell .control-sidebar input:focus-visible { outline: 2px solid #8BD7FF; outline-offset: 2px; }
        .control-sidebar a { box-sizing: border-box; }
        .control-shell .control-panel-heading { background-image: url("/artwork/runbook-refined-b/message-header.png"); background-size: 100% 100%; background-repeat: no-repeat; }
        .control-shell .control-panel-heading a { color: #FFFFFF; }
        .control-shell button:focus-visible,
        .control-shell select:focus-visible,
        .control-shell input:focus-visible,
        .control-shell textarea:focus-visible,
        .control-shell main a:focus-visible,
        .control-shell [role="region"]:focus-visible { outline: 2px solid #075FFF; outline-offset: 3px; }
        .control-shell .control-table { border-collapse: collapse; }
        .control-shell .control-table th,
        .control-shell .control-table td { border-bottom: 1px solid #B3C6E2; }
        .control-shell .control-table tbody tr:hover { background-color: #EAF1FC; }
        @media (min-width: 651px) and (max-height: 600px) {
          .control-shell .control-sidebar { grid-template-rows: max-content max-content max-content max-content !important; overflow-y: auto !important; }
          .control-sidebar .control-nav { overflow: visible !important; }
        }
        @media (max-width: 1100px) { .control-main-content { padding: 14px !important; } }
        @media (max-width: 650px) {
          .control-shell { grid-template-columns: minmax(0, 1fr) !important; }
          .control-shell .control-sidebar { position: relative !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .control-sidebar .control-nav { overflow: visible !important; }
          .control-sidebar .control-nav-items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .control-sidebar .control-nav-item { min-height: 40px !important; padding: 5px 8px !important; font-size: 14px !important; gap: 8px !important; }
          .control-sidebar .control-module-icon { width: 28px !important; height: 28px !important; flex-basis: 28px !important; border-radius: 7px !important; }
          .control-sidebar .control-module-icon img { width: 22px !important; height: 22px !important; }
          .control-page-header h1 { font-size: 26px !important; }
          .control-page-description { font-size: 14px !important; }
          .control-page-actions a, .control-page-actions button { min-height: 40px !important; font-size: 14px !important; }
          .control-sidebar .control-brand { max-width: 220px; }
          .control-main-content { padding: 12px !important; }
          .control-main { min-height: 0 !important; }
        }
      `}</style>
    </div>
    </CompanyScope>
  );
}
