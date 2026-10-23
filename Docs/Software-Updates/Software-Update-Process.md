# RunBook Software Update Process

## Current Scope

RunBook.Control currently manages software update metadata and guidance only.

Today, Control is responsible for:

- Release metadata
- Release intent
- Package metadata
- Publish readiness guidance
- Rollout records
- Device version signals

Control does not currently:

- Download update packages
- Install software
- Stage packages locally
- Verify package contents against a downloaded file
- Restart services
- Roll back devices

This is intentional. Control is the remote authority for update truth, not the local installer.

## Release Lifecycle

- `draft`: The release is being prepared and should not be considered available to devices.
- `published`: The release is active and visible to eligible devices through approved rollout policy.
- `paused`: A rollout for the release has been paused and should not continue expanding until reviewed.
- `retired`: The release remains part of history but should no longer be used for new rollout approval.

## Release Intent

Release intent describes how strongly a release should be treated.

- `optional`: User or admin may install when ready.
- `recommended`: Normal release for most shops.
- `required`: Critical fix or compatibility block only.

For backward compatibility, `required` intent is also mirrored to the legacy `required` boolean field. Older rows may still rely on that boolean, so new code must preserve that compatibility path.

## Package Metadata

Current release-level package metadata fields:

- `package_url`
- `package_file_name`
- `package_sha256`
- `package_size_bytes`
- `package_uploaded_at`

These fields record package information only.

Important:

- `package_sha256` is metadata only right now.
- Control does not verify that checksum against a real file in the current phase.
- Control does not fetch `package_url`.
- Control does not use this metadata to download or install anything yet.

## Publish Readiness

Release activation and saving an active release use the same server-side metadata checks. A release needs a valid app, channel and version, release notes, and at least one complete linked `rb_software_packages` row for that app. The package row needs a file name, download URL or storage path, SHA256, positive whole-number byte size, platform and architecture. Create a draft first, add package metadata, then activate it.

Legacy inline package fields remain visible as recorded metadata. They do not replace a linked package row because they do not identify a target platform or architecture. An optional minimum supported version must be valid and no newer than the release; an optional rollback version must be valid and older.

These checks validate recorded metadata. They do not download a package, verify bytes against its checksum, install software, or prove that a location contains the recorded file.

## Availability Checks

The check endpoint accepts the existing Windows x64 request body by default. Clients can explicitly supply a supported `platform` and `architecture`; only matching package metadata, or a universal package for that platform, is eligible.

Versions support three numeric components and the fourth revision reported by .NET. An omitted revision compares as zero. Prerelease labels follow SemVer precedence and build metadata does not affect ordering. Equal versions and downgrades are never offered. Missing or invalid installed versions do not receive an update or a required-update decision. For each app, only the highest newer release with an eligible package and matching active rollout is returned. A nonempty invalid rollout start date fails closed.

Database errors and missing update tables produce an explicitly unavailable, empty workspace. They never substitute sample releases, customers, devices or fleet counts. A successful empty query is shown as live data with no records.

## Safe Release Order

Recommended safe release order:

1. Build and test locally
2. Create draft release
3. Add release notes
4. Add package metadata
5. Verify readiness
6. Publish internal only
7. Test one shop
8. Expand rollout
9. Monitor device signals
10. Pause if failures appear

This order keeps rollout risk low and prevents broad exposure before a release has clean device feedback.

## What Must Not Be Added Yet

Do not add any of the following until a dedicated updater design is approved:

- Automatic downloads
- Installer launch
- Staging folders
- Checksum execution
- Rollback execution
- Service restart
- Silent updates
- Forced updates

If a change introduces local execution behavior before the approved updater design phase, it crosses the current architecture boundary.

## Future Phases

- Phase 1 metadata and guidance: done/current
- Phase 2 Desktop/Service reads availability: next
- Phase 3 manual download link
- Phase 4 checksum verification
- Phase 5 staged download
- Phase 6 approved installer launch
- Phase 7 rollback/emergency block

These phases are intentionally incremental. Dangerous local execution behavior must not be pulled forward early.

## Architecture Boundary

RunBook.Control is the remote authority for:

- Release metadata
- Release intent
- Package metadata truth
- Rollout policy
- Device update visibility

RunBook.Service and RunBook.Desktop are consumers of update availability and status. They may read approved update truth from Control, but they must not invent independent update truth locally.

Devices must never independently decide what is approved. Approval and rollout truth come from Control.
