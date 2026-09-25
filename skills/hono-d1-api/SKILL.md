---
name: hono-d1-api
description: Build or extend a Hono API on Cloudflare Workers with a D1 database using @softwareseva/core. Use when creating a new Worker API, adding a route, service or repository, wiring the error envelope and request ids, adding a D1 migration, rate limiting an endpoint, validating environment bindings, or writing Worker integration tests with the Cloudflare Vitest plugin.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/core@0.1"
---

# Hono API on Workers + D1

`@softwareseva/core/server` gives you the composition root, the error envelope, request ids, CORS, rate limiting and the crypto, password, id and phone helpers. You write bindings, routes, services, repositories and migrations. Keep that split: routes parse input and shape output, services decide, repositories hold every SQL statement.

## New API

1. `pnpm add hono zod @softwareseva/core` and dev deps `wrangler @cloudflare/workers-types vitest @cloudflare/vitest-plugin typescript`.
2. Copy `templates/wrangler.jsonc`, `templates/wrangler.test.jsonc`, `templates/tsconfig.json`, `templates/vitest.config.ts`, `templates/src/types.ts`, `templates/src/index.ts`, and `templates/test/` into the project. Rename the Worker and database. Leave `database_id` for `wrangler d1 create <name>` to fill.
3. `npx @softwareseva/cli migrate` (or copy `node_modules/@softwareseva/core/migrations/core_0001_rate_limits.sql` into `migrations/0001_core_0001_rate_limits.sql`). Then add your own numbered migrations.
4. `wrangler d1 migrations apply <name> --local`, `pnpm dev`, and `curl localhost:8787/health`.

## Add a resource

For each resource add three files and a migration (see `templates/src/routes/example.ts` and `templates/src/repositories/example-repository.ts`):

- `migrations/NNNN_<table>.sql` with `id TEXT PRIMARY KEY`, `created_at`, `updated_at`, `deleted_at` (soft delete), and one composite index per sort key ending in `id`.
- `src/repositories/<table>-repository.ts`: a class taking `D1Database`; all SQL lives here; select with `AS camelCase` aliases so rows match the contract.
- `src/routes/<table>.ts`: `new Hono<AppEnv>()` with zod parsing at the top of each handler, `ok(c, data)` on success, `throw new ApiError(404, "NOT_FOUND", "...")` on expected failures.
- Mount in `src/index.ts`: `app.route("/v1/<table>", <table>Routes)`.

Business rules that touch more than one repository or need a decision go in `src/services/`. Services throw `ApiError`; they never build HTTP responses.

## The envelope

`createApp()` installs handlers so every response is one of:

```jsonc
{ "data": ... }                                                   // 2xx
{ "code": "NOT_FOUND", "message": "...", "requestId": "..." }      // ApiError
{ "code": "VALIDATION_ERROR", "message": "...", "fields": { "title": ["..."] }, "requestId": "..." }  // ZodError -> 422
{ "code": "INTERNAL_ERROR", "message": "...", "requestId": "..." } // anything else -> 500, logged with the id
```

Never catch and re-wrap errors in routes; let them propagate. Never put stack traces or internal messages in responses. Codes are `UPPER_SNAKE`; the standard set is in `@softwareseva/core/contracts` (`ErrorCodes`). See `references/error-codes.md`.

## Helpers you should reach for

| Need | Use |
|---|---|
| Limit an endpoint per IP | `rateLimit({ scope, limit, windowSeconds })` middleware |
| Limit per user or phone inside a service | `consumeRateLimit(db, key, limit, windowSeconds)` |
| Opaque tokens, hashes, HMAC, constant-time compare | `randomToken`, `sha256`, `hmac`, `safeEqual` |
| Passwords | `hashPassword`, `verifyPassword`, `passwordProblem` (PBKDF2 100k, the Workers cap) |
| Ids | `newId("note")` (time-sortable) |
| Phone and email input | `normalizePhone(raw, { defaultCountry, mobileOnly })`, `normalizeEmail` |
| Search input | `likePattern(q)` + `likeAny([...columns])` (escapes `%` and `_`) |
| Missing secrets | `parseEnv(schema, c.env)` or `requireEnv(c.env, [...])` at the top of a handler that needs them |
| Timestamps | `nowIso()`, `futureIso(seconds)` (ISO strings sort correctly in SQLite) |

## Migrations

Numbered `NNNN_name.sql` in `migrations/`, applied with `wrangler d1 migrations apply`. Never edit an applied file; add the next one. D1 is SQLite: no `ALTER COLUMN`, so add columns or rebuild the table. Details and a rebuild recipe: `references/migrations.md`.

## Tests

Integration tests run the real Worker against a fresh D1 per file via `@cloudflare/vitest-plugin` (`templates/vitest.config.ts`, `templates/test/`). Use `SELF.fetch(...)` and assert on the envelope. Unit-test pure helpers with plain vitest. See `references/testing.md`.

## Do not

- Put SQL in routes or services.
- Return `{ ok: true }` or other ad-hoc envelopes.
- Use `Math.random` for anything security-related.
- Raise PBKDF2 iterations above 100,000 (works locally, fails in production).
- Log request bodies, tokens or codes.
- Run `wrangler deploy` or remote migrations as a side effect of finishing code; report them as next steps.
