---
name: auth-sessions
description: Add sign-in and sessions to a Hono API on Cloudflare Workers + D1 with @softwareseva/auth. Use when adding authentication, protecting routes, adding roles or admin-only endpoints, choosing between cookie and bearer-token sessions, handling refresh tokens, sign-out, or when wiring React or Flutter clients to the auth API. Start here before any provider-specific auth skill.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/auth@0.1 @softwareseva/core@0.1"
---

# Sessions with @softwareseva/auth

`authRouter(config)` mounts every sign-in method plus refresh and sign-out as one Hono sub-app. Guards (`requireAuth`, `requireRole`) protect your own routes. You own only the config object, the OTP sender, and optional hooks.

## Install

1. `pnpm add @softwareseva/auth` (and `@simplewebauthn/server` if passkeys are on).
2. `npx @softwareseva/cli migrate` copies `auth_0001_users_sessions.sql` and `auth_0002_otp_passkeys.sql` into `migrations/`. Apply them locally with `wrangler d1 migrations apply <db> --local`.
3. `npx @softwareseva/cli secrets` lists what to set. Minimum: `JWT_SECRET` (`openssl rand -base64 48`) as a secret and `WEB_ORIGIN` as a var. Put local values in `.dev.vars` (gitignored).
4. Copy `templates/auth.ts` to `src/auth.ts`, enable the providers you need, and mount in `src/index.ts`:

```ts
import { authRouter } from "@softwareseva/auth/server";
import { authConfig } from "./auth";
app.route("/v1/auth", authRouter(authConfig));
```

5. Add `AuthVariables` to your `AppEnv` variables so `c.get("user")` is typed (`templates/types.ts`).

## Protect routes

```ts
import { requireAuth, requireRole } from "@softwareseva/auth/server";
app.get("/v1/me", requireAuth(authConfig), (c) => ok(c, c.get("user")));
app.delete("/v1/admin/users/:id", requireRole(authConfig, "admin"), handler);
```

`c.get("user")` is `{ id, name, email, phone, roles, emailVerifiedAt, phoneVerifiedAt }`. Roles live on `auth_users.roles` (a JSON array). New users get `config.defaultRoles` (default `["user"]`). Grant roles with a migration or an admin route that updates that column; the next access token (at most 15 minutes) carries them, and `requireAuth` re-reads the user row on every request so a disabled user is locked out immediately.

## Transports: cookie vs token

Every sign-in endpoint accepts `transport`:

- `"cookie"` (default, browsers): `__Host-access` and `__Host-refresh` HttpOnly cookies, `SameSite=Lax`. Mutations authenticated by cookie must come from an origin in `WEB_ORIGIN(S)` or the request is 403. The web client calls `POST /v1/auth/refresh` on a 401.
- `"token"` (native apps): the response carries `{ accessToken, refreshToken, expiresIn }`. Send `Authorization: Bearer <access>`; refresh with `POST /v1/auth/token/refresh { refreshToken }`; sign out with `POST /v1/auth/token/revoke`.

Never convert one into the other: a cookie session cannot mint a bearer pair. This keeps an XSS bug from exfiltrating a long-lived token.

## Refresh rotation

Refresh tokens are random, stored only as SHA-256 hashes, and grouped by `family_id`. Each refresh marks the old token rotated and issues a new one in the same family. Presenting a rotated token again means it was stolen or replayed: the whole family is revoked and the response is `401 TOKEN_REUSE`. Clients must refresh once at a time: `@softwareseva/core/client` and `kashi_core` share one in-flight refresh across concurrent 401s. Details: `references/threat-model.md`.

## Hooks

```ts
hooks: {
  onUserCreated: async (user, provider, c) => { /* insert profile rows */ },
  beforeSession: async (user) => { if (!allowed(user)) throw new ApiError(403, "FORBIDDEN", "..."); },
  onSignIn: async (user, provider) => { /* audit log */ },
}
```

`beforeSession` may return a modified user (for example to add a computed role for this session only).

## Routes

| Method | Path | Notes |
|---|---|---|
| GET | `/config` | enabled providers, used by the React `<SignIn />` |
| GET | `/me` | current user |
| POST | `/refresh`, `/logout` | cookie transport |
| POST | `/logout-all` | revokes every refresh session of the user |
| POST | `/token/refresh`, `/token/revoke` | token transport |
| POST | `/password/sign-in`, `/password/change` | when `password: true` |
| POST | `/otp/request`, `/otp/verify` | see `auth-whatsapp-otp` |
| GET/POST | `/google/*`, `/apple/*` | see `auth-google`, `auth-apple` |
| POST/GET/PATCH/DELETE | `/passkeys/*` | see `auth-passkeys` |

## Housekeeping

Add a cron trigger that calls `new AuthStore(env.DB).prune()` daily to delete expired refresh sessions, codes and challenges (`templates/scheduled.ts`).

## Tests

Seed users with `hashPassword` and sign in through the router with `SELF.fetch`; `templates/auth.test.ts` covers password sign-in, cookie origin enforcement, refresh reuse and role guards.
