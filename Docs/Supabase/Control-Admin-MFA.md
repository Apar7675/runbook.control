# Control administrator authenticator flow

Privileged Control pages and write routes require actual AAL2. A trusted-device record does not substitute for this assurance. Step-up preserves an allowed local Control page/query and returns there after verification; users submit the action again.

An authenticated platform administrator without a verified TOTP factor can start setup on the MFA page. Settings uses the same component. Setup begins after an explicit click. The QR and manual setup key remain in component memory and are not logged, persisted or sent to image services.

Enrollment and existing-factor verification capture one validated account/session. Provider calls use a separate, nonpersisting Supabase client seeded with that session; they cannot read a later account from the ordinary browser client. Both screens retire pending work when the signed-in session changes. Successful new-factor verification clears the setup key before session publication.

The returned AAL2 token pair is validated with the provider in an otherwise empty private client. Its storage adapter publishes only that exact pair to the existing SSR cookie format, after checking the original cookie snapshot and current UI operation inside the shared Control JavaScript cookie-writer Web Lock. The main client is never given a captured token pair. Other-account sign-in writes use the same writer and are not blocked by a promotion-specific guard. Browsers without Web Locks cannot complete this promotion and receive an error.

This lock coordinates Control JavaScript cookie writers. HTTP responses that set cookies are outside the lock; this is not an atomic transaction across all browser/server activity. The server still validates the resulting account, administrator permission and actual AAL2 for every privileged request. Stale or failed completion does not authorize an action; the user reloads or signs in again.

Close setup discards local QR/key state and stops its private client. It does not delete a provider factor or sign out the main session. Supabase has no conditional unverified-only deletion contract: an unverified check can race verification in another tab. Earlier unfinished factors remain on the account; setup uses a distinct friendly name, and the UI directs users to their account administrator if provider limits prevent another setup. This flow never removes verified factors. Verifying a new factor signs out other RunBook sessions according to provider policy.

No live provider setting, factor or account is changed by implementing or testing this source. This is Control administrative MFA; it adds no ordinary local module license gate.

Manual CI runs the step-up, enrollment and captured-session regression scripts. The session checks use the pinned real SDK and SSR cookie helpers with synthetic provider, browser cookie and Web Locks boundaries, including switches during response parsing and cookie-lock acquisition. These checks do not certify deployed provider configuration or HTTP cookie concurrency.

References:

- [Supabase TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [Supabase unenroll contract](https://supabase.com/docs/reference/javascript/auth-mfa-unenroll)
- [Pinned auth-js provider-session and persistence implementation](https://github.com/supabase/supabase-js/blob/9c9ca277684f8f31f8a9d2b485473f4ab81ef0e6/packages/core/auth-js/src/GoTrueClient.ts)
- [Pinned SSR public cookie helpers](https://github.com/supabase/ssr/tree/bcf502f757945554e3b9e4284f692fd0fd46915a/src)
