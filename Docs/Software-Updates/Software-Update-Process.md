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

The Publish Readiness panel is derived UI guidance only.

It helps admins see whether a release appears complete enough to publish by reviewing existing recorded fields, but it does not:

- Block publishing
- Download anything
- Install anything
- Verify checksums
- Enforce rollout safety automatically

It is guidance, not execution.

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
