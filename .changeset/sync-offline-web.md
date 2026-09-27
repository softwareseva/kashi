---
"@softwareseva/sync": minor
---

Add a React client for offline-first sync, mirroring `kashi_sync`'s Flutter engine on RxDB and TanStack DB instead of Drift.

- `@softwareseva/sync/client`: `SyncEngine` — an outbox and pull cursor stored in the app's own RxDB database, batched push with retry/backoff and a needs-attention queue, paged pull that never overwrites unsent local edits, `start()`/`stop()`/`clearAll()` lifecycle, and a status stream.
- `@softwareseva/sync/react`: `createSyncedCollection` wraps an RxDB collection as a TanStack DB collection (live reads via `useLiveQuery`, local-first writes that enqueue the matching sync op), and `useSyncStatus` for a status badge.

New `react-offline-sync` skill documents installation and usage. Purely additive — no existing exports changed.
