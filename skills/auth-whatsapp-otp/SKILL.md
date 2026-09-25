---
name: auth-whatsapp-otp
description: Phone or email sign-in with one-time codes using @kashi/auth, delivered over WhatsApp (AiSensy or Meta Cloud API), SMS, or email. Use when adding OTP login, passwordless phone sign-in, verifying a phone number, writing a WhatsApp or SMS sender adapter, or tuning OTP rate limits and code expiry.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@kashi/auth@0.1"
---

# One-time codes (WhatsApp, SMS, email)

The `otp` provider in `@kashi/auth` generates, stores and verifies codes. You supply one function that delivers the code. Read `auth-sessions` first; this skill only covers the OTP provider.

## Enable

```ts
providers: {
  otp: {
    channel: "phone",          // or "email"
    send: sendWhatsAppCode,    // (env, destination, code, c) => Promise<void>
    defaultCountry: "IN",      // bare national numbers are read in this country
    allowSignUp: true,         // false: only existing users can request codes
    codeLength: 6, ttlSeconds: 300, maxAttempts: 5,
  },
}
```

Set `OTP_PEPPER` (`openssl rand -base64 32`) with `wrangler secret put OTP_PEPPER` and in `.dev.vars`.

## Write the sender

Pick a template and copy it to `src/adapters/`:

- `templates/aisensy.ts`: AiSensy campaign API (India). Needs `AISENSY_API_KEY` and an approved authentication template whose first variable is the code (and a copy-code button).
- `templates/meta-whatsapp.ts`: WhatsApp Cloud API directly. Needs `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and an approved `AUTHENTICATION` category template.
- `templates/dev-outbox.ts`: writes codes to a `dev_outbox` table outside production, so local development and tests never send real messages.

Rules for any sender:

- Destination arrives normalised: E.164 for phones (`+919876543210`), lowercase for email.
- Use `AbortSignal.timeout(15_000)` on the provider call and throw on a non-2xx response. Never include the code, token or full provider payload in logs or error messages.
- Keep provider credentials in secrets; add them to your own `secrets.json` or `.dev.vars.example`.

## Flow

1. `POST /v1/auth/otp/request { destination }` always answers `{ sent: true }`. Invalid numbers, unknown users (when sign-up is off) and delivery to landlines are silently dropped, so the endpoint cannot be used to discover accounts.
2. `POST /v1/auth/otp/verify { destination, code, name?, transport? }` returns the session. First-time users are created with the verified phone (or email) and `name`.

Codes are stored as `HMAC(pepper, destination:code)`. Requesting a new code invalidates the previous one. After `maxAttempts` wrong guesses the code is dead.

## Limits (built in)

| Scope | Limit |
|---|---|
| requests per IP | 10 per 10 minutes |
| requests per destination | 3 per 10 minutes |
| verifications per IP | 30 per 10 minutes |
| attempts per code | `maxAttempts` (5) |

WhatsApp templates cost money per message; the per-destination limit also caps spend. Details and provider setup: `references/providers.md`.

## UI

React: `<OtpSignIn channel="phone" />` or `useOtp()` from `@kashi/auth/react`. Use `autoComplete="one-time-code"` and `inputMode="numeric"` on the code field (the component does). Flutter: the `flutter-auth` skill.

## Test

With the dev-outbox sender, integration tests read the code back:

```ts
await call("/auth/otp/request", { method: "POST", body: JSON.stringify({ destination: "9876543210" }) });
const code = (await env.DB.prepare("SELECT body FROM dev_outbox WHERE destination = ? ORDER BY id DESC").bind("+919876543210").first<{ body: string }>())!.body;
```
