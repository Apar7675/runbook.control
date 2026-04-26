import React from "react";
import { ControlActionButtonV2, ControlActionLinkV2 } from "@/components/control/v2/ControlActionButtonV2";
import { ControlInputV2, ControlSelectV2 } from "@/components/control/v2/ControlFieldV2";
import { ControlTableCellV2, ControlTableHeadCellV2, ControlTableV2, ControlTableWrapV2 } from "@/components/control/v2/ControlTableV2";
import { controlV2Theme as t } from "@/components/control/v2/controlV2Theme";
import { getViewerContext, selectPrimaryShop } from "@/lib/control/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/ui/dates";

export const dynamic = "force-dynamic";

type SupportBundleRow = {
  id: string;
  shop_id: string;
  file_path: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function fileName(path: string | null) {
  const text = String(path ?? "").trim();
  if (!text) return "No file path";
  const parts = text.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? text;
}

function formatMaybeDate(value: string | null) {
  if (!value) return "Unknown";
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedShopId = firstParam(params.shop);
  const query = firstParam(params.q).trim().toLowerCase();
  const hasPathFilter = firstParam(params.has_path).trim().toLowerCase() || "all";
  const context = await getViewerContext();
  const primaryShop = selectPrimaryShop(context.shops, requestedShopId);

  if (!primaryShop) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Support</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Support bundles</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>
            Support bundle review stays tied to an authorized shop. No shop means there is no support-bundle directory to inspect yet.
          </div>
        </div>
        <ControlTableWrapV2>
          <ControlTableV2 minWidth={720}>
            <thead>
              <tr>
                <ControlTableHeadCellV2>State</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Authority</ControlTableHeadCellV2>
                <ControlTableHeadCellV2>Next</ControlTableHeadCellV2>
              </tr>
            </thead>
            <tbody>
              <tr>
                <ControlTableCellV2>No shop is available for support-bundle review.</ControlTableCellV2>
                <ControlTableCellV2>rb_shops and rb_shop_members scope</ControlTableCellV2>
                <ControlTableCellV2><ControlActionLinkV2 href="/shops" tone="primary">Open shops</ControlActionLinkV2></ControlTableCellV2>
              </tr>
            </tbody>
          </ControlTableV2>
        </ControlTableWrapV2>
      </div>
    );
  }

  const admin = supabaseAdmin();
  const bundleResult = await admin
    .from("rb_support_bundles")
    .select("id,shop_id,file_path,notes,uploaded_by,created_at")
    .eq("shop_id", primaryShop.id)
    .order("created_at", { ascending: false });

  const loadError = bundleResult.error?.message ?? "";
  const rows = ((bundleResult.data ?? []) as SupportBundleRow[])
    .filter((row) => {
      if (hasPathFilter === "with_path") return Boolean(String(row.file_path ?? "").trim());
      if (hasPathFilter === "missing_path") return !String(row.file_path ?? "").trim();
      return true;
    })
    .filter((row) => {
      if (!query) return true;
      return [
        row.file_path,
        row.notes,
        row.uploaded_by,
        row.id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: t.color.textQuiet, ...t.type.label }}>Support</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Support bundles</h1>
          <div style={{ fontSize: 13, color: t.color.textQuiet }}>
            Selected-shop support-bundle directory. This table shows Control metadata for bundles recorded in `rb_support_bundles`; it does not imply storage-file validation or bundle contents review.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ControlActionLinkV2 href="/shops">Open shops</ControlActionLinkV2>
          <ControlActionLinkV2 href="/support/bundle" tone="primary">Upload bundle</ControlActionLinkV2>
        </div>
      </div>

      <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ControlSelectV2 name="shop" defaultValue={primaryShop.id} style={{ minWidth: 220 }}>
          {context.shops.map((shop) => (
            <option key={shop.id} value={shop.id}>{shop.name}</option>
          ))}
        </ControlSelectV2>
        <ControlInputV2 name="q" defaultValue={firstParam(params.q)} placeholder="Search path, notes, uploader" style={{ minWidth: 240 }} />
        <ControlSelectV2 name="has_path" defaultValue={hasPathFilter} style={{ minWidth: 160 }}>
          <option value="all">All rows</option>
          <option value="with_path">With path</option>
          <option value="missing_path">Missing path</option>
        </ControlSelectV2>
        <ControlActionButtonV2 type="submit" tone="primary">
          Apply
        </ControlActionButtonV2>
        <ControlActionLinkV2 href={`/support?shop=${encodeURIComponent(primaryShop.id)}`}>Clear</ControlActionLinkV2>
      </form>

      <div style={{ fontSize: 12, color: t.color.textQuiet }}>
        {rows.length} support bundle row{rows.length === 1 ? "" : "s"} shown for {primaryShop.name}. Authority: `rb_support_bundles` metadata for the selected authorized shop only.
      </div>

      {loadError ? <div style={{ fontSize: 12.5, color: t.color.textMuted }}>Could not load support bundles: {loadError}</div> : null}

      <ControlTableWrapV2>
        <ControlTableV2 minWidth={1080}>
          <thead>
            <tr>
              <ControlTableHeadCellV2>Bundle</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Path</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Notes</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Uploaded By</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Created</ControlTableHeadCellV2>
              <ControlTableHeadCellV2>Authority</ControlTableHeadCellV2>
            </tr>
          </thead>
          <tbody>
            {loadError ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>
                  Support bundle metadata is unavailable for the selected shop right now.
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: t.color.textMuted }}>
                  No support bundles matched the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <ControlTableCellV2>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.color.text }}>{fileName(row.file_path)}</div>
                      <div style={{ color: t.color.textQuiet, fontSize: 11.5 }}>{row.id}</div>
                    </div>
                  </ControlTableCellV2>
                  <ControlTableCellV2>{row.file_path ?? "No stored path"}</ControlTableCellV2>
                  <ControlTableCellV2>{row.notes ?? "No notes"}</ControlTableCellV2>
                  <ControlTableCellV2>{row.uploaded_by ?? "Unknown"}</ControlTableCellV2>
                  <ControlTableCellV2>{formatMaybeDate(row.created_at)}</ControlTableCellV2>
                  <ControlTableCellV2>rb_support_bundles metadata</ControlTableCellV2>
                </tr>
              ))
            )}
          </tbody>
        </ControlTableV2>
      </ControlTableWrapV2>
    </div>
  );
}
