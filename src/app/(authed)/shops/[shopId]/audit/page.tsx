"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ActionLink, EmptyState, PageHeader, SectionBlock, StatusBadge, toneFromStatus } from "@/components/control/ui";
import { safeFetch } from "@/lib/http/safeFetch";
import { formatDateTime } from "@/lib/ui/dates";

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
};

type AuditResp = { ok: true; rows: AuditRow[] } | { ok?: false; error?: string };

export const dynamic = "force-dynamic";

export default function ShopAuditPage() {
  const params = useParams<{ shopId: string }>();
  const shopId = params.shopId;
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const response = await safeFetch<AuditResp>(`/api/audit/list?shop_id=${encodeURIComponent(shopId)}&limit=80`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok || !(response.data as any)?.ok) {
        setStatus(response.ok ? ((response.data as any)?.error ?? "Unable to load activity.") : `${response.status}: ${response.error}`);
        setLoading(false);
        return;
      }
      setRows((response.data as any).rows ?? []);
      setLoading(false);
    }

    load();
  }, [shopId]);

  return (
    <div className="rb-page">
      <PageHeader eyebrow="Activity" title="Shop Activity" description="Show recent events clearly so an admin can understand what changed without reading raw audit payloads." actions={<ActionLink href="/audit" tone="primary">Open Full Activity Feed</ActionLink>} />

      {status ? (
        <EmptyState title="Unable to load shop activity" description={status} />
      ) : loading ? (
        <SectionBlock title="Activity" description="Loading recent shop activity...">
          <div className="rb-fine">Loading...</div>
        </SectionBlock>
      ) : rows.length === 0 ? (
        <EmptyState title="No recent activity" description="Nothing recent was recorded for this shop yet." />
      ) : (
        <SectionBlock title="Recent Events" description="Keep the event wording readable and only surface what helps the admin.">
          <div className="rb-listRows">
            {rows.map((row) => {
              const severity =
                /failed|error|blocked|restricted/i.test(row.action) ? "Action Needed" : /delete|revoke|disable/i.test(row.action) ? "Warning" : "Healthy";
              return (
                <div key={row.id} className="rb-deviceRow">
                  <div className="rb-rowBetween" style={{ alignItems: "center" }}>
                    <div className="rb-chipRow">
                      <div style={{ fontWeight: 900 }}>{row.action}</div>
                      <StatusBadge label={severity} tone={toneFromStatus(severity)} />
                    </div>
                    <div className="rb-fine">{formatDateTime(row.created_at)}</div>
                  </div>
                  <div className="rb-pageCopy">
                    Actor: <strong>{row.actor_email ?? row.actor_user_id ?? "System"}</strong>
                    {" | "}
                    Target: <strong>{row.target_type ?? "event"} {row.target_id ?? ""}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionBlock>
      )}
    </div>
  );
}
