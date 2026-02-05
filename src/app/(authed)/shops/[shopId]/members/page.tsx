import React from "react";
import GlassCard from "@/components/GlassCard";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rbGetShop } from "@/lib/rb";

async function inviteAndAddMember(formData: FormData) {
  "use server";

  const shopId = String(formData.get("shopId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member").trim();

  if (!shopId || !email) return;

  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user?.id) throw new Error("Not authenticated.");

  const admin = supabaseAdmin();

  // Create or invite. createUser will fail if exists in some configs; invite is fallback.
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  let userId = created.data.user?.id ?? null;

  if (!userId) {
    const invited = await admin.auth.admin.inviteUserByEmail(email);
    userId = invited.data.user?.id ?? null;
    if (!userId) throw new Error(invited.error?.message ?? "Failed to create/invite user.");
  }

  const { error } = await supabase.from("rb_shop_members").insert({
    shop_id: shopId,
    user_id: userId,
    role,
  });

  if (error) throw new Error(error.message);
}

async function removeMember(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "").trim();
  const shopId = String(formData.get("shopId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!id || !shopId) return;

  const supabase = await supabaseServer();

  // Prevent removing last admin
  if (role === "admin") {
    const { data: admins, error: e1 } = await supabase
      .from("rb_shop_members")
      .select("id")
      .eq("shop_id", shopId)
      .eq("role", "admin");

    if (e1) throw new Error(e1.message);
    if ((admins ?? []).length <= 1) {
      throw new Error("Cannot remove the last admin for this shop.");
    }
  }

  const { error } = await supabase.from("rb_shop_members").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export default async function ShopMembersPage({ params }: { params: { shopId: string } }) {
  const shop = await rbGetShop(params.shopId);
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();

  const { data: members, error } = await supabase
    .from("rb_shop_members")
    .select("*")
    .eq("shop_id", params.shopId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  // Resolve emails via service role (best UX)
  const ids = Array.from(new Set((members ?? []).map((m: any) => m.user_id)));
  const emailById = new Map<string, string>();

  for (const uid of ids) {
    try {
      const res = await admin.auth.admin.getUserById(uid);
      const em = res.data.user?.email ?? "";
      if (em) emailById.set(uid, em);
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Members — {shop.name}</h1>

      <GlassCard title="Invite / Add Member">
        <form action={inviteAndAddMember} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input type="hidden" name="shopId" value={params.shopId} />
          <input name="email" placeholder="email@domain.com" style={{ padding: 10, borderRadius: 12, minWidth: 320 }} />
          <select name="role" style={{ padding: 10, borderRadius: 12, minWidth: 160 }}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}>
            Add
          </button>
        </form>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
          Shows email if available. Prevents removing last admin.
        </div>
      </GlassCard>

      <GlassCard title="Current Members">
        {members.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No members found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {members.map((m: any) => {
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
                    gap: 10,
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

                  <form action={removeMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="shopId" value={params.shopId} />
                    <input type="hidden" name="role" value={m.role} />
                    <button type="submit" style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 800 }}>
                      Remove
                    </button>
                  </form>
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
