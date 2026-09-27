---
name: auth-apple
description: Sign in with Apple for web and iOS with @softwareseva/auth, including the ES256 client secret, form_post callback, ID-token verification against Apple's keys, private relay emails and first-login names. Use when adding "Sign in with Apple", configuring the Services ID and key in Apple Developer, verifying identity tokens from sign_in_with_apple in Flutter, or debugging Apple callback errors.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/auth@1.2"
---

# Sign in with Apple

Apple is required by App Store review when an iOS app offers any other third-party sign-in. `@softwareseva/auth` implements it without SDKs:

- **Web**: `GET /v1/auth/apple/start?next=/` redirects to Apple with `response_mode=form_post`. Apple POSTs a form to `/v1/auth/apple/callback`; the router exchanges the code (with a freshly minted ES256 client secret), verifies the ID token against `https://appleid.apple.com/auth/keys`, signs in with cookies and redirects to `APP_ORIGIN + next`.
- **Native**: the app gets an `identityToken` from `sign_in_with_apple` and posts `POST /v1/auth/apple/token { idToken, name?, transport: "token" }`.

## Setup (Apple Developer)

1. **App ID** (iOS): enable the *Sign in with Apple* capability. Its bundle id goes in `APPLE_BUNDLE_IDS`.
2. **Services ID** (web), for example `com.example.web`: enable Sign in with Apple, configure the primary App ID, add your web domain and the return URL `${AUTH_URL}/apple/callback`. This is `APPLE_CLIENT_ID`.
3. **Key**: Keys > + > enable Sign in with Apple > download `AuthKey_XXXXXXXXXX.p8` (downloadable once). Its id is `APPLE_KEY_ID`; your team id is `APPLE_TEAM_ID`.
4. Store the key: `wrangler secret put APPLE_PRIVATE_KEY < AuthKey_XXXX.p8`; for local dev put it in `.dev.vars` with `\n` line breaks. Never commit the `.p8` (the kashi `.gitignore` excludes `*.p8`).
5. Enable: `providers: { apple: {} }`.

Details and screenshots of the order of operations: `references/apple-setup.md`.

## What Apple sends, and when

- `sub` is stable per team. Use it, not email, as the identity (`auth_identities`).
- Email arrives only on the **first** authorisation (later sign-ins omit it), and may be a private relay address `...@privaterelay.appleid.com`. Relay addresses are verified; to email them, register your sending domain under *Sign in with Apple for Email Communication*.
- The user's name arrives only on the first authorisation: on web as the `user` form field (the router stores it), on iOS in the credential's `givenName`/`familyName` (send it as `name`).
- If a user revokes the app in Settings and signs in again, Apple sends email and name again.

## Pitfalls

- `invalid_client`: wrong key id, team id, Services ID, or a `.p8` pasted without its BEGIN/END lines.
- The callback is a cross-site POST, so it cannot rely on existing cookies. State is a signed JWT instead of a cookie; the session cookie is set on the callback response and survives the redirect because it is `SameSite=Lax` and the redirect is a top-level GET.
- Native audience is the **bundle id**, web audience is the **Services ID**. Both must be listed or verification fails with `apple_id_token_wrong_audience`.
- Apple does not allow `localhost` return URLs; test the web flow on a deployed preview or a tunnel.

Native wiring: see `flutter-auth`. Threat notes: `references/apple-setup.md`.
