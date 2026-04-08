import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { ActionLink, EmptyState, PageHeader, SectionBlock, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  created_at: string;
  shop_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  meta: any;
};

function relativeDayLabel(value: string) {
  const now = new Date();
  const date = new Date(value);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const deltaDays = Math.round((start - target) / (24 * 60 * 60 * 1000));
  if (deltaDays <= 0) return "Today";
  if (deltaDays === 1) return "Recent";
  return "Earlier";
}

function buildUrl(base: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
}

async function getBaseUrlFromHeaders() {
  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function fetchAudit(searchParams: URLSearchParams) {
  const baseUrl = await getBaseUrlFromHeaders();
  const cookie = (await headers()).get("cookie") ?? "";
  const response = await fetch(buildUrl(`${baseUrl}/api/audit/list`, searchParams), {
    cache: "no-store",
    headers: { cookie },
  });
  const payload = await response.json().catch(() => ({ ok: false, error: "Unable to parse audit response." }));
  return { ok: response.ok, payload };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = new URLSearchParams();
  const limit = typeof params.limit === "string" ? params.limit : "120";
  const action = typeof params.action === "string" ? params.action : "";
  const actorEmail = typeof params.actor_email === "string" ? params.actor_email : "";
  const shopId = typeof params.shop_id === "string" ? params.shop_id : "";

  filters.set("limit", limit);
  if (action) filters.set("action", action);
  if (actorEmail) filters.set("actor_email", actorEmail);
  if (shopId) filters.set("shop_id", shopId);

  const { ok, payload } = await fetchAudit(filters);
  const rows: AuditRow[] = payload?.ok ? payload.rows ?? [] : [];

  const groups = new Map<string, AuditRow[]>();
  for (const row of rows) {
    const key = relativeDayLabel(row.created_at);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  return (
    <div className="rb-page">
      <PageHeader eyebrow="Audit / Activity" title="Activity" description="Review important admin actions and warnings without falling back to raw mixed-history tables." actions={<ActionLink href={buildUrl("/api/audit/export", filters)} tone="primary">Export Activity</ActionLink>} />

      <SectionBlock title="Filters" description="Use the shared form language so filtering feels like part of the same system.">
        <form className="rb-formGrid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <div className="rb-field">
            <label className="rb-fieldLabel">Action</label>
            <input className="rb-input" name="action" defaultValue={action} placeholder="Action contains" />
          </div>
          <div className="rb-field">
            <label className="rb-fieldLabel">Actor Email</label>
            <input className="rb-input" name="actor_email" defaultValue={actorEmail} placeholder="Actor email" />
          </div>
          <div className="rb-field">
            <label className="rb-fieldLabel">Shop Id</label>
            <input className="rb-input" name="shop_id" defaultValue={shopId} placeholder="Shop id" />
          </div>
          <div className="rb-field">
            <label className="rb-fieldLabel">Limit</label>
            <input className="rb-input" name="limit" defaultValue={limit} placeholder="Limit" />
          </div>
          <div className="rb-inlineRow" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="rb-button rb-button--primary">Apply</button>
            <ActionLink href="/audit">Clear Filters</ActionLink>
          </div>
        </form>
      </SectionBlock>

      {!ok || !payload?.ok ? (
        <EmptyState title="Unable to load activity" description={payload?.error ?? "The activity feed could not be loaded."} />
      ) : rows.length === 0 ? (
        <EmptyState title="No activity found" description="Nothing matched the current filters. Try a broader search or return later after more activity occurs." />
      ) : (
        Array.from(groups.entries()).map(([label, groupRows]) => (
          <SectionBlock key={label} title={label} description={`${groupRows.length} event${groupRows.length === 1 ? "" : "s"} in this section.`}>
            <div className="rb-listRows">
              {groupRows.map((row) => {
                const severity =
                  /failed|error|blocked|restricted/i.test(row.action) ? "Action Needed" : /delete|revoke|disable/i.test(row.action) ? "Warning" : "Healthy";
                return (
                  <div key={row.id} className="rb-deviceRow">
                    <div className="rb-rowBetween" style={{ alignItems: "center" }}>
                      <div className="rb-chipRow">
                        <div style={{ fontWeight: 900, fontSize: 16 }}>{row.action}</div>
                        <StatusBadge label={severity} tone={toneFromStatus(severity)} />
                      </div>
                      <div className="rb-fine">{formatDateTime(row.created_at)}</div>
                    </div>

                    <div className="rb-pageCopy">
                      Actor: <strong>{row.actor_email ?? row.actor_user_id ?? "System"}</strong>
                      {" | "}
                      Target: <strong>{row.target_type ?? "event"} {row.target_id ?? ""}</strong>
                    </div>

                    {row.shop_id ? (
                      <div className="rb-inlineRow">
                        <Link href={`/shops/${row.shop_id}`} className="rb-buttonLink rb-buttonLink--ghost">
                          Open related shop
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SectionBlock>
        ))
      )}
    </div>
  );
}
