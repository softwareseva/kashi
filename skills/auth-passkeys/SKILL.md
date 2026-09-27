---
name: auth-passkeys
description: Passkeys (WebAuthn) with @softwareseva/auth and @simplewebauthn/server 14 as the default, anonymous sign-in and sign-up method, covering contact-free account creation, registration for signed-in users, discoverable usernameless sign-in, credential listing with the domain each key is tied to, renaming and removal, and RP ID and origin rules for web, iOS and Android set up ahead of the app's first release. Use when adding passkey sign-in or sign-up, a "manage passkeys" screen, fixing "RP ID mismatch" or origin errors, or supporting passkeys in a Flutter app.
license: MIT
metadata:
  version: "0.2.0"
  packages: "@softwareseva/auth@1.2 @simplewebauthn/server@14 @simplewebauthn/browser@14"
---

# Passkeys

Passkeys replace passwords with a key pair held by the user's device or password manager. `@softwareseva/auth` handles challenges (stored in D1, single use, 5 minutes), verification, counters and storage. Sign-in is **discoverable**: the browser shows the passkeys it holds for your site, so no username is sent first and nothing about accounts leaks. Passkeys are the recommended default entry point for the whole app — see `auth-sessions` for how sign-up stays anonymous and only specific actions ask for a valid id.

## Enable

1. `pnpm add @simplewebauthn/server` (server) and `@simplewebauthn/browser` (web).
2. `providers: { passkeys: {} }` and vars `RP_ID` (registrable domain, e.g. `example.com`) and `RP_NAME` (shown in the prompt). `allowSignUp: false` turns off contact-free account creation and keeps passkeys as a second factor added after an OTP/OAuth sign-up.
3. `WEB_ORIGIN(S)` lists the exact origins allowed to use the passkeys (`https://app.example.com`). Android apps add `extraOrigins: ["android:apk-key-hash:<base64url sha256 of signing cert>"]`.
4. Decide `RP_ID` before the first release (see **RP ID rules** below) and wire the Flutter app's Associated Domains / asset-links config to it at project setup — this can and should happen before any user has signed in.

## Flows

- **Sign up (contact-free, no auth)**: `POST /passkeys/signup/options` then `startRegistration()` then `POST /passkeys/signup/verify { challengeId, response, deviceName, name? }`. The passkey is verified **first**; the account is created only if verification succeeds, and the user row + credential are written in one D1 batch (`AuthStore.createUserWithPasskey`), so a rejected or abandoned registration never leaves a stray account, and a verified passkey is never left without one. No email, phone or OAuth grant is involved — this is how auth stays anonymous by default. React: `usePasskeySignUp()` or `<PasskeySignUpButton />`. Disable with `providers.passkeys.allowSignUp = false`.
- **Register another key** (signed in): `POST /passkeys/register/options` then `startRegistration()` in the browser then `POST /passkeys/register/verify { challengeId, response, deviceName }`. React: `usePasskeyRegister().run()`.
- **Sign in**: `POST /passkeys/authenticate/options` then `startAuthentication()` then `POST /passkeys/authenticate/verify { challengeId, response, transport? }`. React: `<PasskeyButton />` or `usePasskeySignIn()`.
- **Manage**: `GET /passkeys` (each item includes `deviceName` and `rpId` — the domain it was created for, so a multi-domain app can show users which key works where), `PATCH /passkeys/:id { deviceName }` to let a user name their own key, `DELETE /passkeys/:id`.

For an app that still offers OTP or OAuth as a *sign-up* path, offer passkey registration right after that first sign-in, then prefer passkeys on later visits. Keep a fallback (OTP) for new devices either way.

## RP ID rules (read before shipping)

- `RP_ID` is fixed forever once users have passkeys. Changing it orphans every credential. Pick it during project setup, not after the first release.
- It must be the page's host or a parent domain: `RP_ID=example.com` works on `app.example.com` and `example.com`; it cannot be `example.org` or a public suffix.
- iOS and Android apps share web passkeys only with association files on `https://<RP_ID>/.well-known/`: `apple-app-site-association` (`webcredentials: { apps: ["TEAMID.com.example.app"] }`) and `assetlinks.json` (`delegate_permission/common.get_login_creds`). **This is set up a priori**: the app's Associated Domains entitlement (iOS) and asset-links intent filter (Android) are static config that only need `RP_ID` and the app's bundle id / package name + signing certs — none of it needs a signed-in user, a deployed passkey, or even the `.well-known` files to be live yet (build fails soft; the OS just can't verify until they are). Wire both at the same time you set `RP_ID`. See `references/rp-id.md`.
- Local development: `RP_ID=localhost`, origin `http://localhost:5173`.

## Pitfalls

- "The RP ID is invalid for this domain": `RP_ID` is not a suffix of the page host.
- "Unexpected registration response origin": the page origin is missing from `WEB_ORIGIN(S)`.
- Registration must happen from the same site as sign-in; a passkey created on `localhost` does not work in production.
- Counters of synced passkeys stay 0; that is normal and accepted.
- `CHALLENGE_EXPIRED` on `/passkeys/signup/verify`: the 5-minute challenge window closed (slow biometric prompt, backgrounded app) — call `/passkeys/signup/options` again, do not retry with the same `challengeId`.
