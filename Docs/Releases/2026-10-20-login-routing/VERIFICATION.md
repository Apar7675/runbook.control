RunBook Control login routing was released on October 20, 2026, and verified against the public served JavaScript and anonymous HTTP responses.

The production URL is https://runbook-control.vercel.app. Vercel production deployment `dpl_GqB5NuT3Pk6tUvqos3scSzc8Z32t` became READY at 2026-10-20 14:07:02.639 UTC. Its immutable deployment URL is https://runbook-control-3yhmsmhqk-angelo-parizas-projects.vercel.app. Previous deployment `dpl_2bDwWXYV1iMqwBKXGHGfRfVVNfcM` remains READY for rollback at https://runbook-control-1hno70eyi-angelo-parizas-projects.vercel.app.

This deployment uses the production release baseline `b453a7c8ac8fc599d93a81b317250a021c5b04f1` and changes only `src/app/login/page.tsx`. The fallback destination changes from `/shops` to `/dashboard`, and the special case that rejected explicit `/dashboard` is removed. Explicit `/shops`, shop, device, and other allowed destinations retain their behavior. The attached patch records this exact production change against that baseline.

The 199-file candidate source manifest records relative paths, modes, sizes, SHA-256, raw-file SHA-1, Git blob SHA-1, and the complete candidate Git tree SHA-1. Every source file except the reviewed login file matches the October 18 production publication manifest and its preserved publication tree. The candidate completed the standard Next.js 16.1.6 Turbopack production build, including TypeScript and static prerender checks, without disabling checks or modifying configuration. Vercel also completed its production build and the live URL resolved to the new deployment.

The deployment was submitted through the Vercel API as a content-addressed file manifest. It was not triggered by a Git commit, and no Vercel Git commit metadata is claimed. Any Git commit or production tag created afterward records verified source equivalence to this manifest; it does not change how the deployment was originally submitted. `release-identity.json` records the baseline, exact changed login blob and hashes, candidate tree, deployment IDs, and verification scope.

Local build diagnosis retained all earlier failures. The initial long-path Turbopack attempt exceeded the Windows filename limit. An alternate webpack attempt generated a page-props error for the unchanged settings page's synchronous `searchParams` type. Returning to the actual production build mode, default Turbopack, passed compilation and TypeScript. The restricted shell then denied a prerender-directory write; the same exact candidate passed the full build in an unrestricted shell using isolated synthetic configuration. No settings source edit, type-check bypass, configuration change, or environment change was used to resolve these local checks.

Public verification completed at 2026-10-20 14:07:52 UTC:

- `/login` returned HTTP 200.
- Anonymous `/dashboard` retained HTTP 307 with destination `/login?next=%2Fdashboard`.
- The previous login component bundle was `/_next/static/chunks/f6cb52895a3279c9.js`, SHA-256 `C4B67EB4A5855FCA3D49513347286DADE6E60E5F6187ED34BC8B47A19F28F9E7`. Its compiled routing expression explicitly remapped `/dashboard` to `/shops`.
- The new login component bundle is `/_next/static/chunks/f93b2f99dfa1a02f.js`, SHA-256 `BD98424524F7C6F21B056FAA4122B41CC36BD387EE8889192464D8AC85C2E840`. Its compiled expression defaults to `/dashboard` and preserves explicit `/dashboard`.
- All 15 synthetic routing cases passed against the exact pure expression extracted from each public bundle. `routing-cases.json` records the inputs and before/after outcomes. No downloaded application bundle was executed.
- Deployed `vercel.json` readback retained `git.deploymentEnabled: false`. Automatic Git deployments remain disabled.

The broader portable-drive Control source, including unrelated access-policy changes, was excluded from this deployment. Consolidated Git main may preserve that broader source history; it is not the identity of this bounded production release. If main already contains the dashboard fallback, the attached historical patch does not need to be applied there.

No real-user sign-in or authenticated UI acceptance was performed. Existing authentication, MFA, onboarding, roles, environment, and security configuration were retained. Verification proves the deployed routing expression, source scope, build outcome, deployment identity, and anonymous responses; it does not claim a real authenticated session test.

This provenance bundle contains only the reviewed patch, source hashes, release identity, synthetic route outcomes, and this release record. Production environment values, account or company data, raw configuration snapshots, and public HTML captures are excluded.
