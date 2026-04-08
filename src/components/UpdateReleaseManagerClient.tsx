"use client";

import React from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type ReleaseRow = {
  id: string;
  app_id: "desktop" | "workstation";
  channel: "stable" | "beta";
  version: string;
  min_supported_version: string | null;
  required_update: boolean;
  file_path: string;
  file_name: string | null;
  installer_kind: "installer" | "archive" | "other";
  notes: string | null;
  sha256: string | null;
  created_at: string;
  published_at: string | null;
  is_current: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Not published";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function buildPathPrefix(appId: string, channel: string, version: string) {
  const safeVersion = version.trim() || "unversioned";
  return `${appId}/${channel}/${safeVersion}`;
}

export default function UpdateReleaseManagerClient({
  initialReleases,
}: {
  initialReleases: ReleaseRow[];
}) {
  const [releases, setReleases] = React.useState(initialReleases);
  const [appId, setAppId] = React.useState<"desktop" | "workstation">("desktop");
  const [channel, setChannel] = React.useState<"stable" | "beta">("stable");
  const [version, setVersion] = React.useState("");
  const [minVersion, setMinVersion] = React.useState("");
  const [requiredUpdate, setRequiredUpdate] = React.useState(false);
  const [publishNow, setPublishNow] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");

  async function refreshList(nextAppId?: "desktop" | "workstation", nextChannel?: "stable" | "beta") {
    const targetApp = nextAppId ?? appId;
    const targetChannel = nextChannel ?? channel;
    const response = await fetch(`/api/updates/package?app=${targetApp}&channel=${targetChannel}`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json?.ok) {
      throw new Error(json?.error ?? "Could not refresh release list.");
    }
    setReleases(json.releases ?? []);
  }

  async function uploadRelease(file: File) {
    setBusy(true);
    setStatus("");

    try {
      if (!version.trim()) throw new Error("Enter the release version before uploading.");
      if (!minVersion.trim()) throw new Error("Enter the minimum supported version.");

      const supabase = supabaseBrowser();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${buildPathPrefix(appId, channel, version)}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from("rb-updates").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

      if (uploadError) throw new Error(uploadError.message);

      const response = await fetch("/api/updates/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId,
          channel,
          version,
          min_supported_version: minVersion,
          required_update: requiredUpdate,
          publish_now: publishNow,
          notes: notes || null,
          path,
          file_name: file.name,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Could not create the release record.");
      }

      setStatus(publishNow ? "Release uploaded and published." : "Package uploaded. Publish it when you're ready.");
      setNotes("");
      await refreshList();
    } catch (error: any) {
      setStatus(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function makeCurrent(packageId: string) {
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/updates/package/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: packageId }),
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? "Could not mark that release current.");

      setStatus(`Release ${json.release?.version ?? ""} is now current.`);
      await refreshList();
    } catch (error: any) {
      setStatus(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rb-stack">
      <div className="rb-sectionSurface">
        <div className="rb-inlineNotice">
          Current release = the version clients treat as live for this app and channel. Minimum supported version = the oldest version allowed to keep running. Required update = stronger online enforcement that prompts clients to move now.
        </div>

        <div className="rb-formGrid rb-formGrid--two">
          <label className="rb-field">
            <span className="rb-fieldLabel">App</span>
            <select
              className="rb-input"
              value={appId}
              onChange={async (event) => {
                const next = event.target.value === "workstation" ? "workstation" : "desktop";
                setAppId(next);
                await refreshList(next, channel);
              }}
              disabled={busy}
            >
              <option value="desktop">Desktop</option>
              <option value="workstation">Workstation</option>
            </select>
          </label>

          <label className="rb-field">
            <span className="rb-fieldLabel">Channel</span>
            <select
              className="rb-input"
              value={channel}
              onChange={async (event) => {
                const next = event.target.value === "beta" ? "beta" : "stable";
                setChannel(next);
                await refreshList(appId, next);
              }}
              disabled={busy}
            >
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </select>
          </label>

          <label className="rb-field">
            <span className="rb-fieldLabel">Version</span>
            <input className="rb-input" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.0.0" disabled={busy} />
            <span className="rb-pageCopy">Use strict numeric versions only: <code>1.2.3</code> or <code>1.2.3.4</code>.</span>
          </label>

          <label className="rb-field">
            <span className="rb-fieldLabel">Minimum supported version</span>
            <input className="rb-input" value={minVersion} onChange={(event) => setMinVersion(event.target.value)} placeholder="1.0.0" disabled={busy} />
            <span className="rb-pageCopy">Clients below this version are no longer allowed to continue once the policy is enforced.</span>
          </label>
        </div>

        <label className="rb-field">
          <span className="rb-fieldLabel">Release notes</span>
          <textarea className="rb-input rb-input--multiline" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What changed in this release?" disabled={busy} />
        </label>

        <div className="rb-inlineRow">
          <label className="rb-checkRow">
            <input type="checkbox" checked={requiredUpdate} onChange={(event) => setRequiredUpdate(event.target.checked)} disabled={busy} />
            <span>Required update</span>
          </label>
          <label className="rb-checkRow">
            <input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} disabled={busy} />
            <span>Publish immediately</span>
          </label>
        </div>

        <div className="rb-pageCopy">
          Required updates must use a real installer package such as <code>.exe</code>, <code>.msi</code>, or <code>.msix</code>. Optional releases may still use <code>.zip</code> for manual download.
        </div>
        <div className="rb-pageCopy">
          Control now computes the file hash for you automatically when you upload a package. You do not need to calculate or paste SHA-256 by hand.
        </div>

        <div className="rb-uploadPanel">
          <div className="rb-uploadTitle">Installer package</div>
          <div className="rb-pageCopy">Upload the Windows installer or package for this release. Control stores it in the private `rb-updates` bucket.</div>
          <input
            type="file"
            accept=".exe,.msi,.msix,.zip,application/octet-stream,application/x-msdownload,application/zip"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadRelease(file);
              event.currentTarget.value = "";
            }}
          />
          <div className="rb-pageCopy">Upload path: <code>{buildPathPrefix(appId, channel, version || "unversioned")}</code></div>
        </div>

        {status ? <div className="rb-inlineNotice">{status}</div> : null}
        <div className="rb-pageCopy">Rollback note: making an older release current restores that release's full policy too, including its minimum supported version and required-update flag. Control will block rollback if that older release no longer meets current safety rules.</div>
      </div>

      <div className="rb-dataGrid">
        {releases.length === 0 ? (
          <div className="rb-empty">No releases uploaded for this app/channel yet.</div>
        ) : (
          releases.map((release) => (
            <div key={release.id} className={release.is_current ? "rb-releaseCard rb-releaseCard--current" : "rb-releaseCard"}>
              <div className="rb-releaseCard__top">
                <div>
                  <div className="rb-releaseCard__title">{release.version}</div>
                  <div className="rb-pageCopy">{release.file_name ?? release.file_path}</div>
                </div>
                <div className="rb-inlineRow">
                  {release.is_current ? <span className="rb-badge rb-badge--healthy">Current</span> : null}
                  {release.required_update ? <span className="rb-badge rb-badge--critical">Required</span> : <span className="rb-badge">Optional</span>}
                </div>
              </div>

              <div className="rb-dataList">
                <div className="rb-dataListRow">
                  <div className="rb-dataListLabel">Minimum supported</div>
                  <div className="rb-dataListValue">{release.min_supported_version || "Not set"}</div>
                </div>
                <div className="rb-dataListRow">
                  <div className="rb-dataListLabel">Published</div>
                  <div className="rb-dataListValue">{formatDate(release.published_at)}</div>
                </div>
                <div className="rb-dataListRow">
                  <div className="rb-dataListLabel">Created</div>
                  <div className="rb-dataListValue">{formatDate(release.created_at)}</div>
                </div>
              </div>

              {release.notes ? <div className="rb-pageCopy">{release.notes}</div> : null}

              <div className="rb-inlineRow">
                {!release.is_current ? (
                  <button className="rb-button" type="button" onClick={() => void makeCurrent(release.id)} disabled={busy}>
                    Make Current
                  </button>
                ) : null}
                <a className="rb-buttonLink" href={`/api/updates/download/${release.id}`} target="_blank" rel="noreferrer">
                  Test Download
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
