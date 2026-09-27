---
name: auth-google
description: Google sign-in for web and mobile with @softwareseva/auth, with no Google SDK on the server. Use when adding "Continue with Google", configuring the Google Cloud OAuth client and redirect URIs, verifying ID tokens from the Flutter google_sign_in plugin, or linking Google accounts to existing users by email.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/auth@1.2"
---

# Google sign-in

Two paths, one Google OAuth **Web** client:

- **Web**: `GET /v1/auth/google/start?next=/dashboard` redirects to Google with a signed, 10-minute `state`; Google returns to `/v1/auth/google/callback`, which exchanges the code, signs the user in with cookies and redirects to `APP_ORIGIN + next`. Failures redirect to `APP_ORIGIN/sign-in?error=CODE`.
- **Native**: the app obtains an ID token with `google_sign_in` (using the Web client id as `serverClientId`) and posts it to `POST /v1/auth/google/token { idToken, transport: "token" }`.

## Setup

1. Google Cloud Console > APIs & Services > OAuth consent screen: set app name, support email, authorised domains. Scopes: `openid`, `email`, `profile` only.
2. Credentials > Create OAuth client > **Web application**. Authorised redirect URI: `${AUTH_URL}/google/callback` for each environment (for example `https://api.example.com/v1/auth/google/callback` and `http://localhost:8787/v1/auth/google/callback`).
3. For mobile, also create **Android** (package name + SHA-1 of each signing key) and **iOS** (bundle id) clients. They are not used by the server; they let the plugin run.
4. Secrets: `GOOGLE_CLIENT_ID` (var), `GOOGLE_CLIENT_SECRET` (secret), `AUTH_URL` (var).
5. Enable: `providers: { google: {} }` (or `{ allowSignUp: false }` to only admit existing users).

## Account linking

The provider looks up `auth_identities(provider='google', subject=sub)`. If none, and Google says the email is verified, it links to the user with that email. Otherwise it creates a user (unless sign-up is off). Unverified Google emails are never used to link, which blocks account takeover through a Google account created with someone else's address.

## Web UI

`<OAuthButton provider="google" next="/dashboard" />` from `@softwareseva/auth/react` renders a link to the start route. Show `?error=` codes with `authMessage(code)`. The start route must be reached by top-level navigation (a link or `window.location`), never `fetch`.

## Pitfalls

- `redirect_uri_mismatch`: `AUTH_URL` must match the console entry exactly, including `/v1/auth` and no trailing slash.
- Cookies after the callback: the API and web app must be same-site (same registrable domain) for `SameSite=Lax` cookies to be sent back; otherwise proxy `/v1` through the web origin.
- Consent screen in "Testing" mode only admits listed test users; publish it before launch.

Native wiring: see `flutter-auth`.
