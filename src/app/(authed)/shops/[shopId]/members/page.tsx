import React from "react";
import GlassCard from "@/components/GlassCard";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rbGetShop } from "@/lib/rb";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function TabBar({ shopId, active }: { shopId: string; active: "overview" | "devices" | "admins" | "audit" }) {
  const item = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: isActive ? "rgba(139,140,255,0.16)" : "rgba(255,255,255,0.04)",
        fontWeight: 900,
        color: "inherit",
        opacity: isActive ? 1 : 0.85,
      }}
    >
      {label}
    </Link>
  );

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {item(`/shops/${shopId}`, "Overview", active === "overview")}
      {item(`/shops/${shopId}/devices`, "Devices", active === "devices")}
      {item(`/shops/${shopId}/members`, "Admins", active === "admins")}
      {item(`/audit?shop=${shopId}`, "Audit", active === "audit")}
    </div>
  );
}

async function inviteAndAddAdmin(formData: FormData) {
  "use server";

  const shopId = String(formData.get("shopId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(formData.get("role") ?? "member").trim();
  const role = roleRaw === "admin" ? "admin" : "member";

  if (!isUuid(shopId) || !email) return;

  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user?.id) throw new Error("Not authenticated.");

  const admin = supabaseAdmin();

  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  let userId = created.data.user?.id ?? null;

  if (!userId) {
    const invited = await admin.auth.admin.inviteUserByEmail(email);
    userId = invited.data.user?.id ?? null;
    if (!userId) throw new Error(invited.error?.message ?? "Failed to create/invite user.");
  }

  const { error } = await supabase.from("rb_shop_members").insert({ shop_id: shopId, user_id: userId, role });
  if (error) throw new Error(error.message);

  revalidatePath(`/shops/${shopId}/members`);
}

async function removeAdmin(formData: FormData) {
  "use server";

  const shopId = String(formData.get("shopId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();

  if (!isUuid(shopId) || !isUuid(userId)) return;

  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("rb_remove_shop_member", {
    p_shop_id: shopId,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/shops/${shopId}/members`);
}

async function setAdminRole(formData: FormData) {
  "use server";

  const shopId = String(formData.get("shopId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim();
  const role = roleRaw === "admin" ? "admin" : roleRaw === "member" ? "member" : "";

  if (!isUuid(shopId) || !isUuid(userId) || !role) return;

  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("rb_set_shop_member_role", {
    p_shop_id: shopId,
    p_user_id: userId,
    p_role: role,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/shops/${shopId}/members`);
}

export default async function ShopAdminsPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const sid = String(shopId ?? "").trim();

  if (!isUuid(sid)) {
    return (
      <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Admins</h1>
        <GlassCard title="Invalid Shop ID">
          <Link href="/shops" style={{ textDecoration: "none" }}>
            ← Back to Shops
          </Link>
        </GlassCard>
      </div>
    );
  }

  const shop = await rbGetShop(sid);

  const supabase = await supabaseServer();
  const admin = supabaseAdmin();

  const { data: members, error } = await supabase
    .from("rb_shop_members")
    .select("*")
    .eq("shop_id", sid)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const ids = Array.from(new Set((members ?? []).map((m: any) => m.user_id)));
  const emailById = new Map<string, string>();

  for (const uid of ids) {
    try {
      const res = await admin.auth.admin.getUserById(uid);
      const em = res.data.user?.email ?? "";
      if (em) emailById.set(uid, em);
    } catch {}
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Admins — {shop.name}</h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          <b>Admins</b> are users who can log into RunBook.Control to manage devices, updates, and access.
          <br />
          <b>Employees</b> (operators, time clock users) are managed inside the RunBook app — not here.
        </div>
        <TabBar shopId={shop.id} active="admins" />
      </div>

      <GlassCard title="Invite / Add Admin">
        <form action={inviteAndAddAdmin} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input type="hidden" name="shopId" value={sid} />
          <input name="email" placeholder="email@domain.com" style={{ padding: 10, borderRadius: 12, minWidth: 320 }} />
          <select name="role" defaultValue="member" style={{ padding: 10, borderRadius: 12, minWidth: 160 }}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
            Add
          </button>
        </form>
      </GlassCard>

      <GlassCard title="Current Admins">
        {(members ?? []).length === 0 ? (
          <div style={{ opacity: 0.75 }}>No admins found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {(members ?? []).map((m: any) => {
              const email = emailById.get(m.user_id) ?? "";
              return (
                <div
                  key={m.id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {email || `User ${m.user_id}`}
                      </span>
                      <RoleBadge role={m.role} />
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>User ID: {m.user_id}</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <form action={setAdminRole} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="hidden" name="shopId" value={sid} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <select name="role" defaultValue={m.role} style={{ padding: "8px 10px", borderRadius: 12 }}>
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                      <button type="submit" style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 800 }}>
                        Save
                      </button>
                    </form>

                    <form action={removeAdmin}>
                      <input type="hidden" name="shopId" value={sid} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <button type="submit" style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 800 }}>
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.16)",
        background: isAdmin ? "rgba(139,140,255,0.16)" : "rgba(255,255,255,0.06)",
        color: isAdmin ? "#b8b9ff" : "#e6e8ef",
        fontWeight: 900,
        letterSpacing: 0.2,
        textTransform: "uppercase",
      }}
    >
      {role}
    </span>
  );
}
