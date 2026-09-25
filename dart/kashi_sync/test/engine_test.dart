import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:drift/native.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_sync/kashi_sync.dart';

class TestDb extends GeneratedDatabase {
  TestDb() : super(NativeDatabase.memory());
  @override
  Iterable<TableInfo<Table, dynamic>> get allTables => const [];
  @override
  int get schemaVersion => 1;
}

class NotesEntity implements SyncEntity {
  NotesEntity(this.db);
  final TestDb db;
  @override
  Future<void> upsert(List<Map<String, dynamic>> rows) async {
    for (final r in rows) {
      await db.customStatement(
        'INSERT OR REPLACE INTO notes(id, title) VALUES (?, ?)',
        [r['id'], r['title']],
      );
    }
  }

  @override
  Future<void> delete(List<String> ids) async {
    for (final id in ids) {
      await db.customStatement('DELETE FROM notes WHERE id = ?', [id]);
    }
  }

  @override
  Future<void> clear() => db.customStatement('DELETE FROM notes');
  Future<Map<String, String>> all() async => {
    for (final r in await db.customSelect('SELECT id, title FROM notes').get())
      r.read<String>('id'): r.read<String>('title'),
  };
}

class MemoryStorage extends FlutterSecureStorage {
  final Map<String, String> values = {};
  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async => values[key];
}

class FakeServer implements HttpClientAdapter {
  final pushes = <List<Map<String, dynamic>>>[];
  final pulls = <int>[];
  Map<String, Object> Function(Map<String, dynamic> op) pushResult = (op) => {
    'opId': op['opId'],
    'status': 'applied',
  };
  List<Map<String, Object?>> pages = [];
  bool offline = false;

  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<List<int>>? s,
    Future<void>? c,
  ) async {
    if (offline) {
      throw DioException.connectionError(requestOptions: o, reason: 'offline');
    }
    if (o.path.endsWith('/push')) {
      final ops = ((o.data as Map)['ops'] as List).cast<Map<String, dynamic>>();
      pushes.add(ops);
      return _json({'results': ops.map(pushResult).toList()});
    }
    final since = int.parse('${o.queryParameters['since']}');
    pulls.add(since);
    final page = pages.isEmpty
        ? {'changes': {}, 'next': since, 'hasMore': false, 'reset': false}
        : pages.removeAt(0);
    return _json(page);
  }

  ResponseBody _json(Object data) => ResponseBody.fromString(
    jsonEncode({'data': data}),
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
  @override
  void close({bool force = false}) {}
}

Future<(SyncEngine, TestDb, NotesEntity, FakeServer)> setup({
  DateTime Function()? clock,
}) async {
  final db = TestDb();
  await db.customStatement(
    'CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT NOT NULL)',
  );
  final server = FakeServer();
  final api = KashiApiClient(
    baseUrl: 'https://api.test/v1',
    tokens: TokenStore(storage: MemoryStorage()),
  )..dio.httpClientAdapter = server;
  final notes = NotesEntity(db);
  final engine = SyncEngine(
    db: db,
    api: api,
    entities: {'notes': notes},
    clock: clock,
  );
  addTearDown(() async {
    await engine.dispose();
    await db.close();
  });
  return (engine, db, notes, server);
}

void main() {
  test(
    'local write and enqueue commit together; push removes applied ops',
    () async {
      final (engine, db, notes, server) = await setup();
      await engine.init();
      await db.transaction(() async {
        await db.customStatement(
          "INSERT INTO notes(id, title) VALUES ('n1', 'Draft')",
        );
        await engine.enqueue(
          'note.upsert',
          {'id': 'n1', 'title': 'Draft'},
          entity: 'notes',
          entityId: 'n1',
        );
      });
      expect(engine.status.pending, 0, reason: 'counts refresh asynchronously');
      final status = await engine.sync();
      expect(server.pushes.single.single['type'], 'note.upsert');
      expect(status.pending, 0);
      expect(status.phase, SyncPhase.idle);
      expect(await notes.all(), {'n1': 'Draft'});
    },
  );

  test(
    'retryable failures back off; permanent failures need attention',
    () async {
      var now = DateTime(2026, 1, 1);
      final (engine, db, _, server) = await setup(clock: () => now);
      server.pushResult = (op) => op['type'] == 'bad'
          ? {
              'opId': op['opId'],
              'status': 'failed',
              'error': {
                'code': 'VALIDATION_ERROR',
                'message': 'Title is required',
                'retryable': false,
              },
            }
          : {
              'opId': op['opId'],
              'status': 'failed',
              'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'try later',
                'retryable': true,
              },
            };
      await engine.enqueue('bad', {}, entity: 'notes', entityId: 'x');
      await engine.enqueue('flaky', {}, entity: 'notes', entityId: 'y');
      var status = await engine.sync();
      expect(status.needsAttention, 1);
      expect(status.pending, 1);
      expect(
        (await engine.needsAttention()).single.lastError,
        'Title is required',
      );

      await engine.sync();
      expect(server.pushes.length, 1, reason: 'flaky op is backing off');
      now = now.add(const Duration(minutes: 1));
      server.pushResult = (op) => {'opId': op['opId'], 'status': 'applied'};
      status = await engine.sync();
      expect(server.pushes.length, 2);
      expect(status.pending, 0);

      await engine.discard((await engine.needsAttention()).single.opId);
      expect(engine.status.needsAttention, 0);
    },
  );

  test('pull pages apply upserts and deletes, advance the cursor, and skip rows with unsent edits', () async {
    final (engine, db, notes, server) = await setup();
    await engine.init();
    await db.customStatement(
      "INSERT INTO notes(id, title) VALUES ('gone', 'old'), ('mine', 'my offline edit')",
    );
    server.offline = true;
    await engine.enqueue(
      'note.upsert',
      {'id': 'mine', 'title': 'my offline edit'},
      entity: 'notes',
      entityId: 'mine',
    );
    expect((await engine.sync()).phase, SyncPhase.offline);
    server.offline = false;
    server.pushResult = (op) => {
      'opId': op['opId'],
      'status': 'failed',
      'error': {'code': 'INTERNAL_ERROR', 'message': 'x', 'retryable': true},
    };
    server.pages = [
      {
        'changes': {
          'notes': {
            'upserts': [
              {'id': 'a', 'title': 'A'},
              {'id': 'mine', 'title': 'server version'},
            ],
            'deletes': [],
          },
        },
        'next': 5,
        'hasMore': true,
        'reset': false,
      },
      {
        'changes': {
          'notes': {
            'upserts': [],
            'deletes': ['gone'],
          },
        },
        'next': 9,
        'hasMore': false,
        'reset': false,
      },
    ];
    await engine.sync();
    expect(server.pulls, [0, 5]);
    expect(await notes.all(), {'a': 'A', 'mine': 'my offline edit'});
    server.pushResult = (op) => {'opId': op['opId'], 'status': 'applied'};
    await engine.sync();
    expect(server.pulls.last, 9, reason: 'cursor persisted');
  });

  test(
    'reset from the server clears local rows and resyncs from zero',
    () async {
      final (engine, db, notes, server) = await setup();
      await engine.init();
      await db.customStatement(
        "INSERT INTO notes(id, title) VALUES ('stale', 'x')",
      );
      await db.customStatement(
        'UPDATE kashi_sync_state SET cursor = 3 WHERE id = 1',
      );
      server.pages = [
        {
          'changes': {
            'notes': {
              'upserts': [
                {'id': 'fresh', 'title': 'F'},
              ],
              'deletes': [],
            },
          },
          'next': 40,
          'hasMore': false,
          'reset': true,
        },
      ];
      await engine.sync();
      expect(await notes.all(), {'fresh': 'F'});
    },
  );

  test('clearAll wipes outbox, cursor and entities', () async {
    final (engine, db, notes, server) = await setup();
    await engine.init();
    await db.customStatement("INSERT INTO notes(id, title) VALUES ('n', 'x')");
    await engine.enqueue(
      'note.upsert',
      {'id': 'n'},
      entity: 'notes',
      entityId: 'n',
    );
    await db.customStatement(
      'UPDATE kashi_sync_state SET cursor = 7 WHERE id = 1',
    );
    await engine.clearAll();
    expect(await notes.all(), isEmpty);
    await engine.sync();
    expect(server.pulls.last, 0);
    expect(server.pushes, isEmpty);
  });
}
