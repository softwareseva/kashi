/// Sync wiring: how pulled notes land in Drift, local-first writes through the outbox, and lifecycle hooks.
library;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_sync/kashi_sync.dart';

import 'database.dart';

final databaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});

/// Server rows -> Drift rows. Server wins; the engine skips rows with unsent local edits.
class NotesSyncEntity implements SyncEntity {
  NotesSyncEntity(this.db);
  final AppDatabase db;

  @override
  Future<void> upsert(List<Map<String, dynamic>> rows) => db.batch(
    (b) => b.insertAllOnConflictUpdate(db.notes, [
      for (final r in rows)
        NotesCompanion.insert(
          id: r['id'] as String,
          title: r['title'] as String,
          body: Value(r['body'] as String? ?? ''),
          updatedAt: r['updatedAt'] as String,
        ),
    ]),
  );

  @override
  Future<void> delete(List<String> ids) =>
      (db.delete(db.notes)..where((n) => n.id.isIn(ids))).go();

  @override
  Future<void> clear() => db.delete(db.notes).go();
}

final syncEngineProvider = Provider<SyncEngine>((ref) {
  final db = ref.watch(databaseProvider);
  final engine = SyncEngine(
    db: db,
    api: ref.watch(apiClientProvider),
    entities: {'notes': NotesSyncEntity(db)},
    connectivity: Connectivity().onConnectivityChanged.map(
      (r) => r.any((c) => c != ConnectivityResult.none),
    ),
  );
  ref.onDispose(engine.dispose);
  return engine;
});

/// Start syncing after sign-in; wipe local data on sign-out.
final syncLifecycleOverride = authLifecycleProvider.overrideWith(
  (ref) => AuthLifecycle(
    onSignedIn: (_) => ref.read(syncEngineProvider).start(),
    onSignedOut: () => ref.read(syncEngineProvider).clearAll(),
  ),
);

/// Local-first writes: change Drift and queue the op in one transaction.
class LocalNotes {
  LocalNotes(this.db, this.sync);
  final AppDatabase db;
  final SyncEngine sync;

  Stream<List<LocalNote>> watchAll() => (db.select(
    db.notes,
  )..orderBy([(n) => OrderingTerm.desc(n.updatedAt)])).watch();

  Future<String> save({
    String? id,
    required String title,
    String body = '',
  }) async {
    final noteId = id ?? newId('note');
    await db.transaction(() async {
      await db
          .into(db.notes)
          .insertOnConflictUpdate(
            NotesCompanion.insert(
              id: noteId,
              title: title,
              body: Value(body),
              updatedAt: DateTime.now().toUtc().toIso8601String(),
            ),
          );
      await sync.enqueue(
        'note.upsert',
        {'id': noteId, 'title': title, 'body': body},
        entity: 'notes',
        entityId: noteId,
      );
    });
    return noteId;
  }

  Future<void> remove(String id) => db.transaction(() async {
    await (db.delete(db.notes)..where((n) => n.id.equals(id))).go();
    await sync.enqueue(
      'note.delete',
      {'id': id},
      entity: 'notes',
      entityId: id,
    );
  });
}

final localNotesProvider = Provider<LocalNotes>(
  (ref) =>
      LocalNotes(ref.watch(databaseProvider), ref.watch(syncEngineProvider)),
);
final syncStatusProvider = StreamProvider<SyncStatus>(
  (ref) => ref.watch(syncEngineProvider).statusStream,
);
