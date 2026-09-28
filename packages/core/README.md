# @softwareseva/core

The foundation every kashi app shares: a Hono app factory with the error envelope, an API client that unwraps it, and the small utilities (ids, crypto, rate limiting) the other packages build on. Flutter apps get the same ids and envelope handling from `kashi_core`.

## Install

```bash
pnpm add @softwareseva/core hono zod
```

## What's inside

- **`@softwareseva/core/server`** (Hono on Cloudflare Workers + D1): `createApp()` wires request ids, security headers, CORS, and the error envelope onto a Hono app; `ok()` / `ApiError` for responses; WebCrypto helpers and PBKDF2 password hashing; `newId()` (time-sortable ids); `normalizePhone()`; LIKE-escaping helpers; a D1-backed `rateLimit()`; `parseEnv()` for validating Worker bindings.
- **`@softwareseva/core/contracts`**: the `{ data }` success shape and `{ code, message, requestId, fields? }` error shape, plus the standard error codes every kashi package returns.
- **`@softwareseva/core/client`** (browser, React Native, Node): `createApiClient()` — unwraps the envelope, throws typed `ApiError`, and shares one in-flight session refresh across concurrent 401s so a page full of requests doesn't trigger a refresh storm.
- **`@softwareseva/core/react`**: `useApiQuery` / `useApiMutation`, thin TanStack Query wrappers typed to `ApiError`, plus a `QueryClient` preconfigured to skip retrying requests that already went through the client's refresh-and-retry.
- **`kashi_core`** (pub.dev, Flutter): the same ids and envelope handling — `KashiApiClient` on Dio with single-flight refresh, typed `KashiFailure`, go_router redirect integration. See the `flutter-api-client` skill.

## Example

```ts
import { createApp, ok, ApiError } from "@softwareseva/core/server";

const app = createApp<AppEnv>({ origins: (env) => [env.WEB_ORIGIN] });
app.get("/v1/ping", (c) => ok(c, { pong: true }));
export default app;
```

## Migrations

Ships `migrations/core_0001_rate_limits.sql` (needed only if you use `rateLimit()`). Copy it into your migrations directory with `npx @softwareseva/cli migrate`. No secrets required.

## See also

`hono-d1-api` (server), `api-client-react` (React client), `flutter-api-client` (`kashi_core`) skills.
