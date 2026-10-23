import React from "react";
import Link from "next/link";
import { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlMetricCard from "@/components/control/ControlMetricCard";
import ControlPanel from "@/components/control/ControlPanel";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlStatusChip, { type ControlStatusTone } from "@/components/control/ControlStatusChip";
import { formatDateTime } from "@/lib/ui/dates";

export type AlertRow = {
  key: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  type: string;
  scope: string;
  detail: string;
  source: string;
  href: string;
};

export type ActivityRow = {
  id: string;
  action: string;
  actor: string;
  scope: string;
  created_at: string | null;
};

export type HealthRow = { service: string; status: string; tone: ControlStatusTone; detail: string };
type Metric = { label: string; value: string; meta?: string; tone?: ControlStatusTone; href: string };
type Shortcut = { title: string; href: string; detail: string; latest: string };

export type DashboardProps = {
  metrics: Metric[];
  summary: Array<{ label: string; value: string; href: string }>;
  alerts: AlertRow[];
  healthRows: HealthRow[];
  recentActivity: ActivityRow[];
  shortcuts: Shortcut[];
};

export function orderAlerts(alerts: AlertRow[]): AlertRow[] {
  const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  // Array.sort is stable: preserve generation order within each priority.
  return [...alerts].sort((a, b) => rank[a.priority] - rank[b.priority]);
}

export function limitedCount(count: number, cap: number) {
  return `${count}${count >= cap ? "+" : ""}`;
}

function dateLabel(value: string | null) {
  if (!value) return "Not available";
  try { return formatDateTime(value); } catch { return value; }
}

function Alert({ alert, full = false }: { alert: AlertRow; full?: boolean }) {
  return (
    <div className="dashboard-alert" data-alert-key={alert.key} data-priority={alert.priority}>
      <ControlStatusChip label={alert.priority} tone={alert.priority === "Critical" || alert.priority === "High" ? "danger" : alert.priority === "Medium" ? "warning" : "info"} />
      <div>
        <strong>{alert.type}</strong>
        <div className="dashboard-muted">{alert.scope}</div>
        {full ? <><div>{alert.detail}</div><div className="dashboard-muted">Source: {alert.source}</div></> : null}
      </div>
      <Link href={alert.href} aria-label={`Review ${alert.type} for ${alert.scope}`}>Review</Link>
    </div>
  );
}

/** Presentation only. Server-owned data and permission decisions enter through props. */
export default function ControlDashboard({ metrics, summary, alerts, healthRows, recentActivity, shortcuts }: DashboardProps) {
  const ordered = orderAlerts(alerts);
  return (
    <div className="control-dashboard">
      <ControlPageHeader compact title="Command Center" description="Access, devices and activity at a glance." actions={<ControlActionLink href="/dashboard">Refresh</ControlActionLink>} />
      <div className="dashboard-metrics" aria-label="Priority metrics">
        {metrics.map((metric) => <ControlMetricCard key={metric.label} {...metric} compact />)}
      </div>
      <div className="dashboard-summary" aria-label="Overview counts">
        {summary.map((item) => <Link key={item.label} href={item.href}><strong>{item.value}</strong> {item.label}</Link>)}
      </div>
      <div className="dashboard-middle">
        <ControlPanel title={`Needs attention (${ordered.length})`} padding={10} surface="work">
          {ordered.length === 0 ? <p className="dashboard-empty">No active issues in current scope.</p> : <>
            <div className="dashboard-preview">{ordered.slice(0, 4).map((alert) => <Alert key={alert.key} alert={alert} />)}</div>
            <div className="dashboard-muted">Showing {Math.min(4, ordered.length)} of {ordered.length} · Highest priority first</div>
            <details className="dashboard-all-alerts">
              <summary>Show all {ordered.length} alerts</summary>
              <div className="dashboard-full-alerts">{ordered.map((alert) => <Alert key={alert.key} alert={alert} full />)}</div>
            </details>
          </>}
        </ControlPanel>
        <ControlPanel title="System health" padding={10} actions={<Link href="/status">View status</Link>}>
          <div>{healthRows.map((row) => <div className="dashboard-health" key={row.service}>
            <div>{row.service}<span className="dashboard-health-detail dashboard-muted">{row.detail}</span></div>
            <ControlStatusChip label={row.status} tone={row.tone} />
          </div>)}</div>
        </ControlPanel>
      </div>
      <ControlPanel title="Recent activity" padding={10} actions={<Link href="/audit">Open audit log</Link>}>
        {recentActivity.length === 0 ? <p className="dashboard-empty">No recent audit activity in current scope.</p> :
          <div className="dashboard-activity">{recentActivity.slice(0, 3).map((row) => <div key={row.id}>
            <strong>{row.action}</strong>
            <div className="dashboard-muted">{row.actor} · {row.scope || "System scope"}</div>
            <time className="dashboard-muted" dateTime={row.created_at ?? undefined}>{dateLabel(row.created_at)}</time>
          </div>)}</div>}
      </ControlPanel>
      <div className="dashboard-shortcuts">
        {shortcuts.map((item) => <Link className="dashboard-shortcut" key={item.title} href={item.href}>
          <strong>{item.title}</strong><span>{item.detail}</span><span>{item.latest}</span>
        </Link>)}
      </div>
      <style>{`
        .control-dashboard { display:grid; gap:16px; font-size:16px; line-height:1.5; color:#12234A; }
        .control-dashboard *, .control-dashboard *::before, .control-dashboard *::after { box-sizing:border-box; }
        .control-dashboard a { color:#0755ff; text-decoration:none; }
        .control-dashboard a:hover { text-decoration:underline; }
        .control-dashboard :is(a,summary):focus-visible { outline:2px solid #0755ff; outline-offset:3px; border-radius:4px; }
        .control-dashboard :is(strong,p,span,time,summary), .dashboard-alert > div { overflow-wrap:anywhere; }
        .dashboard-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
        .dashboard-summary { display:flex; flex-wrap:wrap; gap:10px 24px; padding:12px 16px; border:1.25px solid #5E7DA5; border-radius:9px; background:#DFECFD; font-size:15px; }
        .dashboard-summary a { color:#52617B; }
        .dashboard-summary strong { color:#12234A; margin-right:4px; }
        .dashboard-middle { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(0,1fr); gap:18px; align-items:start; }
        .control-dashboard section { min-width:0; gap:10px !important; align-content:start; }
        .control-dashboard h2 { font-size:20px !important; }
        .dashboard-alert { display:grid; grid-template-columns:94px minmax(0,1fr) auto; gap:12px; padding:10px 0; border-top:1px solid #B3C6E2; align-items:center; }
        .dashboard-alert > span { justify-self:start; }
        .dashboard-alert strong { font-weight:600; }
        .dashboard-muted { color:#52617B; font-size:14px; }
        .dashboard-all-alerts summary { cursor:pointer; color:#0755ff; padding:8px 0; font-size:14px; }
        .dashboard-full-alerts { margin-top:8px; }
        .dashboard-health { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 0; border-top:1px solid #B3C6E2; }
        .dashboard-health > div { min-width:0; }
        .dashboard-health-detail { display:block; }
        .dashboard-activity { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
        .dashboard-activity > div { min-width:0; }
        .dashboard-activity strong,.dashboard-activity time { display:block; }
        .dashboard-shortcuts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
        .dashboard-shortcut { display:grid; gap:5px; padding:14px 16px; min-width:0; border:1.25px solid #5E7DA5; border-radius:9px; background:#DFECFD; }
        .dashboard-shortcut strong { color:#12234A; }
        .dashboard-shortcut span { color:#52617B; font-size:14px; }
        .dashboard-empty { margin:0; color:#52617B; padding:8px 0; }
        @media(max-width:1199px) { .dashboard-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .dashboard-middle { grid-template-columns:1fr; } }
        @media(max-width:600px) { .dashboard-metrics,.dashboard-shortcuts,.dashboard-activity { grid-template-columns:1fr; } .dashboard-alert { grid-template-columns:94px minmax(0,1fr); } .dashboard-alert > a { grid-column:2; justify-self:start; } .dashboard-health { flex-wrap:wrap; } }
      `}</style>
    </div>
  );
}
