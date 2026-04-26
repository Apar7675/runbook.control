import React from "react";
import AuditLogWorkspaceV2 from "@/components/audit/AuditLogWorkspaceV2";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <AuditLogWorkspaceV2
      initialFilters={{
        action: typeof params.action === "string" ? params.action : "",
        actor_email: typeof params.actor_email === "string" ? params.actor_email : "",
        shop_id: typeof params.shop_id === "string" ? params.shop_id : "",
        target_id: typeof params.target_id === "string" ? params.target_id : "",
        before: typeof params.before === "string" ? params.before : "",
        limit: typeof params.limit === "string" ? params.limit : "200",
      }}
    />
  );
}
