# Control administrator authenticator flow

Privileged Control pages and write routes require actual AAL2. A trusted-device record does not substitute for this assurance. Step-up preserves an allowed local Control page/query and returns there after verification; actions are submitted again by the user.

An authenticated platform administrator without a verified TOTP factor can start setup on the MFA page. Settings uses the same component. Setup begins only after an explicit click. The provider QR and manual setup key remain in component memory and are not logged, persisted or sent to image services.

The flow uses the pinned Supabase client enrollment, challenge, verification, session refresh and assurance APIs. Successful verification clears the setup key before further network calls; navigation requires the same account and AAL2. Verifying a new factor signs out other RunBook sessions.

Cancel removes only a listed unverified TOTP factor for the same current account. Verified factors are never removed by setup cancellation. Old unfinished setups can be explicitly canceled before retry. Navigating away may leave an unverified provider factor; the next visit offers that cancellation without retaining its QR/key.

No provider setting, live factor or account was changed by implementing or testing this source.

Manual CI runs `node scripts/verify-control-mfa-stepup.js` and `node scripts/verify-control-mfa-enrollment.js` against actual source handlers with synthetic auth/network boundaries. These checks do not certify production provider configuration.

References: [Supabase TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp), [unenroll contract](https://supabase.com/docs/reference/javascript/auth-mfa-unenroll).
