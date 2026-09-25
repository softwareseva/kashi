# @kashi/sync

Server half of offline-first sync. Pair with `kashi_sync` in Flutter.

- `POST /push { ops: [{ opId, type, payload }] }`: each op runs its handler once. The result is stored by `(user, opId)`, so a retried batch replays results instead of applying twice. Failures report `retryable` so clients know whether to back off or give up.
- `GET /pull?since=<seq>`: returns `{ changes: { <entity>: { upserts, deletes } }, next, hasMore, reset }` from the `sync_changes` log for the user's scopes. The cursor is a monotonically increasing sequence, so resuming is exact.
- `changeStatement()` / `recordChanges()`: log changes from any route (web edits then reach mobile devices).

```ts
app.route("/v1/sync", syncRouter({
  auth: requireAuth(authConfig),
  user: (c) => c.get("user"),
  scopes: (user) => [`user:${user.id}`],
  handlers: { "note.upsert": { schema: noteSchema, apply: (ctx, p) => { ctx.batch.push(upsertNote(ctx.db, p)); ctx.changed({ scope: `user:${ctx.user.id}`, entity: "notes", id: p.id }); return { id: p.id }; } } },
  entities: { notes: { load: (db, ids, user) => loadNotes(db, ids, user.id) } },
}));
```

Ships `migrations/sync_0001_ops_changes.sql`. See the `sync-endpoints` skill.
