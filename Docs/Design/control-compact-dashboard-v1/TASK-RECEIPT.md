# Control compact dashboard task receipt - October 16, 2026

Status: implementation and local validation complete; Git checkpoint and local evidence exclusion blocked by the session's explicit read-only permission for .git. Supervisor visual acceptance and preview deployment remain pending. Nothing has been pushed or deployed.

Checkout: C:\RunBook-DeployPrep\20261016-control\source
Branch: ui/control-compact-dashboard-20261016
Starting and current HEAD: 02e30050c88e67760f77f1b5eb4b904093582214
Validation generated: 2026-10-16T15:32:35.204Z

This is the owner's bounded October 16 Control dashboard/sidebar density task only. The newer C-primary instruction and this explicit request supersede historical D locations and feature pause only for this task. No subagents, cloud worker, scheduler, API billing, paid service, new dependency, migration or provider activation was used. Architecture instructions were read from C, including the System Bible, Control Bible, AI cloud workflow, supervisor AGENTS, visual handoff and source-of-truth documents. No D path or canonical Control recovery checkout was accessed.

## Design handoff log

Verified ZIP SHA256: 6d40f38bfbc5f38eca250b70c04df459b03de158d619cb49ca74c68fd2cc85f3.
Extracted into source\.local-evidence\control-compact\design-pack. Every manifest entry passed byte-length and SHA256 verification: README.md, reference-1366x768.png, reference.html, tokens.json. Opened the PNG in the image viewer and read the HTML, tokens and README. The reference was compared with actual component captures at matched 1366 x 768 dimensions. The ZIP and its checksum are copied unchanged into this directory; PACK-MANIFEST.json is the original manifest.

No new standalone graphic was needed or created. Existing native React panels, metrics, header, branding and status chips are reused. Reference documents are never rendered as UI assets.

## Product changes

- Four priority cards are 72px in normal desktop fixtures; the remaining five counts occur once in the slim summary strip. Header is 25px with brief purpose copy and Refresh.
- Attention and five health rows form two columns. Activity previews three records; compact Support, Updates and Audit links retain access to those modules.
- All generated alerts are retained and stably ordered Critical, High, Medium, Low before the four-row preview. A counted native details/summary disclosure exposes every generated row with full detail, source and review destination. Late Critical alerts beyond the old twelve-row cutoff reach the first preview. Populated fixtures disclose 14 rows, restricted 28, and large counts 18. Timeclock review links go directly to /timeclock-review.
- Query caps remain 50 support, 50 updates, 200 audit and 1000 timeclock. Labels become 50+, 200+ and 1000+ at caps. Per-shop timeclock rows use a lower-bound + when the shared result set is capped. All five query chains, selected fields, scope filters, error fallbacks and limits are preserved; the empty scope still only requests global update metadata.
- Sidebar retains all 13 existing routes, supplied statuses, email and role. Reduced intro/status chrome and border-box 100dvh sizing eliminate padding overflow. Keyboard focus is visible, current page is marked, and responsive navigation reflows into two columns.
- Compact header/metric variants default off. Dashboard CSS is scoped. Other module content and auth/billing/access decisions were not changed.

## Changed files

- src/app/(authed)/dashboard/page.tsx
- src/components/control/ControlAppShell.tsx
- src/components/control/ControlSidebar.tsx
- src/components/control/ControlMetricCard.tsx
- src/components/control/ControlPageHeader.tsx
- src/components/control/dashboard/ControlDashboard.tsx
- scripts/verify-control-compact.js
- Docs/Design/control-compact-dashboard-v1/runbook-control-compact-dashboard-v1.zip
- Docs/Design/control-compact-dashboard-v1/SHA256SUMS
- Docs/Design/control-compact-dashboard-v1/PACK-MANIFEST.json
- Docs/Design/control-compact-dashboard-v1/SOURCE-SHA256SUMS
- Docs/Design/control-compact-dashboard-v1/EVIDENCE-SHA256SUMS
- Docs/Design/control-compact-dashboard-v1/TASK-RECEIPT.md

SOURCE-SHA256SUMS identifies the exact seven source/harness files. No tracked file, dependency, migration or asset was deleted. Cleanup was limited to the replaced dashboard rendering, the obsolete latest-activity helper and unused thirty-day summary computations. The broader historical cross-app cleanup remains outside this task.

Preserved owner files (not staged or edited):
- AGENTS.md SHA256 cb664555377d43a190184560441b3e3cd9f417e8875207e257e8da8da254d2b2
- .vercelignore SHA256 f14c5f30917bd4874c5f2bcacf61cb2e3fe64224bc6644ef3b604e1a9656eb3d

## Local verification

- F03 authorization: PASS.
- F04 static: PASS.
- F05 static: PASS.
- F06 static and API: PASS.
- Optimized Next build: PASS, using only https://control-fixture.example.invalid and synthetic public anon-key environment values; no .env, .env.local or .env.production is present.
- Typecheck: PASS (tsc --noEmit --incremental false).
- Full lint: PASS, zero errors and the existing 208 warnings. Final lint of all seven changed source/harness files: zero warnings/errors; the final native-capture adjustment was separately linted with zero warnings/errors. No lint configuration was changed.
- git diff --check on source: PASS. Authenticated layout, authz, Supabase, billing, and workflow paths have no diff. Git index remains unchanged.
- Actual-component harness: PASS, 42 cases with 69 indexed native browser PNGs. Six closed states x four viewports, four expanded states x four viewports, plus closed and expanded actual 200% browser zoom.

Run the harness locally with C node: node scripts/verify-control-compact.js. It uses the existing C browser-tools playwright-core and system Edge, compiles the actual TS/TSX in memory, invokes the real dashboard page, and renders the actual root, shell, sidebar and presentation components through React SSR. Only data and navigation boundaries are mocked. A loopback-only fixture server outside deployable src routes serves the synthetic render; CSP and request routing block external connections. Zero external requests were attempted. Fixtures include long unbroken labels, capped results, late Critical alerts, query errors, restricted access states and empty scopes. Query-count/scope assertions reject extra dashboard fetches. No production auth bypass or test route exists.

Browser keyboard checks reach all 13 routes with visible focus at every viewport and operate the native alert disclosure with Enter/Space. Expanded rows and their final review links remain reachable. The four-priority ordering helper is checked for stable ties and all four priorities. Actual page rendering verifies complete generated alert counts beyond twelve and truthful cap labels.

## Measured DOM geometry

All dimensions below are CSS pixels from documentElement scrollWidth/scrollHeight. Normal populated, empty, restricted and query-error desktop overviews fit all three desktop viewports without page overflow. At narrow sizes and on expanded disclosures, content scrolls naturally. No content is clipped, scaled or hidden to fit.

| State | Viewport | Document scrollWidth x scrollHeight | Nav clientHeight / scrollHeight | Four metric heights |
| --- | --- | --- | --- | --- |
| populated | 1366 x 768 | 1366 x 768 | 605 / 605 | 72, 72, 72, 72 |
| populated | 1440 x 900 | 1440 x 900 | 737 / 737 | 72, 72, 72, 72 |
| populated | 1920 x 1080 | 1920 x 1080 | 917 / 917 | 72, 72, 72, 72 |
| populated | 390 x 844 | 390 x 2246 | 248 / 248 | 72, 72, 72, 72 |
| empty | 1366 x 768 | 1366 x 768 | 605 / 605 | 72, 72, 72, 72 |
| empty | 1440 x 900 | 1440 x 900 | 737 / 737 | 72, 72, 72, 72 |
| empty | 1920 x 1080 | 1920 x 1080 | 917 / 917 | 72, 72, 72, 72 |
| empty | 390 x 844 | 390 x 1689 | 248 / 248 | 72, 72, 72, 72 |
| largecounts | 1366 x 768 | 1366 x 773 | 605 / 605 | 72, 77.17, 93.97, 72 |
| largecounts | 1440 x 900 | 1440 x 900 | 737 / 737 | 72, 77.17, 77.17, 72 |
| largecounts | 1920 x 1080 | 1920 x 1080 | 917 / 917 | 72, 72, 72, 72 |
| largecounts | 390 x 844 | 390 x 2276 | 248 / 248 | 72, 72, 72, 72 |
| longlabels | 1366 x 768 | 1366 x 1074 | 509 / 509 | 72, 72, 72, 72 |
| longlabels | 1440 x 900 | 1440 x 1057 | 641 / 641 | 72, 72, 72, 72 |
| longlabels | 1920 x 1080 | 1920 x 1080 | 821 / 821 | 72, 72, 72, 72 |
| longlabels | 390 x 844 | 390 x 3201 | 248 / 248 | 72, 72, 72, 72 |
| restricted | 1366 x 768 | 1366 x 768 | 605 / 605 | 72, 72, 72, 72 |
| restricted | 1440 x 900 | 1440 x 900 | 737 / 737 | 72, 72, 72, 72 |
| restricted | 1920 x 1080 | 1920 x 1080 | 917 / 917 | 72, 72, 72, 72 |
| restricted | 390 x 844 | 390 x 2246 | 248 / 248 | 72, 72, 72, 72 |
| queryerror | 1366 x 768 | 1366 x 768 | 605 / 605 | 72, 72, 72, 72 |
| queryerror | 1440 x 900 | 1440 x 900 | 737 / 737 | 72, 72, 72, 72 |
| queryerror | 1920 x 1080 | 1920 x 1080 | 917 / 917 | 72, 72, 72, 72 |
| queryerror | 390 x 844 | 390 x 2093 | 248 / 248 | 72, 72, 72, 72 |

Actual 200% browser zoom uses a fresh task-only Edge profile, with Chromium's partition default zoom preference. No user's profile or persistent security settings were touched. The measured browser window is 1366 x 768, CSS viewport 668 x 336, devicePixelRatio 2; the closed document is 668 x 1602. This uses native browser zoom, without CSS zoom, transform or CDP page scaling. Implementation note: [Chromium zoom preferences](https://chromium.googlesource.com/chromium/src/+/114.0.5735.90/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc).

## Actual implementation PNG index

Viewport PNGs retain exact requested dimensions. Full-page counterparts preserve all naturally scrolling content. At native zoom, PNGs come directly from Edge Page.captureScreenshot and cover the whole browser content surface at physical resolution, including both navigation columns. The browser surface is 1336 x 673 pixels inside the 1366 x 768 window. No PNG is resized or edited. EVIDENCE-SHA256SUMS covers every indexed PNG, measurements and test log. Preliminary evidence files and task-only browser profiles remain local; measurements.json is the authoritative final index.

| State | Viewport | Viewport PNG | Full-page PNG |
| --- | --- | --- | --- |
| populated | 1366 x 768 | [populated-1366x768.png](../../../.local-evidence/control-compact/populated-1366x768.png) | Same as viewport |
| populated | 1440 x 900 | [populated-1440x900.png](../../../.local-evidence/control-compact/populated-1440x900.png) | Same as viewport |
| populated | 1920 x 1080 | [populated-1920x1080.png](../../../.local-evidence/control-compact/populated-1920x1080.png) | Same as viewport |
| populated | 390 x 844 | [populated-390x844.png](../../../.local-evidence/control-compact/populated-390x844.png) | [populated-390x844-full.png](../../../.local-evidence/control-compact/populated-390x844-full.png) |
| empty | 1366 x 768 | [empty-1366x768.png](../../../.local-evidence/control-compact/empty-1366x768.png) | Same as viewport |
| empty | 1440 x 900 | [empty-1440x900.png](../../../.local-evidence/control-compact/empty-1440x900.png) | Same as viewport |
| empty | 1920 x 1080 | [empty-1920x1080.png](../../../.local-evidence/control-compact/empty-1920x1080.png) | Same as viewport |
| empty | 390 x 844 | [empty-390x844.png](../../../.local-evidence/control-compact/empty-390x844.png) | [empty-390x844-full.png](../../../.local-evidence/control-compact/empty-390x844-full.png) |
| largecounts | 1366 x 768 | [largecounts-1366x768.png](../../../.local-evidence/control-compact/largecounts-1366x768.png) | [largecounts-1366x768-full.png](../../../.local-evidence/control-compact/largecounts-1366x768-full.png) |
| largecounts | 1440 x 900 | [largecounts-1440x900.png](../../../.local-evidence/control-compact/largecounts-1440x900.png) | Same as viewport |
| largecounts | 1920 x 1080 | [largecounts-1920x1080.png](../../../.local-evidence/control-compact/largecounts-1920x1080.png) | Same as viewport |
| largecounts | 390 x 844 | [largecounts-390x844.png](../../../.local-evidence/control-compact/largecounts-390x844.png) | [largecounts-390x844-full.png](../../../.local-evidence/control-compact/largecounts-390x844-full.png) |
| longlabels | 1366 x 768 | [longlabels-1366x768.png](../../../.local-evidence/control-compact/longlabels-1366x768.png) | [longlabels-1366x768-full.png](../../../.local-evidence/control-compact/longlabels-1366x768-full.png) |
| longlabels | 1440 x 900 | [longlabels-1440x900.png](../../../.local-evidence/control-compact/longlabels-1440x900.png) | [longlabels-1440x900-full.png](../../../.local-evidence/control-compact/longlabels-1440x900-full.png) |
| longlabels | 1920 x 1080 | [longlabels-1920x1080.png](../../../.local-evidence/control-compact/longlabels-1920x1080.png) | Same as viewport |
| longlabels | 390 x 844 | [longlabels-390x844.png](../../../.local-evidence/control-compact/longlabels-390x844.png) | [longlabels-390x844-full.png](../../../.local-evidence/control-compact/longlabels-390x844-full.png) |
| restricted | 1366 x 768 | [restricted-1366x768.png](../../../.local-evidence/control-compact/restricted-1366x768.png) | Same as viewport |
| restricted | 1440 x 900 | [restricted-1440x900.png](../../../.local-evidence/control-compact/restricted-1440x900.png) | Same as viewport |
| restricted | 1920 x 1080 | [restricted-1920x1080.png](../../../.local-evidence/control-compact/restricted-1920x1080.png) | Same as viewport |
| restricted | 390 x 844 | [restricted-390x844.png](../../../.local-evidence/control-compact/restricted-390x844.png) | [restricted-390x844-full.png](../../../.local-evidence/control-compact/restricted-390x844-full.png) |
| queryerror | 1366 x 768 | [queryerror-1366x768.png](../../../.local-evidence/control-compact/queryerror-1366x768.png) | Same as viewport |
| queryerror | 1440 x 900 | [queryerror-1440x900.png](../../../.local-evidence/control-compact/queryerror-1440x900.png) | Same as viewport |
| queryerror | 1920 x 1080 | [queryerror-1920x1080.png](../../../.local-evidence/control-compact/queryerror-1920x1080.png) | Same as viewport |
| queryerror | 390 x 844 | [queryerror-390x844.png](../../../.local-evidence/control-compact/queryerror-390x844.png) | [queryerror-390x844-full.png](../../../.local-evidence/control-compact/queryerror-390x844-full.png) |
| populated / expanded | 1366 x 768 | [populated-alerts-expanded-1366x768.png](../../../.local-evidence/control-compact/populated-alerts-expanded-1366x768.png) | [populated-alerts-expanded-1366x768-full.png](../../../.local-evidence/control-compact/populated-alerts-expanded-1366x768-full.png) |
| populated / expanded | 1440 x 900 | [populated-alerts-expanded-1440x900.png](../../../.local-evidence/control-compact/populated-alerts-expanded-1440x900.png) | [populated-alerts-expanded-1440x900-full.png](../../../.local-evidence/control-compact/populated-alerts-expanded-1440x900-full.png) |
| populated / expanded | 1920 x 1080 | [populated-alerts-expanded-1920x1080.png](../../../.local-evidence/control-compact/populated-alerts-expanded-1920x1080.png) | [populated-alerts-expanded-1920x1080-full.png](../../../.local-evidence/control-compact/populated-alerts-expanded-1920x1080-full.png) |
| populated / expanded | 390 x 844 | [populated-alerts-expanded-390x844.png](../../../.local-evidence/control-compact/populated-alerts-expanded-390x844.png) | [populated-alerts-expanded-390x844-full.png](../../../.local-evidence/control-compact/populated-alerts-expanded-390x844-full.png) |
| restricted / expanded | 1366 x 768 | [restricted-alerts-expanded-1366x768.png](../../../.local-evidence/control-compact/restricted-alerts-expanded-1366x768.png) | [restricted-alerts-expanded-1366x768-full.png](../../../.local-evidence/control-compact/restricted-alerts-expanded-1366x768-full.png) |
| restricted / expanded | 1440 x 900 | [restricted-alerts-expanded-1440x900.png](../../../.local-evidence/control-compact/restricted-alerts-expanded-1440x900.png) | [restricted-alerts-expanded-1440x900-full.png](../../../.local-evidence/control-compact/restricted-alerts-expanded-1440x900-full.png) |
| restricted / expanded | 1920 x 1080 | [restricted-alerts-expanded-1920x1080.png](../../../.local-evidence/control-compact/restricted-alerts-expanded-1920x1080.png) | [restricted-alerts-expanded-1920x1080-full.png](../../../.local-evidence/control-compact/restricted-alerts-expanded-1920x1080-full.png) |
| restricted / expanded | 390 x 844 | [restricted-alerts-expanded-390x844.png](../../../.local-evidence/control-compact/restricted-alerts-expanded-390x844.png) | [restricted-alerts-expanded-390x844-full.png](../../../.local-evidence/control-compact/restricted-alerts-expanded-390x844-full.png) |
| largecounts / expanded | 1366 x 768 | [largecounts-alerts-expanded-1366x768.png](../../../.local-evidence/control-compact/largecounts-alerts-expanded-1366x768.png) | [largecounts-alerts-expanded-1366x768-full.png](../../../.local-evidence/control-compact/largecounts-alerts-expanded-1366x768-full.png) |
| largecounts / expanded | 1440 x 900 | [largecounts-alerts-expanded-1440x900.png](../../../.local-evidence/control-compact/largecounts-alerts-expanded-1440x900.png) | [largecounts-alerts-expanded-1440x900-full.png](../../../.local-evidence/control-compact/largecounts-alerts-expanded-1440x900-full.png) |
| largecounts / expanded | 1920 x 1080 | [largecounts-alerts-expanded-1920x1080.png](../../../.local-evidence/control-compact/largecounts-alerts-expanded-1920x1080.png) | [largecounts-alerts-expanded-1920x1080-full.png](../../../.local-evidence/control-compact/largecounts-alerts-expanded-1920x1080-full.png) |
| largecounts / expanded | 390 x 844 | [largecounts-alerts-expanded-390x844.png](../../../.local-evidence/control-compact/largecounts-alerts-expanded-390x844.png) | [largecounts-alerts-expanded-390x844-full.png](../../../.local-evidence/control-compact/largecounts-alerts-expanded-390x844-full.png) |
| longlabels / expanded | 1366 x 768 | [longlabels-alerts-expanded-1366x768.png](../../../.local-evidence/control-compact/longlabels-alerts-expanded-1366x768.png) | [longlabels-alerts-expanded-1366x768-full.png](../../../.local-evidence/control-compact/longlabels-alerts-expanded-1366x768-full.png) |
| longlabels / expanded | 1440 x 900 | [longlabels-alerts-expanded-1440x900.png](../../../.local-evidence/control-compact/longlabels-alerts-expanded-1440x900.png) | [longlabels-alerts-expanded-1440x900-full.png](../../../.local-evidence/control-compact/longlabels-alerts-expanded-1440x900-full.png) |
| longlabels / expanded | 1920 x 1080 | [longlabels-alerts-expanded-1920x1080.png](../../../.local-evidence/control-compact/longlabels-alerts-expanded-1920x1080.png) | [longlabels-alerts-expanded-1920x1080-full.png](../../../.local-evidence/control-compact/longlabels-alerts-expanded-1920x1080-full.png) |
| longlabels / expanded | 390 x 844 | [longlabels-alerts-expanded-390x844.png](../../../.local-evidence/control-compact/longlabels-alerts-expanded-390x844.png) | [longlabels-alerts-expanded-390x844-full.png](../../../.local-evidence/control-compact/longlabels-alerts-expanded-390x844-full.png) |
| populated / 200% zoom | 1366 x 768 browser window | [populated-200pct-nativezoom.png](../../../.local-evidence/control-compact/populated-200pct-nativezoom.png) | [populated-200pct-nativezoom-full.png](../../../.local-evidence/control-compact/populated-200pct-nativezoom-full.png) |
| populated / expanded / 200% zoom | 1366 x 768 browser window | [populated-alerts-expanded-200pct-nativezoom.png](../../../.local-evidence/control-compact/populated-alerts-expanded-200pct-nativezoom.png) | [populated-alerts-expanded-200pct-nativezoom-full.png](../../../.local-evidence/control-compact/populated-alerts-expanded-200pct-nativezoom-full.png) |

Complete measurements and query/keyboard assertions: [measurements.json](../../../.local-evidence/control-compact/measurements.json).
Final capture-harness lint: [lint-harness-final.txt](../../../.local-evidence/control-compact/lint-harness-final.txt).
Logs: [fixture.txt](../../../.local-evidence/control-compact/fixture.txt), [build.txt](../../../.local-evidence/control-compact/build.txt), [typecheck.txt](../../../.local-evidence/control-compact/typecheck.txt), [lint.txt](../../../.local-evidence/control-compact/lint.txt), [lint-changed.txt](../../../.local-evidence/control-compact/lint-changed.txt), [verify-f03-administrative-authorization.js.txt](../../../.local-evidence/control-compact/verify-f03-administrative-authorization.js.txt), [verify-f04-legacy-lockdown.js.txt](../../../.local-evidence/control-compact/verify-f04-legacy-lockdown.js.txt), [verify-f05-employee-boundary.js.txt](../../../.local-evidence/control-compact/verify-f05-employee-boundary.js.txt), [verify-f06-messaging-boundary.js.txt](../../../.local-evidence/control-compact/verify-f06-messaging-boundary.js.txt), [verify-f06-api-boundary.js.txt](../../../.local-evidence/control-compact/verify-f06-api-boundary.js.txt).

## Visual comparison and limitations

Locally reviewed against the supplied reference: 232px rail, 18px main padding, 12px layout gap, four 72px metrics, 25px title, summary strip, queue/health columns, activity and shortcut layout. Existing font, dark shell glow and native status chips are retained. Full health detail and readable 12px metadata make lower sections taller than the illustrative reference while still fitting normal desktop overviews. The required counted details disclosure replaces the reference's illustrative View all affordance.

Very long synthetic labels intentionally add natural vertical scroll (1366 x 768 closed document height 1074; 1440 x 900 height 1057). Seven-digit counts add five vertical pixels at 1366 x 768 (document height 773). Counts and text remain complete; neither case uses clipping or smaller text to force fit. Supervisor visual acceptance is still required.

This fixture is actual React SSR plus native browser interaction with synthetic data/navigation, not an authenticated end-to-end Supabase session or a hosted preview. No real company data or secrets were loaded. Live preview/provider verification belongs to the supervisor's later approved Hobby preview deployment.

## Git metadata blocker

The current environment grants the checkout write access but explicitly grants source\.git read access only, with approvals disabled. Consequently /.local-evidence/ could not be added to .git/info/exclude, and the index/commit could not be written. No alternate Git directory/index, permission bypass, escalation, push, merge, workflow edit or deployment was attempted. No broad source ignore was introduced. .local-evidence remains an untracked local directory until its required info/exclude entry can be written.

Required remaining checkpoint work, once normal .git write access is available: add only /.local-evidence/ to .git/info/exclude, stage exactly the source/harness and six docs files listed above, review the staged diff, and make the authorized bounded local commit. Keep AGENTS.md and .vercelignore out of that commit. HEAD is still the starting SHA; no new product commit is claimed.
