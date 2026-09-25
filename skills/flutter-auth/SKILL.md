---
name: flutter-auth
description: Sign-in for Flutter apps on @softwareseva/auth with kashi_auth and kashi_core, covering the Riverpod AuthController, go_router auth redirect, the KSignIn screen for WhatsApp/SMS codes and passwords, adapters for Google (google_sign_in 7), Sign in with Apple (sign_in_with_apple), passkeys (passkeys plugin) and biometric lock (local_auth), passkey settings, offline start, sign-out and the iOS and Android platform setup each method needs. Use when adding login, a sign-in screen, protecting routes, or wiring any sign-in method into a Flutter app.
license: MIT
metadata:
  version: "0.1.0"
  packages: "kashi_auth@0.1 kashi_core@0.1 google_sign_in@7 sign_in_with_apple@8 passkeys@2 local_auth@3"
---

# Flutter sign-in

Server first: the API mounts `authRouter` (`auth-sessions` skill). Flutter always uses the **token** transport; `kashi_auth` sends `transport: "token"` for you.

## Wire it

1. Dependencies: `kashi_core`, `kashi_auth`, `kashi_ui`, `flutter_riverpod`, `go_router`. Add plugins only for the methods you ship: `google_sign_in`, `sign_in_with_apple`, `passkeys`, `local_auth`.
2. Copy the adapters you need from `templates/adapters/` into `lib/adapters/`. They are small on purpose so plugin upgrades stay in your app.
3. Router (`templates/router.dart`): `refreshListenable: AuthRefreshListenable(ref)` and `redirect: (c, s) => authRedirect(ref, s, signInPath: '/sign-in', homePath: '/', loadingPath: '/loading')`. Signed-out users land on sign-in with `?from=`; signed-in users skip it.
4. Sign-in screen (`templates/sign_in_screen.dart`): `KSignIn(google: googleIdToken, apple: Platform.isIOS ? appleIdToken : null, passkeys: PluginPasskeyBridge())`. It asks the API which providers are on and shows only those the app has adapters for.
5. Lifecycle: override `authLifecycleProvider` to start sync after sign-in and wipe local data on sign-out (see `flutter-drift-sync`).

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
| Passkeys | `passkeys: {}` with `RP_ID` | `adapters/passkeys.dart` | iOS Associated Domains `webcredentials:<RP_ID>`; Android `assetlinks.json` and the apk-key-hash origin in `extraOrigins` |
| Biometric lock | none | `adapters/biometric.dart` + `KBiometricGate` | iOS `NSFaceIDUsageDescription`; Android `FlutterFragmentActivity` and `USE_BIOMETRIC` |

Step-by-step for each: `references/platform-setup.md`.

## Passkeys after first sign-in

Offer `KPasskeySettings(bridge: PluginPasskeyBridge())` in settings, or prompt once after the first code sign-in. Keep codes as the fallback for new devices.

## Tests

Widget-test `KSignIn` with a fake HTTP adapter (see `flutter-api-client`). For an end-to-end check run the example API locally and point a plain `test()` at it (`templates/e2e_test.dart`): request a code, read it from the dev outbox, sign in, page a list, force a refresh, sign out.
