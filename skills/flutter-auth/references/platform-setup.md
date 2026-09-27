# Platform setup per sign-in method

## Google (google_sign_in 7)

1. Google Cloud Console: keep the **Web** client used by the server (`GOOGLE_CLIENT_ID`). Its id is the app's `serverClientId`; ID tokens are minted for that audience.
2. Create an **iOS** client (bundle id). In `ios/Runner/Info.plist` add `GIDClientID` = iOS client id and a URL type whose scheme is the reversed iOS client id (`com.googleusercontent.apps.123-abc`).
3. Create an **Android** client for each signing key's SHA-1 (debug, upload, Play app signing: `keytool -list -v -keystore ...` and Play Console > App integrity).
4. Run with `--dart-define=GOOGLE_SERVER_CLIENT_ID=<web client id>`.
5. v7 API: `GoogleSignIn.instance.initialize()` once, then `authenticate()`; cancellation is `GoogleSignInExceptionCode.canceled`.

## Sign in with Apple

1. Apple Developer: enable *Sign in with Apple* on the App ID. Xcode: Signing & Capabilities > + Sign in with Apple.
2. Server: add the bundle id to `APPLE_BUNDLE_IDS` (native tokens have the bundle id as audience).
3. Name and email arrive only on first authorisation; the adapter forwards the name, the server stores it.
4. App Store rule: if you offer Google (or any third-party) sign-in on iOS, you must offer Apple too.

## Facebook Login (flutter_facebook_auth)

1. Facebook App (Consumer type) with the Facebook Login product; `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` on the server (see the `auth-facebook` skill).
2. iOS `Info.plist`: `FacebookAppID`, `FacebookClientToken`, `FacebookDisplayName`, and the `fbAPP_ID`/`fbAUTH_PROTOCOL_SCHEME` URL scheme entries the plugin's setup docs list.
3. Android `res/values/strings.xml`: `facebook_app_id`, `facebook_client_token`; `AndroidManifest.xml`: the `com.facebook.sdk.ApplicationId` and `com.facebook.sdk.ClientToken` meta-data, plus the `FacebookActivity` and `CustomTabActivity` entries.
4. The adapter returns an access token (`AccessTokenResult`), not an ID token — the server verifies it itself via `debug_token`, so no separate native verification step is needed.
5. Move the Facebook App from Development to Live before launch (see `auth-facebook`'s pitfalls).

## Passkeys (passkeys plugin)

1. Choose `RP_ID` (e.g. `example.com`) during project setup — before the app's first release, not when the passkey feature ships — and wire the app-side config in step 2/3 at the same time, even though `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` (see the `auth-passkeys` skill) may not be deployed yet. Neither depends on the other being live.
2. iOS: Associated Domains capability with `webcredentials:example.com` (or the equivalent `ios/Runner/Runner.entitlements` entry). Deployment target iOS 16 or later for passkeys.
3. Android: `minSdk` 28+, Google Play services, and the `autoVerify` intent filter for `example.com` in `AndroidManifest.xml`; add the app's `android:apk-key-hash:...` origin to `providers.passkeys.extraOrigins` on the server.
4. The plugin returns standard WebAuthn JSON; the bridge passes it through unchanged for both `/passkeys/authenticate/*` (sign-in) and `/passkeys/signup/*` (contact-free sign-up) — same bridge, same `register`/`authenticate` methods.

## Biometric lock (local_auth 3)

1. iOS `Info.plist`: `NSFaceIDUsageDescription`.
2. Android: `MainActivity` extends `FlutterFragmentActivity`; add `<uses-permission android:name="android.permission.USE_BIOMETRIC"/>`.
3. Wrap the signed-in app: `KBiometricGate(enabled: signedIn && userOptedIn, authenticate: biometricUnlock, child: child)`. It locks after 5 minutes in the background by default.

## Local HTTP during development

- iOS: `NSAppTransportSecurity > NSAllowsLocalNetworking = YES`.
- Android: `android:usesCleartextTraffic="true"` in `android/app/src/debug/AndroidManifest.xml` only.
- Base URLs: iOS Simulator `http://localhost:8787/v1`, Android emulator `http://10.0.2.2:8787/v1`, a phone on Wi-Fi: your machine's LAN IP with `wrangler dev --ip 0.0.0.0`.
