---
name: flutter-drift-sync
description: Offline-first data in Flutter with Drift and kashi_sync, covering local-first writes through a transactional outbox, batched push with retries and a needs-attention queue, cursor pull that never overwrites unsent edits, sync on sign-in, reconnect and timer, a status badge, and wiping data on sign-out. Use when a Flutter app must work without a network, when adding a synced table, when showing sync status, or when debugging data that does not sync.
license: MIT
metadata:
  version: "0.1.0"
  packages: "kashi_sync@1.2 kashi_core@1.2 drift@2.35 drift_flutter@0.3"
---

# Offline-first with Drift

Server first: the API mounts `syncRouter` (`sync-endpoints` skill). The app reads and writes **only the local database**; the engine moves changes both ways.

## Install

```yaml
dependencies:
  kashi_sync: ^0.1.0
  drift: ^2.35.0
  drift_flutter: ^0.3.1
  connectivity_plus: ^7.3.1
dev_dependencies:
  drift_dev: ^2.35.0
  build_runner: ^2.16.1
```

1. Define your tables and database (`templates/database.dart`), then `dart run build_runner build`. Use text ids generated on the device (`newId('note')` from `kashi_core`) so offline creates need no server round trip.
2. For each synced table implement `SyncEntity` (`upsert`, `delete`, `clear`) with typed Drift calls (`templates/sync.dart`).
3. Provide one `SyncEngine` (database, API client, entities, connectivity stream).
4. Override `authLifecycleProvider` so sign-in calls `engine.start()` and sign-out calls `engine.clearAll()`.

The engine creates its own `kashi_outbox` and `kashi_sync_state` tables; they are not part of your Drift schema or migrations.

## Writing

Always write the local row and enqueue the op in **one transaction**:

```dart
await db.transaction(() async {
  await db.into(db.notes).insertOnConflictUpdate(NotesCompanion.insert(id: id, title: title, updatedAt: now));
  await engine.enqueue('note.upsert', {'id': id, 'title': title}, entity: 'notes', entityId: id);
});
```

The UI watches Drift (`select(notes).watch()`) and updates immediately. `entity` and `entityId` let the engine skip pulled versions of that row until the push lands.

## What the engine does

- `sync()`: push due ops in batches of 50, then pull pages until `hasMore` is false. Concurrent calls share one run.
- Push results: `applied` or `replayed` remove the op; retryable failures back off exponentially (5 s doubling); permanent failures or 8 attempts move the op to **needs attention**.
- Pull: each page applies in one transaction with the cursor update. `reset` from the server clears synced tables and restarts from 0.
- `start()`: sync now, every 5 minutes, and whenever the connectivity stream reports online. A write while started schedules a sync 400 ms later.
- `statusStream`: `SyncStatus(phase, pending, needsAttention, lastSyncAt, message)` for a badge (`templates/sync_badge.dart`).
- `needsAttention()`, `retry(opId)`, `discard(opId)`: show rejected changes to the user and let them fix or drop them.

## Rules

- Never write to synced tables without enqueueing, and never call the API directly for synced data.
- Ops describe intent (`note.delete`), not SQL. Keep payloads small; upload files separately and sync their keys.
- Schema changes to synced tables need a Drift migration and a matching server migration; add columns as nullable so old clients keep working.
- On sign-out call `clearAll()` before another user signs in on the same device.

## Test

Unit-test entities and the engine with `NativeDatabase.memory()` and a fake HTTP adapter. End to end, run the example API and use a plain `test()` with an in-memory database: save offline, `sync()`, read the row from the API, create one through the API, `sync()`, find it locally (`templates/sync_e2e_test.dart`).
