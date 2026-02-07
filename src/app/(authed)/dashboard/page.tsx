import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import GlassCard from "@/components/GlassCard";
import SetupChecklist from "@/components/SetupChecklist";
import DismissNoviceButton from "@/components/DismissNoviceButton";
import { rbListMyShops, rbGetUpdatePolicy } from "@/lib/rb";

export const dynamic = "force-dynamic";

function CardLink({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 16,
        padding: 14,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{desc}</div>
      <div style={{ marginTop: 6, fontWeight: 900, opacity: 0.85 }}>Open →</div>
    </Link>
  );
}

function Tile({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 14,
        padding: 12,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </div>
      <div style={{ fontSize: 12, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {subtitle}
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  const shops = await rbListMyShops();

  // prefs
  const { data: prefs } = await supabase
    .from("rb_user_prefs")
    .select("*")
    .maybeSingle();

  const noviceDismissed = Boolean((prefs as any)?.novice_dismissed);

  // recent devices (global)
  const { data: recentDevices, error: devErr } = await supabase
    .from("rb_devices")
    .select("id, shop_id, name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(6);

  if (devErr) throw new Error(devErr.message);

  // Novice checklist logic: show when exactly one shop and not dismissed
  let noviceShop: any | null = null;
  let membersCount = 0;
  let devicesCount = 0;
  let policy: any | null = null;

  if (shops.length === 1) {
    noviceShop = shops[0];

    const { count: mCount } = await supabase
      .from("rb_shop_members")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", noviceShop.id);

    membersCount = mCount ?? 0;

    const { count: dCount } = await supabase
      .from("rb_devices")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", noviceShop.id);

    devicesCount = dCount ?? 0;

    policy = await rbGetUpdatePolicy(noviceShop.id);
  }

  const wouldShowNovice =
    !!noviceShop &&
    (devicesCount === 0 ||
      !policy ||
      (!policy.min_version && !policy.pinned_version && policy.channel === "stable"));

  const showNovice = wouldShowNovice && !noviceDismissed;

  const checklistItems = noviceShop
    ? [
        {
          key: "members",
          title: "Add members (optional)",
          done: membersCount > 1,
          hint: "Invite another admin or member so you’re not the only user with access.",
          ctaLabel: "Manage Members",
          ctaHref: `/shops/${noviceShop.id}/members`,
        },
        {
          key: "device",
          title: "Create a device",
          done: devicesCount > 0,
          hint: "Devices are PCs/tablets that will check RunBook.Control for updates and policy.",
          ctaLabel: "Create Device",
          ctaHref: `/devices?shop=${noviceShop.id}`,
        },
        {
          key: "policy",
          title: "Set update policy",
          done: !!policy && (policy.channel !== "stable" || policy.min_version || policy.pinned_version),
          hint: "Stable/beta controls what builds devices receive. Pin forces a specific version for this shop.",
          ctaLabel: "Edit Policy",
          ctaHref: `/shops/${noviceShop.id}#policy`,
        },
        {
          key: "audit",
          title: "Verify activity in audit",
          done: true,
          hint: "Audit is your truth log: who changed what, when.",
          ctaLabel: "View Audit",
          ctaHref: `/audit?shop=${noviceShop.id}`,
        },
      ]
    : [];

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Dashboard</h1>

      <GlassCard title="Signed In">
        <div style={{ fontSize: 16, fontWeight: 800 }}>{data.user?.email}</div>
      </GlassCard>

      {showNovice ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              Beginner help is on for this account.
            </div>
            {/* @ts-expect-error server->client */}
            <DismissNoviceButton />
          </div>

          <SetupChecklist
            title="Getting Started"
            subtitle={`Bring "${noviceShop.name}" online safely.`}
            items={checklistItems}
          />
        </div>
      ) : null}

      {/* RECENT TILES */}
      <GlassCard title="Recent">
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, letterSpacing: 0.4 }}>
              SHOPS
            </div>

            {shops.length === 0 ? (
              <div style={{ opacity: 0.75 }}>
                No shops yet.{" "}
                <Link href="/shops/new" style={{ textDecoration: "none" }}>
                  Create your first shop →
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {shops.slice(0, 6).map((s) => (
                  <Tile
                    key={s.id}
                    href={`/shops/${s.id}`}
                    title={s.name}
                    subtitle={`Shop ID: ${String(s.id).slice(0, 8)}…`}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, letterSpacing: 0.4 }}>
              DEVICES
            </div>

            {(recentDevices ?? []).length === 0 ? (
              <div style={{ opacity: 0.75 }}>
                No devices yet.{" "}
                <Link href="/devices" style={{ textDecoration: "none" }}>
                  Register a device →
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {(recentDevices ?? []).map((d: any) => (
                  <Tile
                    key={d.id}
                    href={`/devices/${d.id}`}
                    title={d.name}
                    subtitle={`Status: ${d.status} • ${String(d.id).slice(0, 8)}…`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* ALL PAGES */}
      <GlassCard title="All Pages">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          <CardLink title="Shops" desc="Create/manage shops (your top-level container)." href="/shops" />
          <CardLink title="Create Shop" desc="Start a new shop (bootstrap admin + policy)." href="/shops/new" />
          <CardLink title="Devices" desc="Register devices, tokens, disable/delete." href="/devices" />
          <CardLink title="Updates" desc="Set policy per shop (stable/beta/min/pinned)." href="/updates" />
          <CardLink title="Update Packages" desc="Upload releases for stable/beta channels." href="/updates/packages" />
          <CardLink title="Support Bundles" desc="Upload/download support bundles per shop." href="/support" />
          <CardLink title="Audit Log" desc="Everything that happened (filter + export)." href="/audit" />
          <CardLink title="Settings" desc="Preferences, novice mode toggle." href="/settings" />
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
          Detail pages like <code>/shops/&lt;id&gt;</code> and <code>/devices/&lt;id&gt;</code> open from the tiles above.
        </div>
      </GlassCard>
    </div>
  );
}
