# Generating secrets for @softwareseva/auth

Step-by-step instructions for every secret in [`secrets.json`](secrets.json). Run `npx @softwareseva/cli secrets` first — it lists exactly which of these your enabled providers need, where to store each one, and links back to the matching section below via each entry's `docs` field. Skip any section for a provider you have not enabled.

Where to store a value once you have it:

- **`wrangler-secret`**: `wrangler secret put NAME` (production/staging) — never written to a file.
- **`dev-vars`**: add `NAME=value` to your local `.dev.vars` (gitignored).
- **`env`**: a plain (non-secret) environment variable or `wrangler.jsonc` `vars` entry — safe to commit.

## Sessions

### JWT_SECRET

The HMAC key that signs access tokens and OAuth state. Generate a random 48-byte value — do not type one by hand:

```bash
openssl rand -base64 48
```

Store it with `wrangler secret put JWT_SECRET` for each environment, and add the same (or a different, dev-only) value to `.dev.vars` for local development. Rotate yearly, or immediately if it leaks — rotating invalidates every existing session, since access and refresh tokens are both signed with it.

### JWT_ISSUER / JWT_AUDIENCE

Optional. Pick any stable string — they only need to match between what you set here and nothing external validates them (e.g. `JWT_ISSUER=api.example.com`, `JWT_AUDIENCE=example-app`). Set them as plain `vars` in `wrangler.jsonc`; no secret involved.

### WEB_ORIGIN

The browser origin(s) allowed to use cookie-based sessions, e.g. `https://app.example.com`. For more than one, use `WEB_ORIGINS` as a comma-separated list. Set as a `vars` entry — this is not a secret, but it must exactly match the origin the browser sends (scheme + host + port), or cookie auth will silently fail the origin check on mutations.

### AUTH_URL

Only needed when Google or Apple sign-in is enabled. The public URL of your mounted auth router, e.g. `https://api.example.com/v1/auth` — this is what the Google/Apple sections below tell you to append `/google/callback` or `/apple/callback` to when registering a redirect URI. Plain `vars` entry; not a secret, but must exactly match what you registered with the provider.

## WhatsApp / SMS / email one-time codes

### OTP_PEPPER

A server-side pepper mixed into one-time-code hashes before they're stored, so a leaked database alone can't be used to guess valid codes. Generate it the same way as `JWT_SECRET`:

```bash
openssl rand -base64 32
```

Store with `wrangler secret put OTP_PEPPER` and in `.dev.vars` for local dev.

This package only defines `OTP_PEPPER` — the credentials for whichever OTP delivery channel you pick (AiSensy, Meta WhatsApp Cloud API, Twilio, a transactional email provider) are supplied by your own `send` function and are not part of this package's `secrets.json`. Provider-by-provider setup (template approval, API keys, endpoints) is in the `auth-whatsapp-otp` skill's `references/providers.md` — add the keys it lists to your own project's `secrets.json`/`.dev.vars.example` once you've picked a provider.

## Google Sign-In

Needs a Google Cloud project. If you don't have one: [console.cloud.google.com](https://console.cloud.google.com/) → create a project.

1. **Configure the consent screen** (skip if already done for this project): APIs & Services → OAuth consent screen → choose External (or Internal for a Workspace-only app) → fill in app name, support email, and authorised domains → add scopes `openid`, `email`, `profile`.
2. **Create the OAuth client**: APIs & Services → Credentials → Create Credentials → OAuth client ID → Application type **Web application**.
3. Under **Authorized redirect URIs**, add `${AUTH_URL}/google/callback` — substitute your real `AUTH_URL`, e.g. `https://api.example.com/v1/auth/google/callback`.
4. Click Create. Google shows the client ID and secret once on screen (the secret can be viewed again later from the Credentials page).
5. (Optional, for native sign-in) Create additional OAuth clients of type **iOS** and **Android** under the same project — these don't produce values you set on the server; the same `GOOGLE_CLIENT_ID` above is reused server-side as the native app's `serverClientId`.

### GOOGLE_CLIENT_ID

The Web client's ID from step 4 (looks like `1234567890-abc...apps.googleusercontent.com`). Set as a plain `vars` entry — it's public by design (it's embedded in client-side code).

### GOOGLE_CLIENT_SECRET

The Web client's secret from step 4. `wrangler secret put GOOGLE_CLIENT_SECRET`, and add to `.dev.vars` for local dev. If you lose it, go back to Credentials → your OAuth client → reset/regenerate the secret (this invalidates the old one immediately).

## Sign in with Apple

Needs an active Apple Developer Program membership ($99/year). All steps are at [developer.apple.com/account](https://developer.apple.com/account/resources).

1. **Enable the capability on your app**: Identifiers → App IDs → select your iOS app → Capabilities → check **Sign in with Apple** → Save. (Needed even if you only support web sign-in, if a native app shares the same team.)
2. **Create a Services ID** (this represents your web app to Apple): Identifiers → the `+` button → Services IDs → enter a description and identifier, e.g. `com.example.web` → Register.
3. Open the new Services ID → check **Sign in with Apple** → Configure:
   - **Primary App ID**: the App ID from step 1.
   - **Domains and Subdomains**: your web and API domains, e.g. `api.example.com`, `app.example.com`.
   - **Return URLs**: `https://api.example.com/v1/auth/apple/callback` (must match `AUTH_URL` exactly).
   - Save → Continue → Save.
4. **Create a signing key**: Keys → `+` → name it → check **Sign in with Apple** → Configure → select the Primary App ID from step 1 → Save → Continue → Register → **Download**. The `.p8` file downloads exactly once — Apple does not let you download it again, so store it somewhere safe immediately (a password manager or your secrets store, never committed to git). Note the **Key ID** shown on this page.
5. **Find your Team ID**: Membership (in the account sidebar) → Team ID, a 10-character string.

Full order-of-operations and screenshots-level detail: the `auth-apple` skill's `references/apple-setup.md`.

### APPLE_CLIENT_ID

The Services ID identifier from step 2, e.g. `com.example.web`. Plain `vars` entry.

### APPLE_TEAM_ID

The 10-character Team ID from step 5. Plain `vars` entry.

### APPLE_KEY_ID

The Key ID from step 4. Plain `vars` entry.

### APPLE_PRIVATE_KEY

The full contents of the downloaded `AuthKey_<KEY_ID>.p8` file, including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines. Store with:

```bash
wrangler secret put APPLE_PRIVATE_KEY < AuthKey_XXXXXXXXXX.p8
```

For `.dev.vars`, paste it as one line with literal `\n` for line breaks. Add `*.p8` to `.gitignore` immediately after downloading it (`npx @softwareseva/cli secrets` does this for you). The key itself never expires; if it leaks, go to Keys → revoke it, then create a new one and repeat steps 4–5.

### APPLE_BUNDLE_IDS

Optional, only if a native iOS/macOS app signs in. Comma-separated list of your app's bundle identifier(s) (e.g. `com.example.app`), found in Xcode → your target → Signing & Capabilities → Bundle Identifier. Plain `vars` entry.

## Facebook Login

Needs a Facebook Developer account at [developers.facebook.com](https://developers.facebook.com/apps/).

1. My Apps → Create App → choose **Consumer** (or **Business** if this is a company app) → fill in the app name and contact email.
2. Add the **Facebook Login** product from the app dashboard.
3. Facebook Login → Settings → add `${AUTH_URL}/facebook/callback` to **Valid OAuth Redirect URIs**.
4. App Settings → Basic: this page shows the **App ID** and **App Secret** (click "Show" and confirm your password for the secret).
5. (Optional, for native sign-in) Facebook Login → Quickstart → Android/iOS: register your app's package name/bundle id and key hashes.
6. Before launching to real users, switch the app from **Development** to **Live** mode (top of the dashboard) — Development mode restricts login to accounts added as testers/developers.

### FACEBOOK_CLIENT_ID

The App ID from step 4. Plain `vars` entry.

### FACEBOOK_CLIENT_SECRET

The App Secret from step 4. `wrangler secret put FACEBOOK_CLIENT_SECRET`, and add to `.dev.vars`. To rotate, App Settings → Basic → reset the App Secret (this immediately invalidates the old one for all users of the app).

## Passkeys

Passkeys need no external developer account or API keys — the values come from decisions about your own domain, made once, before your first release.

### RP_ID

The registrable domain shared by your web app and your native apps' associated-domain config, e.g. `example.com` (not `app.example.com` — use the bare registrable domain so it covers every subdomain). This cannot change later without invalidating every user's existing passkeys, and it must be wired into the iOS Associated Domains entitlement and the Android `assetlinks.json`/intent filter ahead of the app's first release, not after. See the `auth-passkeys` skill's `references/rp-id.md` for the exact `.well-known` file contents and native app config. Plain `vars` entry.

### RP_NAME

Optional. The name shown to users in their platform's passkey prompt (e.g. "Example Inc"). Plain `vars` entry.

## Peer federation (`providers.peer`)

### FEDERATION_PRIVATE_KEY

Only needed when this site issues sign-in tokens for other kashi sites (`providers.peer.issuer.enabled = true`). This is a keypair you generate yourself with code the package ships — there's no external console. Never reuse `JWT_SECRET` for it.

```ts
import { generateFederationKeypair } from "@softwareseva/auth/server";
const { privateJwk } = await generateFederationKeypair();
console.log(JSON.stringify(privateJwk));
```

Run that once (e.g. `npx tsx -e "..."`) and store the printed JSON as the secret:

```bash
wrangler secret put FEDERATION_PRIVATE_KEY
# paste the JSON.stringify(privateJwk) output, then Ctrl-D
```

The public half is derived from the private JWK on every request and served at `GET /v1/auth/federation/.well-known/jwks.json` — there's nothing else to publish or store. See the `auth-federation` skill for the full issuer/consumer registration flow and how to rotate a compromised key.
