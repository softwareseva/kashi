---
name: auth-facebook
description: Facebook Login for web and mobile with @softwareseva/auth, with no Facebook SDK on the server. Use when adding "Continue with Facebook", configuring the Facebook App and OAuth redirect URIs, verifying access tokens from a native Facebook SDK login, or linking Facebook accounts to existing users by email. One of the id providers a `requireVerified` action can accept.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/auth@1.2"
---

# Facebook sign-in

Two paths, one Facebook App:

- **Web**: `GET /v1/auth/facebook/start?next=/dashboard` redirects to Facebook with a signed, 10-minute `state`; Facebook returns to `/v1/auth/facebook/callback`, which exchanges the code, signs the user in with cookies and redirects to `APP_ORIGIN + next`. Failures redirect to `APP_ORIGIN/sign-in?error=CODE`.
- **Native**: the app obtains an access token with the platform Facebook SDK and posts it to `POST /v1/auth/facebook/token { accessToken, transport: "token" }`. Unlike Google/Apple, Facebook's native SDKs hand back an **access token**, not an ID token — the server verifies it with `debug_token` against the app id before reading the profile.

## Setup

1. [developers.facebook.com](https://developers.facebook.com) > My Apps > Create App > **Consumer** > add the **Facebook Login** product.
2. Facebook Login > Settings: add `${AUTH_URL}/facebook/callback` (e.g. `https://api.example.com/v1/auth/facebook/callback` and the localhost equivalent) to *Valid OAuth Redirect URIs*.
3. App Settings > Basic: the App ID and App Secret are `FACEBOOK_CLIENT_ID` (var) and `FACEBOOK_CLIENT_SECRET` (secret).
4. For mobile, add the iOS bundle id / Android package name + key hashes under Facebook Login > Quickstart so the native SDK can run; the server does not need them.
5. Enable: `providers: { facebook: {} }` (or `{ allowSignUp: false }` to only admit existing users).
6. Move the app from **Development** to **Live** mode before launch, or only users with a role on the app (admin/developer/tester) can sign in.

## Account linking

The provider looks up `auth_identities(provider='facebook', subject=id)`. If none, and Facebook returned an `email` field (Facebook only returns it once the address is confirmed and the user granted the scope), it links to the user with that email. Otherwise it creates a user (unless sign-up is off). A Facebook profile with no email — the user declined the scope — always creates a fresh, unlinked account; treat that account as anonymous for anything gated behind `requireVerified` (see `auth-sessions`).

## Web UI

`<OAuthButton provider="facebook" next="/dashboard" />` from `@softwareseva/auth/react`. Same rules as Google/Apple: top-level navigation only, never `fetch`; show `?error=` codes with `authMessage(code)`.

## Pitfalls

- `redirect_uri_mismatch` (Facebook calls it `Can't Load URL`): the redirect URI must be an exact, `https://` match in *Valid OAuth Redirect URIs*, no `localhost` in production.
- An app in Development mode 403s for anyone without a role on the app — test with a role assigned, then go Live.
- `debug_token`'s `is_valid`/`app_id` check is what stops a token minted for a different app from being replayed here; do not skip it if you ever call the Graph API directly instead of `verifyFacebookAccessToken`.

Native wiring: see `flutter-auth`.
