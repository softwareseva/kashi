---
"@softwareseva/auth": minor
---

Add opt-in identity extensions, ported and hardened from a downstream fork: purpose- and destination-bound OTP over one or more channels at once (`otpChannels`, separate sign-in and authenticated contact-link challenges), explicit account-linking policy with collision handling (`identityExtensions`, `autoLinkVerifiedEmail`), hashed single-use recovery codes (optionally issued at contact-free passkey signup via `recoveryCodesOnSignup`), session-family revocation checks (`enforceSessionRevocation`), and generic hooks for session validation, federation claims and associating a peer sign-in with local state (`hooks.validateSession`/`federationClaims`/`onFederationSession`).

All of it is additive and off by default — a consumer that sets none of these config keys gets exactly 1.4.0's behavior, unchanged.

- `otpChannels` shares `/otp/request` and `/otp/verify` with the existing single-channel `providers.otp`: a request whose `channel` isn't configured in `otpChannels` falls through to the legacy handler, so both can coexist. `/contacts/otp/request` and `/contacts/otp/verify` are new, authenticated-only paths for linking a contact to the signed-in account. Every OTP sender (single- or multi-channel) receives the existing `{ purpose, ttlSeconds }` fifth argument; four-argument senders keep working unchanged.
- New exports from `@softwareseva/auth/server`: `ExtensionStore` (the store backing every extension above — `identities`, `methods`, `recoveryCount`, `linkPeer`/`peer`, etc.), `requireRecent` (a freshness gate for sensitive changes: issuing recovery codes, linking a contact or a Google identity), and `boundState`/`consumeBoundState` (single-use OAuth/federation state bound to a host-only browser cookie, used by `/google/link/*`).
- `GET /recovery/codes` → `POST /recovery/codes` and `POST /recovery/sign-in` (both behind `identityExtensions`); `GET /google/link/start` and `GET /google/link/callback` (behind `identityExtensions` + `providers.google`), which reject a colliding identity with `409 ACCOUNT_MERGE_REQUIRED` rather than silently linking.
- Deleting a passkey now checks (when `identityExtensions` is on) that the account has another way back in — another passkey, an unused recovery code, a verified email/phone, or a linked OAuth/peer identity — and refuses with `409 LAST_AUTH_METHOD` otherwise.
- `GET /federation/authorize` redirects an unauthenticated request to `federationLoginPath` (with `?next=`) when set, instead of a bare 401.

Apply `auth_0007_identity_extensions.sql` before enabling any of the above (adds `auth_bound_otp`, `auth_recovery_codes`, `auth_peer_sessions`, `auth_contact_aliases`).
