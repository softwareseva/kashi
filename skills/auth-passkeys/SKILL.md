---
name: auth-passkeys
description: Passkeys (WebAuthn) with @softwareseva/auth and @simplewebauthn/server 14, covering registration for signed-in users, discoverable usernameless sign-in, credential listing, renaming and removal, RP ID and origin rules for web, iOS and Android. Use when adding passkey sign-in, a "manage passkeys" screen, fixing "RP ID mismatch" or origin errors, or supporting passkeys in a Flutter app.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/auth@0.1 @simplewebauthn/server@14 @simplewebauthn/browser@14"
---

# Passkeys

Passkeys replace passwords with a key pair held by the user's device or password manager. `@softwareseva/auth` handles challenges (stored in D1, single use, 5 minutes), verification, counters and storage. Sign-in is **discoverable**: the browser shows the passkeys it holds for your site, so no username is sent first and nothing about accounts leaks.

## Enable

1. `pnpm add @simplewebauthn/server` (server) and `@simplewebauthn/browser` (web).
2. `providers: { passkeys: {} }` and vars `RP_ID` (registrable domain, e.g. `example.com`) and `RP_NAME` (shown in the prompt).
3. `WEB_ORIGIN(S)` lists the exact origins allowed to use the passkeys (`https://app.example.com`). Android apps add `extraOrigins: ["android:apk-key-hash:<base64url sha256 of signing cert>"]`.

## Flows

- **Register** (signed in): `POST /passkeys/register/options` then `startRegistration()` in the browser then `POST /passkeys/register/verify { challengeId, response, deviceName }`. React: `usePasskeyRegister().run()`.
- **Sign in**: `POST /passkeys/authenticate/options` then `startAuthentication()` then `POST /passkeys/authenticate/verify { challengeId, response, transport? }`. React: `<PasskeyButton />` or `usePasskeySignIn()`.
- **Manage**: `GET /passkeys`, `PATCH /passkeys/:id { deviceName }`, `DELETE /passkeys/:id`.

Offer passkey registration right after the first sign-in by another method (OTP, Google), then prefer passkeys on later visits. Keep a fallback (OTP) for new devices.

## RP ID rules (read before shipping)

- `RP_ID` is fixed forever once users have passkeys. Changing it orphans every credential.
- It must be the page's host or a parent domain: `RP_ID=example.com` works on `app.example.com` and `example.com`; it cannot be `example.org` or a public suffix.
- iOS and Android apps share web passkeys only with association files on `https://<RP_ID>/.well-known/`: `apple-app-site-association` (`webcredentials: { apps: ["TEAMID.com.example.app"] }`) and `assetlinks.json` (`delegate_permission/common.get_login_creds`). See `references/rp-id.md`.
- Local development: `RP_ID=localhost`, origin `http://localhost:5173`.

## Pitfalls

- "The RP ID is invalid for this domain": `RP_ID` is not a suffix of the page host.
- "Unexpected registration response origin": the page origin is missing from `WEB_ORIGIN(S)`.
- Registration must happen from the same site as sign-in; a passkey created on `localhost` does not work in production.
- Counters of synced passkeys stay 0; that is normal and accepted.
