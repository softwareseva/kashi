# @softwareseva/sync

Offline-first sync for the kashi stack: idempotent batched push, a cursor-based pull, and a React client built on RxDB + TanStack DB. `kashi_sync` is the Flutter half.

## Install

```bash
pnpm add @softwareseva/sync hono zod
# React client also needs:
pnpm add rxdb @tanstack/db
```

## What's inside

- **`@softwareseva/sync`** (root import, Hono on Cloudflare Workers + D1): `syncRouter()` mounts `POST /push` and `GET /pull`; `changeStatement()` / `recordChanges()` log changes from any ordinary route so web edits reach mobile devices too.
  - `POST /push { ops: [{ opId, type, payload }] }`: each op runs its handler once. The result is stored by `(user, opId)`, so a retried batch replays results instead of applying twice. Failures report `retryable` so clients know whether to back off or give up.
  - `GET /pull?since=<seq>`: returns `{ changes: { <entity>: { upserts, deletes } }, next, hasMore, reset }` from the `sync_changes` log for the user's scopes. The cursor is a monotonically increasing sequence, so resuming is exact.
- **`@softwareseva/sync/client`**: `SyncEngine` — an RxDB-backed outbox of ops plus a pull cursor, mirroring `kashi_sync`'s Dart engine.
- **`@softwareseva/sync/react`**: `createSyncedCollection()` — a TanStack DB collection backed by an RxDB collection, with live reads and writes that enqueue an op on the `SyncEngine` in the same call; `useSyncStatus()` for a status badge (`idle` / `syncing` / `offline` / `failed`, pending count, needs-attention count). See the `react-offline-sync` skill.
- **`kashi_sync`** (pub.dev, Flutter): the same outbox-and-cursor design on Drift. See the `flutter-drift-sync` skill.

## Example

```ts
app.route("/v1/sync", syncRouter({
  auth: requireAuth(authConfig),
  user: (c) => c.get("user"),
  scopes: (user) => [`user:${user.id}`],
  handlers: { "note.upsert": { schema: noteSchema, apply: (ctx, p) => { ctx.batch.push(upsertNote(ctx.db, p)); ctx.changed({ scope: `user:${ctx.user.id}`, entity: "notes", id: p.id }); return { id: p.id }; } } },
  entities: { notes: { load: (db, ids, user) => loadNotes(db, ids, user.id) } },
}));
```

## Migrations

Ships `migrations/sync_0001_ops_changes.sql`; copy it into your migrations directory with `npx @softwareseva/cli migrate`.

## See also

`sync-endpoints` (server), `react-offline-sync` (React), and `flutter-drift-sync` (`kashi_sync`) skills.
