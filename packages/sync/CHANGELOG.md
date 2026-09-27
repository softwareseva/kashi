# @softwareseva/sync

## 1.2.0

### Patch Changes

- @softwareseva/core@1.2.0

## 1.1.0

### Patch Changes

- @softwareseva/core@1.1.0

## 1.0.0

### Patch Changes

- No functional changes; version aligned to the fixed npm release group (see `@softwareseva/core`, `@softwareseva/auth`, `@softwareseva/ui`, `@softwareseva/list`, `@softwareseva/cli`).

## 0.2.0

### Minor Changes

- bd0d12d: Add a React client for offline-first sync, mirroring `kashi_sync`'s Flutter engine on RxDB and TanStack DB instead of Drift.

  - `@softwareseva/sync/client`: `SyncEngine` — an outbox and pull cursor stored in the app's own RxDB database, batched push with retry/backoff and a needs-attention queue, paged pull that never overwrites unsent local edits, `start()`/`stop()`/`clearAll()` lifecycle, and a status stream.
  - `@softwareseva/sync/react`: `createSyncedCollection` wraps an RxDB collection as a TanStack DB collection (live reads via `useLiveQuery`, local-first writes that enqueue the matching sync op), and `useSyncStatus` for a status badge.

  New `react-offline-sync` skill documents installation and usage. Purely additive — no existing exports changed.

### Patch Changes

- Updated dependencies [77873b4]
  - @softwareseva/core@1.0.0
