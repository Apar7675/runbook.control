import React from "react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import DataTable from "@/components/DataTable";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rbListMyShops } from "@/lib/rb";
import { theme } from "@/lib/ui/theme";

function label(action: string) {
  switch (action) {
    case "shop.created": return "Shop created";
    case "member.added": return "Member added";
    case "member.removed": return "Member removed";
    case "device.created": return "Device created";
    case "device.activated": return "Device activated";
    case "device.disabled": return "Device disabled";
    case "update.package_uploaded": return "Update uploaded";
    case "policy.changed": return "Update policy changed";
    case "support_bundle.uploaded": return "Support bundle uploaded";
    default: return action;
  }
}

function entityHref(r: any) {
  const t = String(r.entity_type ?? "");
  const id = String(r.entity_id ?? "");
  if (!t) return null;

  if (t === "shop" && r.shop_id) return `/shops/${r.shop_id}`;
  if (t === "device" && id) return `/devices/${id}`;
  if (t === "update") return `/updates/packages`;
  if (t === "policy" && r.shop_id) return `/updates?shop=${r.shop_id}`;
  if (t === "support_bundle") return `/support`;
  if (t === "member" && r.shop_id) return `/shops/${r.shop_id}/members`;

  return null;
}

function PolicyDiff({ details }: { details: any }) {
  const before = details?.before ?? null;
  const after = details?.after ?? null;

  if (!after) return <span style={{ opacity: 0.7 }}>—</span>;

  const row = (k: string) => {
    const b = before ? (before[k] ?? "—") : "—";
    const a = after[k] ?? "—";
    const changed = b !== a;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 28px 1fr", gap: 8, fontSize: 12 }}>
        <span style={{ opacity: 0.75 }}>{k}</span>
        <code style={{ opacity: 0.75 }}>{String(b)}</code>
        <span style={{ opacity: 0.7 }}>→</span>
        <code style={{ color: changed ? theme.text.accent : theme.text.primary, opacity: 0.95 }}>{String(a)}</code>
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {row("channel")}
      {row("min_version")}
      {row("pinned_version")}
    </div>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { shop?: string; q?: string; page?: string };
}) {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();

  const shops = await rbListMyShops();

  const shopFilter = (searchParams.shop ?? "").trim();
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const PAGE_SIZE = 50;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("rb_audit")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (shopFilter) query = query.eq("shop_id", shopFilter);

  if (q) {
    const like = `%${q}%`;
    query = query.or(`action.ilike.${like},entity_type.ilike.${like},actor_kind.ilike.${like}`);
  }

  const { data: rows, count, error } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Resolve actor emails
  const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_user_id).filter(Boolean)));
  const emailById = new Map<string, string>();

  for (const uid of userIds) {
    try {
      const res = await admin.auth.admin.getUserById(uid);
      const em = res.data.user?.email ?? "";
      if (em) emailById.set(uid, em);
    } catch {}
  }

  const exportUrl = `/api/audit/export?shop=${encodeURIComponent(shopFilter)}&q=${encodeURIComponent(q)}&limit=5000`;

  const navLink = (p: number, text: string) => {
    const sp = new URLSearchParams();
    if (shopFilter) sp.set("shop", shopFilter);
    if (q) sp.set("q", q);
    sp.set("page", String(p));
    return (
      <Link
        href={`/audit?${sp.toString()}`}
        style={{ textDecoration: "none", color: theme.text.primary, opacity: 0.9, fontWeight: 800 }}
      >
        {text}
      </Link>
    );
  };

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1500 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Audit Log</h1>
        <a
          href={exportUrl}
          style={{
            textDecoration: "none",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.05)",
            color: theme.text.primary,
            fontWeight: 900,
          }}
        >
          Export CSV
        </a>
      </div>

      <GlassCard title="Filters">
        <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select name="shop" defaultValue={shopFilter} style={{ padding: 10, borderRadius: 12, minWidth: 260 }}>
            <option value="">All shops</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <input
            name="q"
            defaultValue={q}
            placeholder="search action/entity/actor (e.g. device, policy, uploaded)"
            style={{ padding: 10, borderRadius: 12, minWidth: 420 }}
          />

          <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
            Apply
          </button>

          <input type="hidden" name="page" value="1" />
        </form>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Showing page <b>{page}</b> of <b>{totalPages}</b> ({total} total)
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 14 }}>
          {page > 1 ? navLink(page - 1, "← Prev") : <span style={{ opacity: 0.35 }}>← Prev</span>}
          {page < totalPages ? navLink(page + 1, "Next →") : <span style={{ opacity: 0.35 }}>Next →</span>}
        </div>
      </GlassCard>

      <GlassCard title={`Rows (${rows?.length ?? 0})`}>
        <DataTable
          rows={rows ?? []}
          empty="No audit events found."
          columns={[
            {
              key: "time",
              header: "Time",
              width: "180px",
              render: (r: any) => <span style={{ opacity: 0.85 }}>{new Date(r.created_at).toLocaleString()}</span>,
            },
            {
              key: "action",
              header: "Action",
              width: "240px",
              render: (r: any) => (
                <span style={{ fontWeight: 900, color: theme.text.accent }}>
                  {label(r.action)}
                </span>
              ),
            },
            {
              key: "shop",
              header: "Shop",
              width: "240px",
              render: (r: any) =>
                r.shop_id ? (
                  <Link href={`/shops/${r.shop_id}`} style={{ textDecoration: "none", color: theme.text.primary, opacity: 0.9 }}>
                    <code style={{ opacity: 0.75 }}>{String(r.shop_id).slice(0, 8)}…</code>
                  </Link>
                ) : (
                  <span style={{ opacity: 0.5 }}>—</span>
                ),
            },
            {
              key: "actor",
              header: "Actor",
              width: "260px",
              render: (r: any) => {
                if (r.actor_kind === "device") return <span style={{ fontWeight: 800 }}>device</span>;
                const email = r.actor_user_id ? emailById.get(r.actor_user_id) : null;
                return (
                  <div style={{ display: "grid" }}>
                    <span style={{ fontWeight: 900 }}>{email ?? r.actor_kind}</span>
                    {r.actor_user_id ? <span style={{ fontSize: 12, opacity: 0.6 }}>{r.actor_user_id.slice(0, 8)}…</span> : null}
                  </div>
                );
              },
            },
            {
              key: "entity",
              header: "Entity",
              width: "260px",
              render: (r: any) => {
                const href = entityHref(r);
                const labelText = r.entity_type ? String(r.entity_type) : "—";
                const idText = r.entity_id ? String(r.entity_id).slice(0, 8) + "…" : "";

                const inner = (
                  <div style={{ display: "grid" }}>
                    <span style={{ fontWeight: 900 }}>{labelText}</span>
                    {idText ? <span style={{ fontSize: 12, opacity: 0.6 }}>{idText}</span> : null}
                  </div>
                );

                return href ? (
                  <Link href={href} style={{ textDecoration: "none", color: theme.text.primary, opacity: 0.95 }}>
                    {inner}
                  </Link>
                ) : (
                  inner
                );
              },
            },
            {
              key: "details",
              header: "Details",
              render: (r: any) => {
                if (r.action === "policy.changed") {
                  return <PolicyDiff details={r.details} />;
                }
                return (
                  <code style={{ opacity: 0.75, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(r.details ?? {})}
                  </code>
                );
              },
            },
          ]}
        />
      </GlassCard>
    </div>
  );
}
