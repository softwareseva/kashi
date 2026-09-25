# @kashi/auth

One package for sign-in on the kashi stack. The server half mounts onto any Hono app on Cloudflare Workers + D1; the React half renders the screens; `kashi_auth` is the Flutter half. Bump the version and every layer updates together.

- **Sessions**: HS256 access tokens (15 min) plus rotating refresh tokens grouped in families with reuse detection. Browsers use `__Host-` cookies with an origin check on mutations; native apps use a bearer token pair. The two transports never cross.
- **Providers**: password, one-time codes over WhatsApp/SMS/email (you supply the `send` function), Google (web code flow + native ID token), Sign in with Apple (web `form_post` + native identity token), passkeys (`@simplewebauthn/server`, discoverable sign-in).
- **Ships**: `migrations/` (copied by `npx kashi migrate`), `secrets.json` (read by `npx kashi secrets`), and typed contracts.

```ts
import { authRouter, requireAuth, requireRole } from "@kashi/auth/server";

const auth = { providers: { password: true, otp: { channel: "phone", send: sendWhatsApp }, google: {}, apple: {}, passkeys: {} } };
app.route("/v1/auth", authRouter(auth));
app.get("/v1/admin/stats", requireRole(auth, "admin"), (c) => ok(c, { user: c.get("user") }));
```

Bindings read by default: `DB`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `WEB_ORIGIN`(S), `APP_ORIGIN`, `AUTH_URL`, `ENVIRONMENT`, `OTP_PEPPER`, `GOOGLE_*`, `APPLE_*`, `RP_ID`, `RP_NAME`. Override any with `config.env`. See the `auth-sessions` skill and the per-provider skills.
