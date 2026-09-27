# kashi_sync example

Implement `SyncEntity` for each table you sync (typed Drift calls),
register them with a `SyncEngine`, and call `start()` after sign-in.

```dart
import 'package:drift/drift.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_sync/kashi_sync.dart';

class NotesSyncEntity implements SyncEntity {
  NotesSyncEntity(this.db);
  final AppDatabase db;

  @override
  Future<void> upsert(List<Map<String, dynamic>> rows) async {
    for (final row in rows) {
      await db.into(db.notes).insertOnConflictUpdate(
        NotesCompanion.insert(
          id: row['id'] as String,
          title: row['title'] as String,
        ),
      );
    }
  }

  @override
  Future<void> delete(List<String> ids) =>
      (db.delete(db.notes)..where((t) => t.id.isIn(ids))).go();

  @override
  Future<void> clear() => db.delete(db.notes).go();
}

Future<SyncEngine> buildSyncEngine(AppDatabase db, KashiApiClient api) async {
  final engine = SyncEngine(
    db: db,
    api: api,
    entities: {'notes': NotesSyncEntity(db)},
  );
  await engine.init();
  engine.statusStream.listen((status) => print('sync: $status'));
  return engine;
}

// After sign-in:
// engine.start();
//
// Queue a local write inside the same transaction as the write itself:
// await db.transaction(() async {
//   await db.into(db.notes).insert(row);
//   await engine.enqueue('upsert', row.toJson(), entity: 'notes', entityId: row.id);
// });
```
