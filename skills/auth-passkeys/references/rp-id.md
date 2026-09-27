# RP ID, origins and app association

## Choosing RP_ID

Use the registrable domain that every surface shares: `example.com` when the web app is `app.example.com` and the API is `api.example.com`. The API host does not matter; the browser checks RP ID against the page that calls WebAuthn.

## apple-app-site-association

Serve at `https://example.com/.well-known/apple-app-site-association` with `Content-Type: application/json`, no redirect:

```json
{ "webcredentials": { "apps": ["ABCDE12345.com.example.app"] } }
```

Add the entitlement `webcredentials:example.com` to the iOS app (Xcode > Signing & Capabilities > Associated Domains), or directly in `ios/Runner/Runner.entitlements`:

```xml
<key>com.apple.developer.associated-domains</key>
<array>
  <string>webcredentials:example.com</string>
</array>
```

## assetlinks.json

Serve at `https://example.com/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
  "target": { "namespace": "android_app", "package_name": "com.example.app",
    "sha256_cert_fingerprints": ["AA:BB:...:FF"] }
}]
```

Include the fingerprint of every signing key (debug, upload, Play app signing).

## Android origin

Android Credential Manager reports `android:apk-key-hash:<base64url(sha256(cert))>` as the origin. Compute it from the Play app signing certificate and add it to `providers.passkeys.extraOrigins`.

## Setting up the Flutter app ahead of time (before RP_ID is live)

The app-side half of both association files is static config keyed only on `RP_ID` plus the app's own identifiers (bundle id / package name, signing cert fingerprints). None of it depends on a deployed API, a live `.well-known` file, or any user ever having signed in — so wire it in at project setup, the same moment `RP_ID` is chosen, rather than waiting until the passkey feature ships:

- **iOS**: add `ios/Runner/Runner.entitlements` (create it if missing, and reference it from the Xcode build settings as `CODE_SIGN_ENTITLEMENTS`) with the `webcredentials:<RP_ID>` domain above. The OS does not validate the domain at build time — it only checks `apple-app-site-association` at install/launch time — so this compiles and ships fine before the file is live.
- **Android**: `android/app/src/main/AndroidManifest.xml`, inside the launcher `<activity>`, add an `autoVerify` intent filter for the same host:

  ```xml
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="example.com" />
  </intent-filter>
  ```

  Android Studio's Asset Links tool (or `assetlinks.json` verification later) confirms the fingerprint match once `assetlinks.json` is deployed; the manifest entry itself has no such dependency.
- Keep both in source control from day one, even for a build that ships before `assetlinks.json`/`apple-app-site-association` exist on the domain — that way the domain choice, once made, never has to be retrofitted into a shipped binary. Changing `RP_ID` after release still orphans existing passkeys regardless of when the app-side config landed.
- `flutter-auth`'s `templates/adapters/passkeys.dart` reads `extraOrigins`/`RP_ID` from the same build-time config as the rest of the app, so there is one source of truth for the domain.

## Cloudflare hosting of .well-known files

If the web app is on Cloudflare Pages or Workers static assets, put the files under `public/.well-known/` and add a `_headers` rule setting `Content-Type: application/json` for `apple-app-site-association` (it has no extension).
