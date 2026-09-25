# kashi_sync

Flutter half of `@kashi/sync`, on Drift.

- **Outbox**: write locally and call `engine.enqueue(type, payload, entity:, entityId:)` in the same `db.transaction`. The engine pushes in batches, deletes applied or replayed ops, retries retryable failures with exponential backoff, and parks permanent failures in `needsAttention()`.
- **Pull**: `GET /sync/pull?since=<cursor>` pages through the server's change log; each page applies in one transaction and advances the cursor. Rows with unsent local edits are skipped until the push lands, so offline edits are never overwritten.
- **Lifecycle**: `start()` after sign-in (periodic and on reconnect), `clearAll()` on sign-out.

The engine creates its own tables (`kashi_outbox`, `kashi_sync_state`); your Drift schema only holds your entities. See the `flutter-drift-sync` skill.
