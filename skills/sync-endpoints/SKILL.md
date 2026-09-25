---
name: sync-endpoints
description: Server side of offline-first sync on Cloudflare Workers + D1 with @kashi/sync, covering idempotent batched push of client operations with replay, a change log with a monotonic cursor for pull, per-user or per-organisation scopes, soft deletes, and logging changes from ordinary web routes so every device converges. Use when a mobile app must work offline, when adding a synced entity or operation, or when debugging duplicate or missing synced data.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@kashi/sync@0.1 @kashi/auth@0.1"
---

# Sync endpoints

Clients keep a local database and an outbox of operations. `@kashi/sync` gives them two endpoints:

- `POST /v1/sync/push { ops: [{ opId, type, payload }] }` runs each op's handler **once**. The result is stored by `(user, opId)`; a retried batch gets `replayed` with the original result. Failures carry `retryable` so clients back off or park the op.
- `GET /v1/sync/pull?since=<seq>&limit=` returns `{ changes: { <entity>: { upserts, deletes } }, next, hasMore, reset }` from the `sync_changes` log for the user's scopes.

The Flutter half is the `flutter-drift-sync` skill.

## Install

1. `pnpm add @kashi/sync`, then `npx kashi migrate` (copies `sync_0001_ops_changes.sql`), apply locally.
2. Copy `templates/sync.ts` to `src/sync.ts`, mount: `app.route("/v1/sync", syncRoutes)`.
3. Synced tables need `id TEXT PRIMARY KEY` (client-generated ids are fine, e.g. `newId("note")`), `updated_at`, and `deleted_at` (soft delete).

## Design an entity

For each synced entity decide:

1. **Scope**: who receives its changes. `user:<id>` for private data, `org:<id>` for shared data. `scopes(user)` returns every scope the user may pull.
2. **Operations**: intent-level ops, not raw row writes: `note.upsert`, `note.delete`, `task.complete`. Validate with zod and authorise inside the handler (the op runs with the user's permissions, exactly like the online route).
3. **Loader**: `entities.<name>.load(db, ids, user)` returns current rows the user may see. Rows it does not return are sent as deletes (covers soft-deleted rows and lost access).

## Handler rules

- Push statements onto `ctx.batch` and call `ctx.changed({ scope, entity, id, op })`. The router commits them with the op record in one `db.batch`, so a write, its change entry and its replay record land together or not at all.
- Throw `ApiError` for business rejections: 4xx are permanent (`retryable: false`), 429 and 5xx are retryable.
- Make ops idempotent in effect too (`INSERT ... ON CONFLICT DO UPDATE`), because a client that never saw the response will resend under the same `opId` and get a replay, but a different device may send a similar op.
- Conflict policy is **last write wins at the server**. For fields where that is wrong (counters, balances), use intent ops (`stock.adjust { delta }`) instead of absolute values.

## Web edits

Ordinary routes that change a synced table must log the change in the same batch:

```ts
await db.batch([db.prepare("UPDATE notes SET ... WHERE id = ?").bind(...), changeStatement(db, { scope, entity: "notes", id })]);
```

Otherwise devices never hear about it.

## Housekeeping

Run `pruneChanges(env.DB, 90)` from a daily cron. Clients whose cursor predates the oldest retained change get `reset: true` and resync from zero.

Protocol details and failure cases: `references/protocol.md`.
