---
name: flutter-auth
description: Sign-in for Flutter apps on @softwareseva/auth with kashi_auth and kashi_core, covering the Riverpod AuthController, go_router auth redirect, the KSignIn screen with contact-free passkey sign-up as the default entry point, WhatsApp/SMS codes and passwords, adapters for Google (google_sign_in 7), Sign in with Apple (sign_in_with_apple), Facebook Login (flutter_facebook_auth), passkeys (passkeys plugin) and biometric lock (local_auth), passkey settings showing which domain each key is tied to, offline start, sign-out, and the iOS and Android platform setup (including Associated Domains / asset-links set up ahead of the RP_ID going live) each method needs. Use when adding login, a sign-in screen, protecting routes, or wiring any sign-in method into a Flutter app.
license: MIT
metadata:
  version: "0.2.0"
  packages: "kashi_auth@0.2 kashi_core@0.1 google_sign_in@7 sign_in_with_apple@8 flutter_facebook_auth@7 passkeys@2 local_auth@3"
---

# Flutter sign-in

Server first: the API mounts `authRouter` (`auth-sessions` skill). Flutter always uses the **token** transport; `kashi_auth` sends `transport: "token"` for you.

Auth is anonymous by default: `KSignIn` leads with **sign in with a passkey**, then (when `providers.passkeys.allowSignUp` is on) **create an account with a passkey** — no email, phone or OAuth prompt before the app is usable. OTP and OAuth are there to let the user attach a valid id later, for the specific screens that need one (see `requireVerified` in `auth-sessions`), not as a sign-up gate.

## Wire it

1. Dependencies: `kashi_core`, `kashi_auth`, `kashi_ui`, `flutter_riverpod`, `go_router`. Add plugins only for the methods you ship: `google_sign_in`, `sign_in_with_apple`, `flutter_facebook_auth`, `passkeys`, `local_auth`.
2. Copy the adapters you need from `templates/adapters/` into `lib/adapters/`. They are small on purpose so plugin upgrades stay in your app.
3. Router (`templates/router.dart`): `refreshListenable: AuthRefreshListenable(ref)` and `redirect: (c, s) => authRedirect(ref, s, signInPath: '/sign-in', homePath: '/', loadingPath: '/loading')`. Signed-out users land on sign-in with `?from=`; signed-in users skip it.
4. Sign-in screen (`templates/sign_in_screen.dart`): `KSignIn(google: googleIdToken, apple: Platform.isIOS ? appleIdToken : null, facebook: facebookAccessToken, passkeys: PluginPasskeyBridge())`. It asks the API which providers are on (including `passkeySignUp`) and shows only those the app has adapters for.
5. Lifecycle: override `authLifecycleProvider` to start sync after sign-in and wipe local data on sign-out (see `flutter-drift-sync`).
6. Set `RP_ID` and wire the app's Associated Domains (iOS) / asset-links intent filter (Android) to it at the same time, before the passkey feature or the app itself ships — see **RP ID a priori** below and `auth-passkeys`' `references/rp-id.md`.

## What the controller does

`authControllerProvider` (`AuthState.status`: `unknown`, `signedOut`, `signedIn`):

- On launch it refreshes with the stored refresh token. If the server is unreachable and a user is stored, it signs in **offline** (`state.offline`), so offline-first apps open without a network.
- `signInWith(() => api.verifyOtp(...))` stores the session from any sign-in call; returns the failure for forms.
- `signOut()` revokes the refresh token on the server (best effort), clears the keychain, and runs `onSignedOut`.
- When a refresh fails anywhere in the app, it signs out and the router redirects.

## Methods and their platform setup

| Method | Server | App | Platform setup |
|---|---|---|---|
| WhatsApp / SMS / email code | `otp` provider | built in | none |
| Password | `password: true` | built in | enable autofill hints on fields |
| Google | `google: {}` | `adapters/google.dart` | `--dart-define=GOOGLE_SERVER_CLIENT_ID=<web client id>`; iOS `GIDClientID` + reversed client id URL scheme; Android SHA-1 on an Android OAuth client |
| Apple | `apple: {}` with `APPLE_BUNDLE_IDS` | `adapters/apple.dart` | Xcode capability *Sign in with Apple*; iOS only (use web flow on Android if needed) |
| Facebook | `facebook: {}` | `adapters/facebook.dart` (`AccessTokenSignIn`, not `IdTokenSignIn` — the SDK returns an access token) | `flutter_facebook_auth` setup: `FacebookAppID`/`FacebookClientToken` in `Info.plist`, `facebook_app_id`/`facebook_client_token` string resources + manifest meta-data on Android |
| Passkeys | `passkeys: {}` with `RP_ID` | `adapters/passkeys.dart` | iOS Associated Domains `webcredentials:<RP_ID>`; Android `assetlinks.json` and the apk-key-hash origin in `extraOrigins` — set both up **a priori**, at the same time `RP_ID` is chosen, not when the feature ships (see below) |
| Biometric lock | none | `adapters/biometric.dart` + `KBiometricGate` | iOS `NSFaceIDUsageDescription`; Android `FlutterFragmentActivity` and `USE_BIOMETRIC` |

Step-by-step for each: `references/platform-setup.md`.

## RP ID a priori

Passkey RP ID never changes once a single user has a passkey, and the app-side wiring (`ios/Runner/Runner.entitlements`'s `webcredentials:<RP_ID>` entitlement, the Android `autoVerify` intent filter for `RP_ID` in `AndroidManifest.xml`) is static config that depends only on the chosen domain and the app's own bundle id / package name / signing certs — not on the server, on `assetlinks.json`/`apple-app-site-association` being live, or on any user having signed in. Set `RP_ID` and both platform entries during project setup, before the first release, so the domain never has to be retrofitted into a shipped binary. Exact snippets: `auth-passkeys`' `references/rp-id.md`.

## Passkeys as sign-up, and after another sign-in

With `allowSignUp` on (the default), `KSignIn` offers **create an account with a passkey** — contact-free, no code or OAuth step — right alongside **sign in with a passkey**, so most users never see anything else. When an app instead treats OTP/OAuth as the primary sign-up (`allowSignUp: false`), offer `KPasskeySettings(bridge: PluginPasskeyBridge())` in settings, or prompt once after that first sign-in, and keep codes as the fallback for new devices.

## Tests

Widget-test `KSignIn` with a fake HTTP adapter (see `flutter-api-client`). For an end-to-end check run the example API locally and point a plain `test()` at it (`templates/e2e_test.dart`): request a code, read it from the dev outbox, sign in, page a list, force a refresh, sign out.
