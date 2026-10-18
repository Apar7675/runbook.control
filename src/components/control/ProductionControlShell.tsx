import React from "react";
import Link from "next/link";
import { controlTheme as t } from "@/components/control/controlTheme";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import type { ConnectionStatusItem } from "@/lib/connection-status";

const unavailableTools = ["Workstations", "Mobile Access", "Timeclock Review", "Software Updates"];

function statusTone(health: ConnectionStatusItem["health"]): ControlStatusTone {
  return health === "Healthy" ? "success" : health === "Degraded" ? "warning" : "danger";
}

/** Layout only. The production parent supplies its original role-aware navigation and session controls. */
export default function ProductionControlShell({ email, isPlatformAdmin, statuses, navigation, sessionControls, children }: {
  email: string;
  isPlatformAdmin: boolean;
  statuses: ConnectionStatusItem[];
  navigation: React.ReactNode;
  sessionControls: React.ReactNode;
  children: React.ReactNode;
}) {
  return <div className="production-control-canvas" style={{ minHeight: "100vh", background: t.color.appBg, color: t.color.text }}>
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 16% 18%, rgba(124,58,237,.18), transparent 26%), radial-gradient(circle at 82% 0%, rgba(6,182,212,.12), transparent 24%), linear-gradient(180deg, rgba(7,10,15,.2), rgba(7,10,15,.92))" }} />
    <div className="production-control-shell">
      <aside className="production-control-sidebar">
        <Link className="production-brand" href="/dashboard">RunBook <span>Control</span></Link>
        <div className="production-header-statuses" aria-label="Current session and data status">
          {statuses.map((status) => <span key={status.key} title={`${status.health}: ${status.reason}`}>
            <ControlStatusChip label={status.label} tone={statusTone(status.health)} />
          </span>)}
        </div>
        <div className="production-navigation">
          {navigation}
          {isPlatformAdmin ? <details className="production-unavailable-tools">
            <summary>Additional tools</summary>
            <p>These destinations are not available in this release.</p>
            {unavailableTools.map((label) => <span key={label} aria-disabled="true">{label} <small>Unavailable</small></span>)}
          </details> : null}
        </div>
        <div className="production-account">
          <strong>{email || "Signed-in user"}</strong>
          <span>{isPlatformAdmin ? "Platform Admin" : "Shop Admin"}</span>
          <details>
            <summary>Session and account</summary>
            <div className="production-account-details">
              {statuses.map((status) => <div key={status.key}><strong>{status.label}: {status.health}</strong><span>{status.reason}</span></div>)}
              {sessionControls}
              <Link href="/status">Status</Link>
            </div>
          </details>
        </div>
      </aside>
      <main><div className="production-main-content">{children}</div></main>
    </div>
    <style>{`
      .production-control-canvas *,.production-control-canvas *::before,.production-control-canvas *::after { box-sizing:border-box; }
      .production-control-shell { position:relative; z-index:1; display:grid; grid-template-columns:232px minmax(0,1fr); min-height:100vh; }
      .production-control-sidebar { display:grid; grid-template-rows:auto auto minmax(0,1fr) auto; gap:12px; height:100dvh; padding:18px 14px 14px; border-right:1px solid #243247; background:linear-gradient(180deg,rgba(11,16,24,.98),rgba(7,10,15,.98)); position:sticky; top:0; overflow-y:auto; }
      .production-brand { color:#F8FAFC; font-size:22px; font-weight:800; letter-spacing:-.8px; text-decoration:none; }
      .production-brand span { color:#A78BFA; }
      .production-header-statuses { display:flex; flex-wrap:wrap; gap:7px; }
      .production-navigation { overflow-y:auto; min-height:0; padding:3px; margin:-3px; }
      .production-navigation nav { gap:5px !important; }
      .production-navigation nav > div:first-child { display:none !important; }
      .production-navigation nav > div { gap:3px !important; }
      .production-navigation nav > div > div:last-child { gap:3px !important; padding:0 !important; border:0 !important; background:none !important; }
      .production-navigation .rbNavItem { min-height:32px; padding:3px 8px !important; grid-template-columns:18px minmax(0,1fr) !important; gap:7px !important; border-color:transparent !important; background:transparent !important; box-shadow:none !important; align-items:center !important; }
      .production-navigation .rbNavItemSelected { background:linear-gradient(90deg,rgba(124,58,237,.22),rgba(37,99,235,.10)) !important; border-color:rgba(124,58,237,.34) !important; }
      .production-navigation .rbNavIcon { width:18px !important; height:18px !important; border:0 !important; background:none !important; box-shadow:none !important; }
      .production-navigation .rbNavItem > span > span:first-child { font-size:12.5px !important; font-weight:600 !important; }
      .production-navigation .rbNavDetail { display:none; }
      .production-control-sidebar a:focus-visible,.production-control-sidebar summary:focus-visible { outline:2px solid #C4B5FD; outline-offset:-2px; }
      .production-control-sidebar a { overflow-wrap:anywhere; }
      .production-account { display:grid; gap:4px; padding-top:10px; border-top:1px solid #243247; font-size:12px; color:#94A3B8; overflow-wrap:anywhere; }
      .production-account > strong { color:#F8FAFC; font-size:12.5px; }
      .production-account summary,.production-unavailable-tools summary { cursor:pointer; padding:4px 0; color:#C4B5FD; }
      .production-account-details { display:grid; gap:10px; padding:8px 0; }
      .production-account-details > div { display:grid; gap:3px; }
      .production-account-details a { color:#C4B5FD; }
      .production-unavailable-tools { font-size:12px; color:#94A3B8; margin-top:8px; }
      .production-unavailable-tools p { margin:4px 0; }
      .production-unavailable-tools > span { display:block; padding:5px 0; }
      .production-unavailable-tools small { float:right; font-size:10px; }
      .production-control-shell > main { min-width:0; min-height:100vh; overflow:auto; }
      .production-main-content { max-width:${t.layout.contentMaxWidth}px; margin:0 auto; padding:18px; display:grid; gap:16px; }
      @media(max-width:1100px) { .production-control-shell { grid-template-columns:210px minmax(0,1fr); } }
      @media(max-width:900px) { .production-control-shell { grid-template-columns:1fr; } .production-control-sidebar { position:relative; height:auto; } .production-navigation { overflow:visible; } .production-navigation nav > div > div:last-child { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    `}</style>
  </div>;
}
