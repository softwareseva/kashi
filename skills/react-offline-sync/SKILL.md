---
name: react-offline-sync
description: Offline-first data in React with RxDB, TanStack DB and @softwareseva/sync, covering local-first writes through a durable outbox, batched push with retries and a needs-attention queue, cursor pull that never overwrites unsent edits, sync on sign-in/reconnect/timer, a status badge, and wiping data on sign-out. Use when a web app must work without a network, when adding a synced entity, when showing sync status, or when debugging data that does not sync. This is the React counterpart of flutter-drift-sync.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/sync@0.2 @softwareseva/core@0.2 rxdb@17 @tanstack/db@0.9 @tanstack/react-db@0.4"
---

# Offline-first with RxDB and TanStack DB

Server first: the API mounts `syncRouter` (`sync-endpoints` skill). The app reads and writes **only the local RxDB database**; `SyncEngine` moves changes both ways. This mirrors `flutter-drift-sync`: RxDB stands in for Drift, TanStack DB's live queries stand in for Drift's `.watch()`.

## Install

```
pnpm add @softwareseva/sync rxdb @tanstack/db @tanstack/react-db
```

1. Define your collections and open one `RxDatabase` (`templates/database.ts`), sharing a single instance for the app's lifetime. Use client-generated ids (`crypto.randomUUID()`) so offline creates need no server round trip.
2. For each synced entity implement `LocalSyncEntity` (`upsert`, `delete`, `clear`) with RxDB bulk calls, and wrap its collection with `createSyncedCollection` (`templates/sync.ts`).
3. Construct one `SyncEngine({ db, api, entities })`. It creates its own `kashi_outbox` and `kashi_sync_state` RxDB collections; they are not part of your schema.
4. Call `engine.start()` after sign-in and `engine.clearAll()` on sign-out (wherever `AuthProvider`'s `useAuth().status` transitions — see `api-client-react`).

## Writing

`createSyncedCollection` gives you an ordinary TanStack DB collection: `notes.insert(row)`, `.update(id, draft => {...})`, `.delete(id)`. Each one writes straight to RxDB (optimistic and durable) and enqueues the matching sync op — never call the API directly for synced data. Read with `useLiveQuery(notes)` (`templates/notes-page.tsx`); it stays current as local writes land and as pulled changes arrive.

## What the engine does

- `sync()`: push due ops in batches of 50, then pull pages until `hasMore` is false. Concurrent calls share one run.
- Push results: `applied` or `replayed` remove the op; retryable failures back off exponentially (5s doubling, capped at 5 minutes); permanent failures or 8 attempts move the op to **needs attention**.
- Pull: skips upserts/deletes for any id with a pending outbox op in that entity, so unsent local edits are never overwritten. `reset: true` from the server clears synced collections and restarts from 0.
- `start()`: syncs now, every 5 minutes, and whenever the browser fires `online`. `enqueue()` schedules a sync 400ms later.
- `useSyncStatus(engine)` (`@softwareseva/sync/react`) re-renders on phase/pending/needs-attention changes, for a badge (`templates/sync-badge.tsx`).
- `engine.needsAttention()`, `.retry(opId)`, `.discard(opId)`: show rejected changes to the user and let them fix or drop them.

## Rules

- Never write to a synced RxDB collection outside `createSyncedCollection`'s mutation handlers, and never call the API directly for synced data.
- Ops describe intent (`note.delete`), not raw rows — match whatever `type` the server's `syncRouter` handlers register.
- Schema changes to synced collections need an RxDB schema version bump (`migrationStrategies`) and a matching server migration; add fields as optional so old clients keep working.
- `createSyncedCollection`'s live sync does a full refresh (truncate + re-insert) on every RxDB emission, which is simple and correct but not cheap for very large collections; keep synced collections to what a user's own device needs, not the whole dataset.
- On sign-out call `engine.clearAll()` before another user signs in on the same device.

## Test

Unit-test `LocalSyncEntity` implementations and `SyncEngine` with an in-memory RxDB storage (`getRxStorageMemory()`) and a fake `ApiClient`. End to end, run the example API, save offline, `sync()`, read the row from the API, create one through the API, `sync()`, find it locally — the same shape as `flutter-drift-sync`'s `sync_e2e_test.dart`.
