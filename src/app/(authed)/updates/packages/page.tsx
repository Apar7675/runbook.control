import ControlEmptyState from "@/components/control/ControlEmptyState";
import ControlPageHeader from "@/components/control/ControlPageHeader";
import ControlPanel from "@/components/control/ControlPanel";
import ControlStatusChip from "@/components/control/ControlStatusChip";
import { ControlTable, ControlTableCell, ControlTableHeadCell, ControlTableWrap } from "@/components/control/ControlTable";
import PackageUploaderClient from "@/components/PackageUploaderClient";
import { supabaseServer } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/ui/dates";

type PackageRow = {
  id: string;
  version: string | null;
  channel: string | null;
  file_path: string | null;
  notes: string | null;
  created_at: string | null;
};

export default async function UpdatePackagesPage() {
  const supabase = await supabaseServer();

  const { data: pkgs, error } = await supabase
    .from("rb_update_packages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const packages = (pkgs ?? []) as PackageRow[];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ControlPageHeader
        eyebrow="Updates"
        title="Update Packages"
        description="Register package metadata for the Control update authority without changing device runtime behavior."
      />

      <ControlPanel
        title="Upload Package"
        description="Uses the existing package uploader behavior. Package deployment policy remains controlled by the current update routes."
      >
        <PackageUploaderClient />
      </ControlPanel>

      <ControlPanel title="Existing Packages" description="Real package rows recorded in rb_update_packages.">
        {packages.length === 0 ? (
          <ControlEmptyState title="No packages uploaded yet" description="When package records exist, they will appear here as a compact metadata table." />
        ) : (
          <ControlTableWrap>
            <ControlTable>
              <thead>
                <tr>
                  <ControlTableHeadCell>Version</ControlTableHeadCell>
                  <ControlTableHeadCell>Channel</ControlTableHeadCell>
                  <ControlTableHeadCell>File Path</ControlTableHeadCell>
                  <ControlTableHeadCell>Notes</ControlTableHeadCell>
                  <ControlTableHeadCell>Created</ControlTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.id}>
                    <ControlTableCell>{p.version ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>
                      <ControlStatusChip label={p.channel ?? "Not surfaced"} tone={p.channel === "stable" ? "success" : p.channel ? "info" : "neutral"} />
                    </ControlTableCell>
                    <ControlTableCell><code>{p.file_path ?? "Not surfaced"}</code></ControlTableCell>
                    <ControlTableCell>{p.notes ?? "Not surfaced"}</ControlTableCell>
                    <ControlTableCell>{p.created_at ? formatDateTime(p.created_at) : "Not surfaced"}</ControlTableCell>
                  </tr>
                ))}
              </tbody>
            </ControlTable>
          </ControlTableWrap>
        )}
      </ControlPanel>
    </div>
  );
}
