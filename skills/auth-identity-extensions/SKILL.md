---
name: auth-identity-extensions
description: Opt-in identity extensions for @softwareseva/auth — multi-channel purpose-bound OTP (otpChannels), explicit account linking with collision handling, hashed recovery codes, session-family revocation, and federation hooks. Use when a sign-in-and-verify flow (like WhatsApp/SMS OTP or Google) needs a second, independently-bound purpose (linking a contact to an existing account, not just signing in), when two identities might collide and should require explicit confirmation instead of silently merging, when adding recovery codes or "sign out everywhere" that takes effect immediately, or when a central/consumer app needs to hook into federation claims or session validation.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/auth@1.5"
---

# Identity extensions

Everything here is opt-in and additive on top of `auth-sessions`/`auth-whatsapp-otp`/`auth-google`/`auth-federation`: a config that sets none of these keys keeps its exact pre-1.5 behavior. Apply `auth_0007_identity_extensions.sql` before enabling any of it (adds `auth_bound_otp`, `auth_recovery_codes`, `auth_peer_sessions`, `auth_contact_aliases`).

## Multi-channel OTP (`otpChannels`)

`providers.otp` is one channel per config. `otpChannels` lets an app run several at once, each bound to `(channel, purpose, destination, user)` so a sign-in code can never be replayed to link a contact, or vice versa:

```ts
otpChannels: {
  email: { channel: "email", send: sendEmailOtp },
  phone: { channel: "phone", send: sendPhoneOtp, defaultCountry: "IN" },
}
```

- `POST /otp/request` / `POST /otp/verify` (sign-in, public) — these paths are **shared** with the legacy `providers.otp`: a request whose `channel` isn't configured in `otpChannels` falls through to it, so both can coexist during a migration.
- `POST /contacts/otp/request` / `POST /contacts/otp/verify` (authenticated, requires a recent session — see below) attach a verified email or phone to the signed-in account, rejecting with `409 ACCOUNT_MERGE_REQUIRED` if that contact already belongs to a different account.
- The `send` callback is the same `OtpProviderConfig["send"]` as `providers.otp`: `(env, destination, code, c, { purpose, ttlSeconds })`, `purpose` being `"sign-in"` or `"link"`. Pipe it into `renderOtpEmail({ code, purpose, ttlSeconds })` for email (`auth-whatsapp-otp` covers WhatsApp/SMS senders).

## Explicit linking (`identityExtensions`)

Set `identityExtensions: true` to mount:

- `POST /recovery/codes` (requires a recent session) — issues 10 single-use codes, hashed at rest, returned once. `POST /recovery/sign-in { code }` — signs in and consumes it.
- With `providers.google` also set: `GET /google/link/start` / `GET /google/link/callback` — an *authenticated* user links a Google identity to their current account. Any collision (the Google subject, or its verified email, already belongs to a different account) redirects back with `error=ACCOUNT_MERGE_REQUIRED` instead of silently merging.
- The passkey-deletion guard: `DELETE /passkeys/:id` refuses with `409 LAST_AUTH_METHOD` if that's the account's only passkey and it has no unused recovery code, no verified email/phone, and no other linked identity.
- `recoveryCodesOnSignup: true` — contact-free passkey signup (`POST /passkeys/signup/verify`) also issues recovery codes, returned once as `recoveryCodes: string[]` in the signup response. Show them immediately; there is no way to recover the same batch later.

## Sign-in-time linking policy (`autoLinkVerifiedEmail`)

By default, a verified email from Google/Apple/Facebook/peer sign-in silently links to an existing account with that email — the pre-1.5 behavior. Set `autoLinkVerifiedEmail: false` to instead reject that sign-in with `409 ACCOUNT_MERGE_REQUIRED`, so linking only ever happens through the explicit, authenticated `/google/link/*` or `/contacts/otp/*` flows above. Use this where silent cross-provider merging would be a security concern (e.g. a central account service backing several apps).

## Session revocation (`enforceSessionRevocation`)

Refresh tokens are already grouped into families with reuse detection (see `auth-sessions`). `enforceSessionRevocation: true` makes `requireAuth` check on **every** request that the access token's family is still active, not just at refresh — so revoking a family (via `/logout-all`, or your own code calling `AuthStore.revokeFamily`) takes effect immediately instead of only once the access token expires (default 15 minutes).

## Federation hooks

Three hooks on `config.hooks`, layered on top of the ones in `auth-sessions`:

- `validateSession(user, familyId, c, env)` — called on every `requireAuth` request, after the local/family checks. Throw to reject a session your app considers invalid for reasons the package doesn't know about (e.g. checking a centrally-tracked session in a consumer app).
- `federationClaims(user, clientId, c, env)` — called from `/federation/token` (see `auth-federation`); return extra claims to merge into the signed ID token. The package's own claims (`sub`, `aud`, `iss`, ...) always win over anything returned here.
- `onFederationSession(user, claims, familyId, c, env)` — called once per peer sign-in (browser flow, `/peer/callback`), before the local session is issued. Use it to associate the peer identity with local state, typically `ExtensionStore.linkPeer(familyId, user.id, claims.subject, claims.sessionId ?? familyId)`.

## Public building blocks

Exported from `@softwareseva/auth/server` for app code that needs the same primitives directly:

- `ExtensionStore` — the store behind everything above: `identities(userId)`, `methods(userId)` (counts of every way back in, for a "security" screen), `recoveryCount(userId)`, `unlinkIdentity(id, userId)`, `linkPeer`/`peer`, `contactOwner(channel, destination)`.
- `requireRecent(c, env, config)` — the freshness gate used before issuing recovery codes or linking: throws `403 REAUTH_REQUIRED` unless the current session's family began within the last 5 minutes. Use it to gate your own sensitive routes the same way.
- `boundState(c, env, kind, data)` / `consumeBoundState(c, env, kind, id)` — single-use OAuth/federation state bound to a host-only browser cookie: the `state` value alone (e.g. leaked from a redirect URL) isn't enough to replay without the matching cookie, and it's consumed exactly once. Used by `/google/link/*`; reuse it for a custom linking flow.

## Pitfalls

- `otpChannels` and `providers.otp` sharing `/otp/*`: don't configure the same channel in both — pick one per channel, since whichever is checked first (`otpChannels`) wins for that channel.
- `ACCOUNT_MERGE_REQUIRED` is a signal, not a dead end: point the UI at "sign in to your other account and link explicitly" (`/contacts/otp/*` or `/google/link/*`), not a generic error.
- `REAUTH_REQUIRED` isn't a step-up prompt — it just means the *current session* isn't recent enough; the fix is signing in again, not re-entering a password inline.
- `LAST_AUTH_METHOD` only fires with `identityExtensions` on; without it, passkey deletion has no such guard (pre-1.5 behavior).
