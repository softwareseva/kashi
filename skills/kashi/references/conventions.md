# kashi conventions

These rules apply to every project on the stack. They are written so that code can be lifted into a `@kashi/*` or `kashi_*` package later without rework.

## Architecture

Dependency direction: `web -> contracts <- routes -> services -> repositories -> D1`. Adapters (third-party APIs) and small `lib` modules support the Worker layers. Keep dependencies pointing inward: never import Worker or platform code into `contracts`, never issue SQL from routes or services.

- `contracts/`: zod request schemas and shared response types. This is the client/API boundary and is consumed on both sides.
- `routes/`: Hono controllers. Parse transport input, apply middleware, delegate, shape the response.
- `services/`: workflows and business decisions that do not depend on HTTP.
- `repositories/`: all SQL and row mapping.
- `lib/`: cross-cutting primitives (normalisation, crypto, cursors, HTTP errors).
- `adapters/`: integration boundaries (messaging providers, OAuth providers).
- `migrations/`: immutable, ordered schema history.

## HTTP

- Success: `{ data: ... }`. Failure: `{ code, message, requestId, fields? }` where `fields` maps field names to messages for validation errors.
- Throw `ApiError(status, code, message, fields?)` for expected failures. The composition root catches everything, logs unexpected errors with the `requestId`, and never leaks stack traces or internal messages.
- All routes under `/v1`. Group by resource.
- Protected mutations require the role check. Cookie-based sessions also require session-bound CSRF protection (double-submit token or Origin check).
- Rate-limit authentication endpoints per IP and per identity.

## Data

- Normalise phone numbers (E.164), emails (lowercase, trimmed) and postal codes before lookup or storage.
- Store opaque tokens (refresh tokens, OTP codes, API keys) only as hashes. Compare with a constant-time helper.
- Make webhook ingestion idempotent on the external event id.
- Every synced table carries `updated_at` and `deleted_at` (soft delete) so offline clients can pull changes.
- Migrations: never edit an applied migration; add the next numbered file; make forward migration safe for existing rows; keep D1/SQLite compatibility; add the index for every new access pattern.

## Lists

- Server-side directories use allowlisted sort keys and stable `(sort_value, id)` keyset cursors with a composite index per sort key.
- Escape `%` and `_` in `LIKE` search input.
- On the web, keep filter, search, sort, limit and cursor in the URL. Clear the cursor when any other list parameter changes.

## Frontend (React)

- One request wrapper per app that unwraps the envelope, throws a typed error and refreshes the session once on 401.
- One TanStack Query hook per resource. Loaders for reads, actions or mutations for writes.
- Use the design-system primitives before writing page-local variants. Colours only as tokens; raw hex outside the token file fails review.
- Preserve accessible labels, semantic controls, visible focus, 44px touch targets, reduced-motion behaviour and responsive layouts.

## Frontend (Flutter)

- Riverpod for state, go_router for navigation with an auth redirect.
- One `ApiClient` with typed failures; the auth interceptor shares a single in-flight refresh across concurrent 401s.
- Secure storage for sessions (iOS `first_unlock` accessibility). Wipe local data on sign-out.

## Source

- Every authored file starts with a one-line overview comment.
- Keep files under 400 lines; split by responsibility, not by size.
- No secrets in the repository. `.dev.vars.example` and `.env.example` hold placeholder names only.
- Latest stable dependency versions, no pre-releases. Record the reason when something is pinned back.

## Verification and handoff

- Run the narrowest tests while iterating; run the full check before handoff.
- Apply migrations to a disposable D1 first; test both migrated data and a clean database.
- Deployments, production migrations and secret changes are explicit actions. Report what changed, what was verified, and what still needs to run. Never claim a deploy or migration succeeded unless it actually ran against that environment.
