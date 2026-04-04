# RunBook Control Audit Report

## 1. Repo Summary
- This repo appears to be the RunBook Control web portal and API layer for managing shops, billing, desktop/device registration, updates, and some admin operations.
- The main app type is a Next.js web app with server-side API routes. It is not a .NET API, not a Windows service, and not a traditional ASP.NET app.
- Main entry point files are:
  - `package.json`
  - `src/app/layout.tsx`
  - `middleware.ts`
  - `src/app/(authed)/layout.tsx`
- There is no `Program.cs` in this repo.
- There are no `appsettings.json` files in this repo.
- There is no Entity Framework `DbContext` in this repo. Database access is done through Supabase clients and SQL migrations.

## 2. Important Files

### startup/config
- `package.json`
  - Defines this as a Next.js app and shows the main dependencies: Next.js, React, Supabase, and Stripe.
- `src/app/layout.tsx`
  - Root application layout for the web app.
- `middleware.ts`
  - Global request gate for page routes. Redirects unauthenticated users to `/login` for non-public pages.
- `src/app/(authed)/layout.tsx`
  - Main authenticated shell. Checks login state, checks platform admin status, and enforces MFA for platform admins.
- `src/lib/supabase/server.ts`
  - Creates the Supabase server client using cookies.
- `src/lib/supabase/admin.ts`
  - Creates the Supabase service-role admin client used for privileged reads and writes.
- `src/lib/stripe/server.ts`
  - Initializes the Stripe server SDK and requires Stripe secret values.
- `src/app/(authed)/status/page.tsx`
  - Internal status page that checks whether key environment variables are present and shows some system counts.

### database
- `supabase/migrations/20260207034620_remote_schema.sql`
  - Main checked-in schema snapshot. Defines many tables including `rb_shops`, `rb_shop_members`, `rb_devices`, `rb_device_activation_tokens`, `rb_control_admins`, audit tables, messages, employees, and more.
- `supabase/migrations/20260207040000_device_health.sql`
  - Adds device health fields and a check-in function for device version reporting.
- `src/lib/rb.ts`
  - Helper file for reading shops, devices, update policy, purchase orders, and components from Supabase.
- `src/app/api/admin/schema-summary/route.ts`
  - Admin-only endpoint that checks table counts to confirm schema presence.

### controllers/endpoints
- `src/app/api/billing/create-checkout/route.ts`
  - Creates a Stripe checkout session for a shop subscription.
- `src/app/api/billing/create-portal/route.ts`
  - Opens the Stripe billing portal for an existing customer.
- `src/app/api/billing/shop-status/route.ts`
  - Reads a shop's billing fields from `rb_shops`.
- `src/app/api/billing/webhook/route.ts`
  - Stripe webhook receiver.
- `src/app/api/billing/sync-from-session/route.ts`
  - Syncs billing data from a Stripe checkout session into `rb_shops`.
- `src/app/api/billing/sync-from-session-browser/route.ts`
  - Browser-facing wrapper that forwards into the session sync route.
- `src/app/api/billing/sync-from-checkout-return/route.ts`
  - Public checkout return sync used by the desktop flow.
- `src/app/api/billing/backfill-period-end/route.ts`
  - Admin-only backfill endpoint that repopulates billing period end data from Stripe.
- `src/app/api/billing/debug-session/route.ts`
  - Admin-only debug endpoint for inspecting a Stripe checkout session and linked subscription.
- `src/app/api/device/checkin/route.ts`
  - Device bearer-token check-in endpoint.
- `src/app/api/device/validate-token/route.ts`
  - Validates a device token and enforces update policy.
- `src/app/api/device/activate/route.ts`
  - Consumes one-time activation tokens.
- `src/app/api/device/create/route.ts`
  - Creates a device record.
- `src/app/api/device/list/route.ts`
  - Lists devices and device tokens for admins.
- `src/app/api/device/issue-token/route.ts`
  - Issues or rotates bearer tokens for devices.
- `src/app/api/device/enroll-token/route.ts`
  - Issues one-time desktop enrollment tokens.
- `src/app/api/device/revoke-token/route.ts`
  - Revokes a device bearer token.
- `src/app/api/device/set-status/route.ts`
  - Enables or disables a device.
- `src/app/api/device/update/route.ts`
  - Legacy device update endpoint using device key authentication instead of bearer token authentication.
- `src/app/api/device/admin/route.ts`
  - Admin RPC wrapper for device actions.
- `src/app/api/desktop/bootstrap/route.ts`
  - Desktop-facing onboarding/bootstrap route for creating a shop and membership.
- `src/app/api/desktop/shop-status/route.ts`
  - Desktop-facing billing status endpoint.
- `src/app/api/desktop/create-checkout/route.ts`
  - Desktop-facing Stripe checkout starter.
- `src/app/api/desktop/issue-license/route.ts`
  - Desktop-facing license token issuer.
- `src/app/api/desktop/provision-employee/route.ts`
  - Desktop-facing employee provisioning endpoint with seat-limit logic.
- `src/app/api/user/ensure-device-id/route.ts`
  - Creates a browser device-id cookie.
- `src/app/api/user/trust-device/route.ts`
  - Intended to mark a browser device as trusted after MFA.

### services
- `src/lib/authz.ts`
  - Central authorization helper layer. Includes MFA checks, platform admin checks, shop access checks, and billing write enforcement logic.
- `src/lib/desktopAuth.ts`
  - Validates bearer tokens for desktop-origin API requests using Supabase Auth.
- `src/lib/device/tokens.ts`
  - Generates raw device tokens and hashes them.
- `src/lib/security/rateLimit.ts`
  - Request rate limiting helper.
- `src/lib/audit/writeAudit.ts`
  - Audit write helper used by device routes and other admin actions.
- `src/lib/platformAdmin.ts`
  - Email allowlist helper for platform admins.

### billing/webhooks
- `src/lib/stripe/server.ts`
  - Stripe SDK setup.
- `src/app/api/billing/webhook/route.ts`
  - Main webhook route.
- `src/app/api/billing/create-checkout/route.ts`
  - Starts Stripe subscription checkout.
- `src/app/api/billing/create-portal/route.ts`
  - Opens Stripe billing portal.
- `src/app/api/billing/shop-status/route.ts`
  - Reads billing state from the shop record.
- `src/app/api/billing/sync-from-session/route.ts`
  - Writes Stripe checkout results into the database.
- `src/app/api/billing/sync-from-checkout-return/route.ts`
  - Public return-page sync for desktop checkout.
- `src/app/api/billing/backfill-period-end/route.ts`
  - Maintenance route for billing period end repair.
- `src/app/(authed)/shops/[shopId]/billing/page.tsx`
  - Billing UI page inside Control.
- `src/components/billing/BillingGate.tsx`
  - Client-side billing gate wrapper.
- `src/components/billing/WriteLock.tsx`
  - Client-side write blocking overlay.

### licensing/auth
- `middleware.ts`
  - Session gate for page routes.
- `src/app/(authed)/layout.tsx`
  - Enforces platform-admin MFA.
- `src/app/mfa/page.tsx`
  - MFA verification page.
- `src/components/EnableMFAClient.tsx`
  - Starts MFA enrollment from the UI.
- `src/app/api/user/ensure-device-id/route.ts`
  - Creates browser device cookie used by trust checks.
- `src/app/api/user/trust-device/route.ts`
  - Intended trusted-device route.
- `src/app/api/desktop/issue-license/route.ts`
  - Returns a signed license token for desktop.
- `src/lib/desktopAuth.ts`
  - Bearer-token auth for desktop API calls.
- `src/lib/authz.ts`
  - Central auth and billing authorization logic.

### device tracking
- `src/app/api/device/checkin/route.ts`
  - Device heartbeat/check-in using bearer token.
- `src/app/api/device/validate-token/route.ts`
  - Device token validation plus update policy enforcement.
- `src/app/api/device/activate/route.ts`
  - One-time activation token consumption.
- `src/app/api/device/create/route.ts`
  - Creates devices.
- `src/app/api/device/list/route.ts`
  - Lists devices plus token status.
- `src/app/api/device/issue-token/route.ts`
  - Issues rotated bearer tokens.
- `src/app/api/device/enroll-token/route.ts`
  - Issues enroll tokens through a database RPC.
- `src/app/api/device/revoke-token/route.ts`
  - Revokes active tokens.
- `src/app/api/device/set-status/route.ts`
  - Marks device active or disabled.
- `src/app/api/device/update/route.ts`
  - Legacy update route using old device-key authentication.
- `src/app/(authed)/devices/page.tsx`
  - Main admin UI for devices.
- `src/components/EnrollTokenPanel.tsx`
  - UI for generating desktop enroll tokens.
- `src/components/DeviceActionsTableClient.tsx`
  - UI for admin device actions.
- `src/components/DeviceIdBootstrap.tsx`
  - Browser helper for generating a local device-id cookie.

## 3. Current Licensing Flow
Based on the code, licensing today is partly shop-based and partly device-token based.

How a customer gets recognized:
- In the web app, users are recognized through Supabase Auth sessions in `middleware.ts`, `src/app/(authed)/layout.tsx`, and `src/lib/supabase/server.ts`.
- For desktop-origin API calls, users are recognized through bearer tokens in `src/lib/desktopAuth.ts`.
- Shops are recognized by `shop_id` values passed into routes like:
  - `src/app/api/billing/shop-status/route.ts`
  - `src/app/api/desktop/shop-status/route.ts`
  - `src/app/api/desktop/issue-license/route.ts`
- Shop membership is checked through the `rb_shop_members` table in:
  - `src/lib/authz.ts`
  - `src/app/api/desktop/shop-status/route.ts`
  - `src/app/api/desktop/issue-license/route.ts`
  - `src/app/api/desktop/create-checkout/route.ts`

How the system knows if a subscription is active, expired, canceled, or past due:
- The code expects billing state to live on the `rb_shops` table.
- The main expected fields are:
  - `billing_status`
  - `billing_current_period_end`
  - `stripe_customer_id`
  - `stripe_subscription_id`
- Billing state is checked in:
  - `src/lib/authz.ts`
  - `src/app/api/billing/shop-status/route.ts`
  - `src/app/api/desktop/shop-status/route.ts`
  - `src/app/api/desktop/issue-license/route.ts`
  - `src/components/billing/BillingGate.tsx`
- The code considers `trialing` and `active` to be good states.
- `src/lib/authz.ts` and `src/components/billing/BillingGate.tsx` also use `billing_current_period_end` as a grace-style fallback.
- Webhook code in `src/app/api/billing/webhook/route.ts` can write statuses like:
  - `trialing`
  - `active`
  - `past_due`
  - `canceled`
  - whatever Stripe subscription status currently is on the subscription object

What database fields or models are involved:
- `rb_shops.billing_status`
- `rb_shops.billing_current_period_end`
- `rb_shops.stripe_customer_id`
- `rb_shops.stripe_subscription_id`
- `rb_shop_members.shop_id`
- `rb_shop_members.user_id`
- `rb_control_admins.user_id`
- Device-side licensing also uses:
  - `rb_devices`
  - `rb_device_tokens`
  - `rb_device_activation_tokens`
- Signed desktop licenses are created in `src/app/api/desktop/issue-license/route.ts`, but there is no verification logic in this repo that proves how the desktop app consumes that token.

What API endpoints are used:
- `src/app/api/billing/shop-status/route.ts`
- `src/app/api/desktop/shop-status/route.ts`
- `src/app/api/desktop/issue-license/route.ts`
- `src/app/api/billing/webhook/route.ts`
- `src/app/api/billing/sync-from-session/route.ts`
- `src/app/api/billing/sync-from-checkout-return/route.ts`

Important truth about current licensing:
- The repo has real shop-level billing checks and real device-token validation.
- The repo does not show a complete server-enforced "desktop app must present signed license token on every protected request" model.
- The signed desktop license token exists, but the repo does not show a full closed-loop validation system using that token as the main source of truth.

## 4. Current Billing / Subscription Flow
Is Stripe integrated:
- Yes. Stripe is clearly integrated.
- Main Stripe setup is in `src/lib/stripe/server.ts`.
- Checkout creation is in `src/app/api/billing/create-checkout/route.ts`.
- Billing portal creation is in `src/app/api/billing/create-portal/route.ts`.
- Webhooks are handled in `src/app/api/billing/webhook/route.ts`.

Are webhooks implemented:
- Yes, a webhook route exists.
- It verifies Stripe signatures using `STRIPE_WEBHOOK_SECRET`.
- It uses `rb_webhook_events` for idempotency if that table exists.
- If `rb_webhook_events` does not exist, webhook processing still continues.

Which webhook events are handled:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

What happens in code when payment succeeds:
- On checkout completion, the webhook tries to:
  - find the shop from `client_reference_id` or `metadata.shop_id`
  - retrieve the Stripe subscription
  - stamp the subscription metadata with `shop_id`
  - update `rb_shops` billing fields
- Similar sync also happens through:
  - `src/app/api/billing/sync-from-session/route.ts`
  - `src/app/api/billing/sync-from-checkout-return/route.ts`

What happens in code when payment fails:
- I did not find a dedicated webhook handler for payment failure events such as:
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`
  - `customer.subscription.paused`
  - `invoice.marked_uncollectible`
- The system appears to depend mostly on `customer.subscription.updated` status changes and the values returned by Stripe subscriptions.
- That means failed-payment behavior is only as accurate as the subscription status updates that Stripe later sends.

What happens when a subscription lapses:
- Webhook code can store non-active states like `past_due` or `canceled` in `rb_shops.billing_status`.
- `src/lib/authz.ts` blocks write operations in hard/hybrid billing modes if billing is not active and not within grace.
- `src/components/billing/BillingGate.tsx` can put the UI into blocked, read-only, or overlay mode depending on the configured billing gate mode.
- `src/app/api/desktop/issue-license/route.ts` only allows license issuance if status is `active` or `trialing`.
- `src/app/api/desktop/provision-employee/route.ts` also rejects provisioning if billing is not active.
- `src/app/api/desktop/shop-status/route.ts` does not itself block; it only reports status back to the caller.

Important billing limitation:
- The checked-in migration snapshot for `rb_shops` only defines:
  - `id`
  - `name`
  - `created_at`
- The code expects many more billing columns than the checked-in migration shows.
- That means either:
  1. the live database has extra columns that are not represented in the repo migration snapshot, or
  2. parts of the billing code will fail against a fresh database built only from the checked-in migrations.

## 5. Current Device / Machine Control
The system currently tracks some device information, but not full machine-license enforcement.

What is tracked:
- Device records in `rb_devices`
- One-time activation tokens in `rb_device_activation_tokens`
- Bearer tokens in `rb_device_tokens` (used heavily by code, but not clearly defined in the checked-in migration snapshot)
- Device status values such as `active` and `disabled`
- Device last-seen times and reported versions in:
  - `src/app/api/device/checkin/route.ts`
  - `src/app/api/device/validate-token/route.ts`
  - `supabase/migrations/20260207040000_device_health.sql`
- Update policy by shop in `rb_update_policy`
- Update packages in `rb_update_packages`

Whether the system tracks device IDs:
- Yes.
- Device records use `rb_devices.id`.
- Browser trust also uses a browser cookie `rb_device_id`, but that is separate from enrolled desktop devices.

Whether the system tracks machine fingerprints:
- Not in a strong hardware-fingerprint sense.
- I did not find hardware fingerprint collection or hardware-bound license enforcement.
- The system tracks logical device IDs and tokens, not true hardware signatures.

Whether the system tracks seat counts:
- Partly.
- `src/app/api/desktop/provision-employee/route.ts` has seat-count logic using expected fields:
  - `included_user_seats`
  - `purchased_extra_user_seats`
- If those fields are missing, the code falls back to a default seat limit from env or `20`.
- This is user-seat logic, not device-seat logic.

Whether the system tracks activation limits:
- Not as a full customer-facing license-seat enforcement model.
- There are one-time activation tokens and device status controls.
- There is not a clear "this shop may activate only N desktop devices" enforcement path in the code I inspected.

Whether the system tracks concurrent usage:
- I did not find a true concurrent usage enforcement system.
- The code stores last-seen timestamps and token activity.
- That is operational tracking, not a hard concurrency limiter.

What is fully enforced versus only stored:
- Fully enforced:
  - Device token must be valid in `src/app/api/device/checkin/route.ts`
  - Revoked device tokens are rejected
  - Disabled devices are rejected by device check-in and validation routes
  - Update policy can block a device in `src/app/api/device/validate-token/route.ts`
- Only stored or partially enforced:
  - Last-seen times
  - Reported versions
  - Seat counts are enforced for employee provisioning, but not clearly for device activations
  - No hard concurrent-usage enforcement was found
  - No true hardware fingerprint enforcement was found

## 6. Current Desktop App Validation Flow
This repo does contain desktop-related validation logic.

When validation happens:
- For device token validation, the main route is `src/app/api/device/validate-token/route.ts`.
- For device check-in/heartbeat, the main route is `src/app/api/device/checkin/route.ts`.
- For desktop billing status polling, the main route is `src/app/api/desktop/shop-status/route.ts`.
- For desktop license issuance, the main route is `src/app/api/desktop/issue-license/route.ts`.

What endpoint is called:
- Device validation:
  - `src/app/api/device/validate-token/route.ts`
- Device heartbeat:
  - `src/app/api/device/checkin/route.ts`
- Desktop billing status:
  - `src/app/api/desktop/shop-status/route.ts`
- Desktop checkout:
  - `src/app/api/desktop/create-checkout/route.ts`
- Desktop bootstrap/onboarding:
  - `src/app/api/desktop/bootstrap/route.ts`
- Desktop signed license issue:
  - `src/app/api/desktop/issue-license/route.ts`

What is stored locally:
- In this repo, I only found browser-side local state for the web app and a browser cookie `rb_device_id` from `src/app/api/user/ensure-device-id/route.ts`.
- I did not find the actual desktop app's local storage logic in this repo.
- So I cannot confirm what the Windows desktop app stores locally from this repo alone.

Whether offline grace exists:
- I did not find desktop offline grace logic in this repo.
- `src/components/billing/BillingGate.tsx` and `src/lib/authz.ts` implement grace around `billing_current_period_end`, but that is server-side billing logic, not offline desktop logic.
- There is no clear desktop-side local grace cache implementation in this repo.

What happens if validation fails:
- Device token invalid or revoked:
  - request is rejected with 401 or 403 in `src/app/api/device/validate-token/route.ts` and `src/app/api/device/checkin/route.ts`
- Device inactive:
  - rejected with 403
- Version below minimum or not pinned:
  - rejected with `error: "update_required"` and 403 in `src/app/api/device/validate-token/route.ts`
- Billing not active for desktop license issue:
  - `src/app/api/desktop/issue-license/route.ts` returns 402
- Desktop shop status route itself does not block access; it only reports state

Important desktop validation limitation:
- I do not see proof in this repo that every desktop action is server-gated by a signed license token.
- The stronger enforcement path today appears to be the device token plus billing-status checks on selected endpoints, not a fully centralized desktop license server model.

## 7. Access Control Truth Table

| Case | Current behavior | Notes |
| --- | --- | --- |
| active subscription | full access | Billing checks treat `active` as allowed in `src/lib/authz.ts`, `src/components/billing/BillingGate.tsx`, and `src/app/api/desktop/issue-license/route.ts`. |
| past due | restricted access | Web UI can become read-only or blocked depending on billing mode. Desktop license issue route blocks because it only allows `active` or `trialing`. |
| canceled | restricted access | Same general pattern as past due. If outside grace, write actions are blocked. |
| expired | unknown / partially implemented | There is no explicit `expired` state handler in code. It would likely behave as a non-active billing state if written into `billing_status`. |
| no internet | unknown / not implemented | I did not find a full offline-control policy in this repo for desktop licensing. |
| first install | restricted access | Desktop can bootstrap shop creation and can enroll devices, but a full first-install licensing sequence depends on external desktop behavior not shown here. |
| expired local cache | unknown / not implemented | I did not find local desktop cache validation logic in this repo. |
| unknown device | blocked | Device token validation and check-in reject unknown tokens/devices. |

Plain-English explanation:
- The server clearly knows how to allow or block based on shop billing state for some routes.
- Unknown or invalid devices are blocked.
- There is not enough code here to claim a complete offline or cached desktop enforcement system.

## 8. What Is Already Implemented
- A real Next.js control app exists with authenticated and admin-only areas.
- Supabase authentication is integrated.
- Platform admin checks exist through `rb_control_admins` and MFA gating.
- Stripe is integrated for checkout and billing portal access.
- A Stripe webhook route exists and updates shop billing state.
- Desktop-facing billing routes exist.
- Device creation, activation, token issuance, revocation, status changes, and check-ins exist.
- Device update policy enforcement exists in `src/app/api/device/validate-token/route.ts`.
- Audit logging is present in many device and admin routes.
- There is user-seat logic in `src/app/api/desktop/provision-employee/route.ts`.
- Client-side billing gates exist through `src/components/billing/BillingGate.tsx` and `src/components/billing/WriteLock.tsx`.

## 9. What Is Partially Implemented
- Shop billing enforcement exists, but not all routes appear uniformly enforced through one single source of truth.
- Desktop license issuing exists, but the repo does not show the full lifecycle of validating that token afterward.
- Grace-period logic exists in web-side helpers, but desktop enforcement does not appear to use the same full grace logic consistently.
- Device tracking is real, but there is no strong hardware fingerprinting.
- Seat logic exists for employee provisioning, but not clearly for device activation counts.
- Webhook idempotency exists only if `rb_webhook_events` exists.
- Trusted-device MFA bypass appears intended, but the current implementation looks broken:
  - `ensure-device-id` creates a random hex cookie, not a UUID
  - `trust-device` expects `device_id` in the request body and validates it as a UUID
  - `mfa/page.tsx` calls `/api/user/trust-device` without sending a body
- The repo expects billing columns on `rb_shops`, but the checked-in migration snapshot does not show them.
- The repo expects `rb_device_tokens`, `rb_trusted_devices`, and `rb_webhook_events`, but those were not clearly found in the checked-in migrations I inspected.

## 10. What Is Missing Completely
- A checked-in migration set that clearly matches the billing fields the code expects today.
- A complete, clearly enforced device-seat limit model for shops.
- A clearly documented and enforced concurrent desktop usage limit.
- True machine fingerprint or hardware-bound license enforcement.
- A visible full offline validation/grace model for the desktop app.
- A clearly complete signed-license verification loop on the server side.
- Dedicated webhook handling for payment failure events such as `invoice.payment_failed`.
- A single owner-readable licensing state machine documented in the repo.

## 11. What Looks Risky or Easy To Bypass
- The checked-in migration snapshot does not match the billing code's expected columns. That is risky because a fresh deployment may not behave like production.
- The trusted-device MFA bypass looks inconsistent and likely broken because the cookie format and route expectations do not match.
- `src/app/api/device/update/route.ts` still supports a legacy `deviceKey` path and the file itself says it should eventually be removed. That is a weaker older path compared with bearer-token device auth.
- `src/app/api/desktop/issue-license/route.ts` signs a token, but I did not find the full verification path in this repo. That means the signed token may not be the real enforcement mechanism yet.
- There is no clear hardware fingerprint enforcement, so device identity appears to depend on logical records and tokens, not physical machine identity.
- There is no clear concurrent-seat enforcement for devices.
- Webhook idempotency depends on a table that may or may not exist.
- Some security and business rules are implemented in client-side UI helpers like `BillingGate.tsx`. UI gating is useful, but server-side rules are the real protection. The repo has some server-side protection, but it is not yet obviously complete everywhere.
- `src/app/api/desktop/bootstrap/route.ts` currently creates a new shop with `billing_status: "active"`. That is a major business risk if production relies on that value for access control. It means a newly bootstrapped shop can start in an active state before Stripe checkout is completed.

## 12. Recommended Next Build Order
1. Reconcile the database schema with the current code.
   - Make sure the checked-in Supabase migrations clearly include every billing, device-token, trusted-device, and webhook table/column the code expects.
2. Define one server-side billing source of truth.
   - Decide exactly which `rb_shops` fields represent billing state and make every protected route use the same rules.
3. Fix the trusted-device MFA flow.
   - Make the browser device-id format, cookie behavior, and `trust-device` endpoint agree with each other.
4. Remove or replace the legacy device-key validation path.
   - Finish the move to bearer-token device auth only.
5. Decide and enforce device-seat limits.
   - Add clear shop-level limits for how many desktop devices can be active.
6. Decide and enforce desktop license validation rules.
   - If signed desktop license tokens are the intended model, wire them into a full validation path and expiration strategy.
7. Add explicit billing failure webhook handling.
   - Handle events like payment failure and subscription payment problems directly, not only indirect status changes.
8. Add a real offline and grace policy for desktop.
   - Define what happens on no internet, expired cache, or stale last validation.
9. Write a plain-English owner document describing the actual control rules.
   - This should explain what gets blocked, what becomes read-only, and what remains available.

## 13. Executive Summary For Owner
- This repo already has real building blocks for RunBook Control: web login, platform admin access, MFA, Stripe checkout, a webhook route, shop billing status fields in code, desktop-facing endpoints, and device registration/check-in logic.
- What it does not yet have in a clean finished form is a fully unified, clearly enforced licensing system that you could trust as the final "single source of truth" for unpaid users, device counts, offline handling, and desktop license validation.
- Based on this repo alone, RunBook Control can already restrict some unpaid users and block some actions, especially writes and some desktop routes. But it is not yet a fully finished, easy-to-audit control system.
- The next most important step is to reconcile the database schema with the code and then lock billing/device/license enforcement into one consistent server-side model.
