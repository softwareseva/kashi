# @softwareseva/auth

One package for sign-in on the kashi stack. The server half mounts onto any Hono app on Cloudflare Workers + D1; the React half renders the screens; `kashi_auth` is the Flutter half. Bump the version and every layer updates together.

## Install

```bash
pnpm add @softwareseva/auth hono zod
```

## What's inside

- **Sessions**: HS256 access tokens (15 min) plus rotating refresh tokens grouped in families with reuse detection. Browsers use `__Host-` cookies with an origin check on mutations; native apps use a bearer token pair. The two transports never cross.
- **Providers**: password; one-time codes over WhatsApp/SMS/email (you supply the `send` function — `renderOtpEmail()` gives you a ready-made subject/text/html for the email channel); Google (web code flow + native ID token); Sign in with Apple (web `form_post` + native identity token); Facebook Login (web code flow + native access token); passkeys (`@simplewebauthn/server`, discoverable sign-in, and a contact-free sign-up that creates the account only once a new passkey verifies); peer sign-in with another kashi site (`providers.peer`, see the `auth-federation` skill) — this site can act as an OIDC-style issuer for other kashi deployments, a consumer of theirs, or both.
- **Anonymous by default**: passkey sign-up needs no email, phone, or OAuth grant — `POST /passkeys/signup/*` verifies the passkey first and only then creates the account. Nothing in the router requires a "valid id"; gate the handful of actions that do with `requireVerified`, which passes once the user has an OTP-verified email/phone or a linked Google/Apple/Facebook identity.
- **Identity extensions** (opt-in, see below): purpose-bound OTP over one or more channels at once (`otpChannels`), explicit account linking with collision handling (`identityExtensions`, `autoLinkVerifiedEmail`), hashed single-use recovery codes, and session-family revocation checks (`enforceSessionRevocation`).
- **`@softwareseva/auth/server`**: `authRouter()`, `requireAuth()`, `requireRole()`, `requireVerified()`, `requireRecent()`, `ExtensionStore`, `boundState()`/`consumeBoundState()`.
- **`@softwareseva/auth/react`**: `AuthProvider` + `useAuth`; sign-in hooks `usePasswordSignIn`, `useOtp`, `usePasskeySignIn`, `usePasskeyRegister`, `useOAuthUrl`, `usePeerUrl`; ready-made components `SignIn`, `PasswordSignIn`, `OtpSignIn`, `PasskeyButton`, `OAuthButton`, `PeerSignInButton`, `ErrorAlert`.
- **`@softwareseva/auth/contracts`**: `AuthUser`, `SessionResponse`, `AuthConfigResponse`, `PasskeyItem`, `PeerConfig` types.
- **`kashi_auth`** (pub.dev, Flutter): a Riverpod `AuthController`, go_router auth redirect, the `KSignIn` screen, and adapters for every provider above plus biometric lock. See the `flutter-auth` skill.
- **Ships**: `migrations/` (copied by `npx @softwareseva/cli migrate`), `secrets.json` (read by `npx @softwareseva/cli secrets`), and typed contracts.

Setting up a provider (Google, Apple, Facebook, passkeys, peer federation)? [`SECRETS.md`](SECRETS.md) has step-by-step instructions for generating every value in `secrets.json` — which console, which button, what to paste where.

## Example

```ts
import { authRouter, requireAuth, requireRole, requireVerified } from "@softwareseva/auth/server";

const auth = { providers: { password: true, otp: { channel: "phone", send: sendWhatsApp }, google: {}, apple: {}, facebook: {}, passkeys: {} } };
app.route("/v1/auth", authRouter(auth));
app.get("/v1/admin/stats", requireRole(auth, "admin"), (c) => ok(c, { user: c.get("user") }));
// An action that needs a reachable identity, not just a signed-in device:
app.post("/v1/payouts", requireVerified(auth), (c) => ok(c, { queued: true }));
```

## Email one-time codes

`renderOtpEmail()` builds the subject, plain-text and HTML for an OTP email — no remote images, inline styles only. Wire it into your `send` function:

```ts
import { renderOtpEmail } from "@softwareseva/auth/server";

providers: {
  otp: {
    channel: "email",
    ttlSeconds: 600,
    send: async (env, destination, code, c, { purpose, ttlSeconds }) => {
      const { subject, text, html } = renderOtpEmail({ code, purpose, ttlSeconds, brand: { name: "Acme" } });
      await sendEmail(env, { to: destination, subject, text, html });
    },
  },
}
```

The fifth `send` argument (`{ purpose, ttlSeconds }`) is optional to consume — existing four-argument senders keep working unchanged. `purpose` is `"sign-in"` or `"link"` (the OTP contact-link flow below, and `otpChannels`, both use `"link"`).

## Identity extensions

Everything here is opt-in and additive: a consumer that sets none of these keys gets exactly 1.4.0's behavior. Apply `auth_0007_identity_extensions.sql` before enabling any of it.

- **`otpChannels`**: purpose- and destination-bound OTP over one or more channels at once (unlike `providers.otp`, which is a single channel). Mounts `POST /otp/{request,verify}` (sign-in — shared with `providers.otp`'s same paths; a `channel` not present in `otpChannels` falls through to it) and, when signed in, `POST /contacts/otp/{request,verify}` (attach a verified email or phone to the current account).
  ```ts
  otpChannels: { email: { channel: "email", send: sendEmailOtp }, phone: { channel: "phone", send: sendPhoneOtp } }
  ```
- **`identityExtensions: true`**: mounts `POST /recovery/codes` (requires a recent session) and `POST /recovery/sign-in` for hashed, single-use recovery codes; and, with `providers.google` also set, `GET /google/link/start` / `GET /google/link/callback` for authenticated Google linking that rejects identity collisions (`ACCOUNT_MERGE_REQUIRED`) instead of silently merging accounts. Also gates the passkey-deletion guard below.
- **`recoveryCodesOnSignup: true`** (requires `identityExtensions`): contact-free passkey signup (`POST /passkeys/signup/verify`) also issues a set of recovery codes, returned once in the response body (`recoveryCodes: string[]`).
- **`autoLinkVerifiedEmail: false`**: by default, a verified email from Google/Apple/Facebook/peer sign-in silently links to an existing account with the same email. Set this to `false` to instead reject that sign-in with `409 ACCOUNT_MERGE_REQUIRED`, requiring the user to sign in and link explicitly (via `/google/link/*` or `/contacts/otp/*`).
- **`enforceSessionRevocation: true`**: `requireAuth` additionally requires the access token's session family to still be active (not revoked, not superseded by a refresh), so revoking a family (e.g. via `/logout-all`, or your own code calling `AuthStore.revokeFamily`) takes effect immediately rather than only on the next refresh.
- **`federationLoginPath`**: an unauthenticated `GET /federation/authorize` redirects here (with `?next=` set to resume) instead of returning 401 — point it at your sign-in page.
- **`hooks.validateSession`**, **`hooks.federationClaims`**, **`hooks.onFederationSession`**: generic extension points for centralizing session checks, adding app claims to a minted federation ID token, and associating a peer sign-in with local state (e.g. `ExtensionStore.linkPeer`) — see the type doc comments on `AuthHooks` for exact call sites and arguments.
- **`ExtensionStore`**, **`requireRecent`**, **`boundState`/`consumeBoundState`**: the public building blocks the router uses internally, exported for app code that needs the same primitives (e.g. a `/account/security` route reading `ExtensionStore.methods()`/`.identities()`, or a custom linking flow reusing the browser-bound single-use OAuth state).

## Configuration

Bindings read by default: `DB`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `WEB_ORIGIN`(S), `APP_ORIGIN`, `AUTH_URL`, `ENVIRONMENT`, `OTP_PEPPER`, `GOOGLE_*`, `APPLE_*`, `FACEBOOK_*`, `RP_ID`, `RP_NAME`, `FEDERATION_PRIVATE_KEY` (only needed when `providers.peer.issuer.enabled`). Override any with `config.env`.

## See also

`auth-sessions` skill (start here), plus `auth-google`, `auth-apple`, `auth-facebook`, `auth-passkeys`, `auth-whatsapp-otp`, `auth-federation`, `auth-identity-extensions`, and `flutter-auth` for `kashi_auth`.
