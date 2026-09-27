# @softwareseva/auth

One package for sign-in on the kashi stack. The server half mounts onto any Hono app on Cloudflare Workers + D1; the React half renders the screens; `kashi_auth` is the Flutter half. Bump the version and every layer updates together.

- **Sessions**: HS256 access tokens (15 min) plus rotating refresh tokens grouped in families with reuse detection. Browsers use `__Host-` cookies with an origin check on mutations; native apps use a bearer token pair. The two transports never cross.
- **Providers**: password, one-time codes over WhatsApp/SMS/email (you supply the `send` function), Google (web code flow + native ID token), Sign in with Apple (web `form_post` + native identity token), Facebook Login (web code flow + native access token), passkeys (`@simplewebauthn/server`, discoverable sign-in, and a contact-free sign-up that creates the account only once a new passkey verifies).
- **Anonymous by default**: passkey sign-up needs no email, phone or OAuth grant — `POST /passkeys/signup/*` verifies the passkey first and only then creates the account. Nothing in the router requires a "valid id"; gate the handful of actions that do with `requireVerified`, which passes once the user has an OTP-verified email/phone or a linked Google/Apple/Facebook identity.
- **Ships**: `migrations/` (copied by `npx @softwareseva/cli migrate`), `secrets.json` (read by `npx @softwareseva/cli secrets`), and typed contracts.

```ts
import { authRouter, requireAuth, requireRole, requireVerified } from "@softwareseva/auth/server";

const auth = { providers: { password: true, otp: { channel: "phone", send: sendWhatsApp }, google: {}, apple: {}, facebook: {}, passkeys: {} } };
app.route("/v1/auth", authRouter(auth));
app.get("/v1/admin/stats", requireRole(auth, "admin"), (c) => ok(c, { user: c.get("user") }));
// An action that needs a reachable identity, not just a signed-in device:
app.post("/v1/payouts", requireVerified(auth), (c) => ok(c, { queued: true }));
```

Bindings read by default: `DB`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `WEB_ORIGIN`(S), `APP_ORIGIN`, `AUTH_URL`, `ENVIRONMENT`, `OTP_PEPPER`, `GOOGLE_*`, `APPLE_*`, `FACEBOOK_*`, `RP_ID`, `RP_NAME`. Override any with `config.env`. See the `auth-sessions` skill and the per-provider skills.
