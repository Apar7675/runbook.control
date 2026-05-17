import { redirect } from "next/navigation";
import ControlActionButton, { ControlActionLink } from "@/components/control/ControlActionButton";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import { controlTheme as t } from "@/components/control/controlTheme";
import { auditLog } from "@/lib/audit";
import { supabaseServer } from "@/lib/supabase/server";

async function createShop(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await supabaseServer();

  // RPC does: create shop + make current user admin + create default policy
  const { data: shopId, error } = await supabase.rpc("rb_create_shop", { p_name: name });

  if (error) throw new Error(error.message);
  if (!shopId) throw new Error("rb_create_shop returned no id");

  await auditLog({
    shop_id: shopId,
    action: "shop.created",
    entity_type: "shop",
    entity_id: shopId,
    details: { name },
  });

  redirect(`/shops/${shopId}`);
}

export default async function NewShopPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ControlPageHeader
        eyebrow="Shops"
        title="Create Shop"
        description="Create a Control shop authority record using the existing secure server function."
        actions={<ControlActionLink href="/shops">Back to shops</ControlActionLink>}
      />

      <ControlPanel title="Shop Details" description="This creates the shop record and assigns the current platform-admin session as admin.">
        <form action={createShop} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            name="name"
            placeholder="Shop name (e.g. Ten MFG)"
            style={{
              flex: "1 1 320px",
              minHeight: 38,
              padding: "0 11px",
              borderRadius: t.radius.sm,
              border: `1px solid ${t.color.softBorder}`,
              background: "rgba(7, 10, 15, 0.68)",
              color: t.color.text,
              outline: "none",
            }}
          />
          <ControlActionButton type="submit" tone="primary">Create</ControlActionButton>
        </form>

        <div style={{ fontSize: 12, color: t.color.textMuted }}>
          Uses a secure server function to create the shop and set you as admin.
        </div>
      </ControlPanel>
    </div>
  );
}
