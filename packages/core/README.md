# @softwareseva/core

The foundation every kashi app shares. Three entry points:

- `@softwareseva/core/server` (Hono on Cloudflare Workers + D1): `createApp()` with request ids, security headers, CORS and the error envelope; `ApiError`; WebCrypto helpers; PBKDF2 passwords; `newId()`; `normalizePhone()`; LIKE escaping; D1-backed `rateLimit()`; `parseEnv()`.
- `@softwareseva/core/contracts`: the `{ data }` / `{ code, message, requestId, fields? }` envelope schema and standard error codes.
- `@softwareseva/core/client` (browser, React Native, Node): `createApiClient()` that unwraps the envelope, throws `ApiError`, and shares one in-flight session refresh across concurrent 401s.

```ts
import { createApp, ok, ApiError } from "@softwareseva/core/server";
const app = createApp<AppEnv>({ origins: (env) => [env.WEB_ORIGIN] });
app.get("/v1/ping", (c) => ok(c, { pong: true }));
export default app;
```

Ships `migrations/core_0001_rate_limits.sql`; copy it into your migrations directory (`npx @softwareseva/cli migrate` does this). No secrets. See the `hono-d1-api` skill.
