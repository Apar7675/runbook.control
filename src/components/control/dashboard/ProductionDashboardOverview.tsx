import React from "react";
import Link from "next/link";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip from "@/components/control/ControlStatusChip";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import { orderProductionAlerts, type ProductionDashboardModel } from "@/components/control/dashboard/ProductionDashboardModel";

export function ProductionDashboardEmpty() {
  return <div className="production-dashboard-empty">
    <ControlPageHeader compact title="RunBook Control" description="No shop connected yet." actions={<ControlActionLink href="/shops">Open Shop Setup</ControlActionLink>} />
    <ControlPanel title="No shop connected yet"><p>Create a shop first, then add people, register devices, and confirm billing access.</p><Link href="/shops">Go to Shop</Link></ControlPanel>
  </div>;
}

export default function ProductionDashboardOverview({ model }: { model: ProductionDashboardModel }) {
  const alerts = orderProductionAlerts(model.alerts);
  const alertRow = (item: typeof alerts[number], full: boolean) => <div className="dashboard-alert" key={item.key} data-priority={item.priority}>
    <ControlStatusChip label={item.priority === "high" ? "High" : item.priority === "medium" ? "Medium" : "Low"} tone={item.tone} />
    <div><strong>{item.title}</strong><div className="dashboard-muted">{item.scope}</div>{full ? <p>{item.reason}</p> : null}</div>
    <Link href={item.href} aria-label={`${item.cta} for ${item.scope}`}>{item.cta}</Link>
  </div>;
  return <div className="production-dashboard">
    <ControlPageHeader compact title="Command Center" description={`${model.shopName} — primary shop snapshot`} actions={<ControlActionLink href="/dashboard">Refresh</ControlActionLink>} />
    <div className="dashboard-metrics" aria-label="Priority metrics">{model.metrics.map((metric) => <ControlMetricCard key={metric.label} {...metric} compact />)}</div>
    <div className="dashboard-summary" aria-label="Overview counts">{model.summary.map((item) => <Link key={item.label} href={item.href}><strong>{item.value}</strong> {item.label}</Link>)}</div>
    <div className="dashboard-middle">
      <ControlPanel title={`Needs attention (${alerts.length})`} padding={12}>
        {alerts.length ? <>
          <div>{alerts.slice(0, 4).map((item) => alertRow(item, false))}</div>
          <div className="dashboard-muted">Showing {Math.min(4, alerts.length)} of {alerts.length} — highest priority first</div>
          <details><summary>Show all {alerts.length} alerts</summary>{alerts.map((item) => alertRow(item, true))}</details>
        </> : <p className="dashboard-empty">No action items were returned for this shop snapshot.</p>}
      </ControlPanel>
      <ControlPanel title="Access and device snapshot" padding={12} actions={<Link href="/status">View status</Link>}>
        <div>{model.health.map((row) => <div key={row.service} className="dashboard-health"><div>{row.service}<span className="dashboard-muted dashboard-health-detail">{row.detail}</span></div><ControlStatusChip label={row.status} tone={row.tone} /></div>)}</div>
      </ControlPanel>
    </div>
    <ControlPanel title="Recent activity" padding={12} actions={<Link href="/audit">Open audit log</Link>}>
      <p className="dashboard-empty"><strong>{model.activityCount}</strong> recent audit events in the primary shop snapshot. Event details and timestamps are not included; open the audit log to review them.</p>
    </ControlPanel>
    <div className="dashboard-shortcuts">{model.shortcuts.map((item) => <Link key={item.title} className="dashboard-shortcut" href={item.href}><strong>{item.title}</strong><span>{item.detail}</span></Link>)}</div>
    <details className="dashboard-source-details"><summary>Shop actions and snapshot details</summary>
      <div className="dashboard-platform-counts"><ControlActionLink href="/people">Add Employee</ControlActionLink><ControlActionLink href="/devices">Register Device</ControlActionLink></div>
      <p>Metrics apply to {model.shopName}. Timeclock review counts and individual audit events are not available in this overview. Access status does not confirm a live connection.</p>
      <p>Next billing date: {model.billingDateLabel}{model.trialDateLabel ? ` · Trial ends: ${model.trialDateLabel}` : ""}</p>
      {model.isPlatformAdmin && model.platform ? <div className="dashboard-platform-counts"><span>Managed shops: {model.platform.manageableShopCount}</span><span>All shops: {model.platform.shopCount}</span><span>Employees: {model.platform.employeeCount}</span><span>Activity: {model.platform.auditCount}</span></div> : null}
    </details>
    <style>{`
      .production-dashboard { display:grid; grid-template-columns:minmax(0,1fr); min-width:0; gap:12px; font-size:13px; line-height:1.4; color:#F8FAFC; }
      .production-dashboard > * { min-width:0; }
      .production-dashboard > :first-child,.production-dashboard > :first-child > div { min-width:0; max-width:100%; overflow-wrap:anywhere; }
      .production-dashboard a { color:#C4B5FD; text-decoration:none; }
      .production-dashboard a:hover { text-decoration:underline; }
      .production-dashboard :is(a,summary):focus-visible { outline:2px solid #C4B5FD; outline-offset:3px; border-radius:4px; }
      .production-dashboard :is(strong,p,span,time,summary),.dashboard-alert > div { overflow-wrap:anywhere; }
      .production-dashboard section { min-width:0; gap:8px !important; background:#101722 !important; align-content:start; border-color:#243247 !important; }
      .production-dashboard h2 { font-size:14px !important; }
      .dashboard-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
      .dashboard-metrics > a { min-width:0; }
      .dashboard-summary { display:flex; flex-wrap:wrap; gap:8px 22px; padding:2px 1px 10px; border-bottom:1px solid #243247; font-size:12px; }
      .dashboard-summary a { color:#94A3B8; }
      .dashboard-summary strong { color:#F8FAFC; margin-right:4px; }
      .dashboard-middle { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(0,1fr); gap:12px; align-items:start; }
      .dashboard-alert { display:grid; grid-template-columns:72px minmax(0,1fr) auto; gap:10px; padding:8px 0; border-top:1px solid #243247; align-items:center; }
      .dashboard-alert p { margin:4px 0; }
      .dashboard-alert > span { justify-self:start; }
      .dashboard-alert strong { font-weight:600; }
      .dashboard-muted { color:#94A3B8; font-size:12px; }
      .production-dashboard summary { cursor:pointer; color:#C4B5FD; padding:4px 0; font-size:12px; }
      .dashboard-health { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 0; border-top:1px solid #243247; }
      .dashboard-health > div { min-width:0; }
      .dashboard-health-detail { display:block; }
      .dashboard-shortcuts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
      .dashboard-shortcut { display:grid; gap:3px; padding:10px 12px; min-width:0; border:1px solid #243247; border-radius:9px; background:#101722; }
      .dashboard-shortcut strong { color:#CBD5E1; }
      .dashboard-shortcut span { color:#94A3B8; font-size:12px; }
      .dashboard-empty { margin:0; color:#94A3B8; padding:8px 0; }
      .dashboard-source-details { color:#94A3B8; font-size:12px; }
      .dashboard-platform-counts { display:flex; flex-wrap:wrap; gap:10px 20px; }
      @media(max-width:1199px) { .dashboard-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .dashboard-middle { grid-template-columns:1fr; } }
      @media(max-width:600px) { .dashboard-metrics,.dashboard-shortcuts { grid-template-columns:1fr; } .dashboard-alert { grid-template-columns:72px minmax(0,1fr); } .dashboard-alert > a { grid-column:2; justify-self:start; } .dashboard-health { flex-wrap:wrap; } }
    `}</style>
  </div>;
}
