# RP ID, origins and app association

## Choosing RP_ID

Use the registrable domain that every surface shares: `example.com` when the web app is `app.example.com` and the API is `api.example.com`. The API host does not matter; the browser checks RP ID against the page that calls WebAuthn.

## apple-app-site-association

Serve at `https://example.com/.well-known/apple-app-site-association` with `Content-Type: application/json`, no redirect:

```json
{ "webcredentials": { "apps": ["ABCDE12345.com.example.app"] } }
```

Add the entitlement `webcredentials:example.com` to the iOS app (Xcode > Signing & Capabilities > Associated Domains).

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

## Cloudflare hosting of .well-known files

If the web app is on Cloudflare Pages or Workers static assets, put the files under `public/.well-known/` and add a `_headers` rule setting `Content-Type: application/json` for `apple-app-site-association` (it has no extension).
