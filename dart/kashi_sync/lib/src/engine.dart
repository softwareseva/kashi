/// Outbox + pull engine for @softwareseva/sync. Push drains local operations; pull applies server changes after a cursor.
library;

import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:kashi_core/kashi_core.dart';

import 'status.dart';

/// How the app stores one synced entity locally. Implement with typed Drift calls.
abstract interface class SyncEntity {
  /// Insert or replace rows from the server (server wins).
  Future<void> upsert(List<Map<String, dynamic>> rows);
  Future<void> delete(List<String> ids);

  /// Remove every local row (sign-out, or the server asked for a full resync).
  Future<void> clear();
}

class SyncEngine {
  SyncEngine({
    required this.db,
    required this.api,
    required this.entities,
    this.path = '/sync',
    this.interval = const Duration(minutes: 5),
    this.connectivity,
    this.batchSize = 50,
    this.maxAttempts = 8,
    this.baseBackoff = const Duration(seconds: 5),
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final GeneratedDatabase db;
  final KashiApiClient api;
  final Map<String, SyncEntity> entities;
  final String path;
  final Duration interval;

  /// Emits true when the device regains a network; the engine syncs then. Use connectivity_plus in the app.
  final Stream<bool>? connectivity;
  final int batchSize;
  final int maxAttempts;
  final Duration baseBackoff;
  final DateTime Function() _clock;

  final _status = StreamController<SyncStatus>.broadcast();
  SyncStatus _current = const SyncStatus();
  Timer? _timer;
  Timer? _soon;
  StreamSubscription<bool>? _online;
  Future<SyncStatus>? _running;
  bool _ready = false;

  Stream<SyncStatus> get statusStream => _status.stream;
  SyncStatus get status => _current;

  /// Creates the engine's tables if needed. Called automatically; safe to call again.
  Future<void> init() async {
    if (_ready) return;
    await db.customStatement(
      'CREATE TABLE IF NOT EXISTS kashi_outbox (op_id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT \'pending\', last_error TEXT)',
    );
    await db.customStatement(
      'CREATE INDEX IF NOT EXISTS kashi_outbox_due ON kashi_outbox(status, next_attempt_at, created_at)',
    );
    await db.customStatement(
      'CREATE TABLE IF NOT EXISTS kashi_sync_state (id INTEGER PRIMARY KEY NOT NULL, cursor INTEGER NOT NULL DEFAULT 0, last_sync_at INTEGER)',
    );
    await db.customStatement(
      'INSERT OR IGNORE INTO kashi_sync_state(id, cursor) VALUES (1, 0)',
    );
    _ready = true;
  }

  /// Periodic sync plus sync on reconnect. Call after sign-in.
  void start() {
    _timer ??= Timer.periodic(interval, (_) => unawaited(sync()));
    _online ??= connectivity?.listen((online) {
      if (online) unawaited(sync());
    });
    unawaited(sync());
  }

  Future<void> stop() async {
    _timer?.cancel();
    _timer = null;
    _soon?.cancel();
    await _online?.cancel();
    _online = null;
  }

  /// Queue a local change. Call inside the same `db.transaction` as the local write so both commit or neither does.
  Future<String> enqueue(
    String type,
    Map<String, dynamic> payload, {
    required String entity,
    required String entityId,
    String? opId,
  }) async {
    await init();
    final id = opId ?? newId('op');
    await db.customStatement(
      'INSERT INTO kashi_outbox(op_id, type, entity, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        type,
        entity,
        entityId,
        jsonEncode(payload),
        _clock().millisecondsSinceEpoch,
      ],
    );
    // Follow-up work must not run in the caller's transaction zone: Drift closes that runner when the
    // transaction commits. The root zone uses the main connection and sees the committed row.
    Zone.root.run(() {
      if (_timer != null) {
        _soon?.cancel();
        _soon = Timer(
          const Duration(milliseconds: 400),
          () => unawaited(sync()),
        );
      }
      Timer.run(() => unawaited(_refreshCounts()));
    });
    return id;
  }

  /// Push then pull. Concurrent calls share one run.
  Future<SyncStatus> sync() =>
      _running ??= _run().whenComplete(() => _running = null);

  Future<SyncStatus> _run() async {
    await init();
    _emit(_current.copyWith(phase: SyncPhase.syncing, clearMessage: true));
    try {
      await _push();
      await _pull();
      final now = _clock();
      await db.customStatement(
        'UPDATE kashi_sync_state SET last_sync_at = ? WHERE id = 1',
        [now.millisecondsSinceEpoch],
      );
      await _refreshCounts(phase: SyncPhase.idle, lastSyncAt: now);
    } on NetworkFailure catch (f) {
      await _refreshCounts(phase: SyncPhase.offline, message: f.message);
    } on SessionExpiredFailure catch (f) {
      await _refreshCounts(phase: SyncPhase.failed, message: f.message);
    } on KashiFailure catch (f) {
      await _refreshCounts(phase: SyncPhase.failed, message: f.message);
    }
    return _current;
  }

  Future<void> _push() async {
    while (true) {
      final due = await db
          .customSelect(
            "SELECT * FROM kashi_outbox WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY created_at LIMIT ?",
            variables: [
              Variable.withInt(_clock().millisecondsSinceEpoch),
              Variable.withInt(batchSize),
            ],
          )
          .get();
      if (due.isEmpty) return;
      final body = await api.post<Map<String, dynamic>>(
        '$path/push',
        body: {
          'ops': [
            for (final r in due)
              {
                'opId': r.read<String>('op_id'),
                'type': r.read<String>('type'),
                'payload': jsonDecode(r.read<String>('payload')),
                'clientTs': r.read<int>('created_at'),
              },
          ],
        },
      );
      final attempts = {
        for (final r in due) r.read<String>('op_id'): r.read<int>('attempts'),
      };
      var progressed = false;
      await db.transaction(() async {
        for (final raw
            in (body['results'] as List).cast<Map<String, dynamic>>()) {
          final opId = raw['opId'] as String;
          final status = raw['status'] as String;
          if (status == 'applied' || status == 'replayed') {
            await db.customStatement(
              'DELETE FROM kashi_outbox WHERE op_id = ?',
              [opId],
            );
            progressed = true;
            continue;
          }
          final error =
              (raw['error'] as Map?)?.cast<String, dynamic>() ?? const {};
          final tries = (attempts[opId] ?? 0) + 1;
          final permanent = error['retryable'] != true || tries >= maxAttempts;
          final wait = baseBackoff * (1 << tries.clamp(0, 8));
          await db.customStatement(
            'UPDATE kashi_outbox SET attempts = ?, last_error = ?, status = ?, next_attempt_at = ? WHERE op_id = ?',
            [
              tries,
              error['message'] ?? 'Rejected by the server',
              permanent ? 'needs_attention' : 'pending',
              _clock().add(wait).millisecondsSinceEpoch,
              opId,
            ],
          );
        }
      });
      if (!progressed || due.length < batchSize) return;
    }
  }

  Future<void> _pull() async {
    var cursor = await _cursor();
    for (var page = 0; page < 200; page++) {
      final body = await api.get<Map<String, dynamic>>(
        '$path/pull',
        query: {'since': cursor},
      );
      if (body['reset'] == true) {
        await db.transaction(() async {
          for (final e in entities.values) {
            await e.clear();
          }
          await db.customStatement(
            'UPDATE kashi_sync_state SET cursor = 0 WHERE id = 1',
          );
        });
        cursor = 0;
        if (page > 0) continue;
      }
      final next = (body['next'] as num).toInt();
      final changes = (body['changes'] as Map).cast<String, dynamic>();
      await db.transaction(() async {
        final pending = await _pendingIds();
        for (final entry in changes.entries) {
          final entity = entities[entry.key];
          if (entity == null) continue;
          final change = (entry.value as Map).cast<String, dynamic>();
          final skip = pending[entry.key] ?? const <String>{};
          final upserts = (change['upserts'] as List)
              .cast<Map<String, dynamic>>()
              .where((r) => !skip.contains(r['id']))
              .toList();
          final deletes = (change['deletes'] as List)
              .cast<String>()
              .where((id) => !skip.contains(id))
              .toList();
          if (upserts.isNotEmpty) await entity.upsert(upserts);
          if (deletes.isNotEmpty) await entity.delete(deletes);
        }
        await db.customStatement(
          'UPDATE kashi_sync_state SET cursor = ? WHERE id = 1',
          [next],
        );
      });
      if (body['hasMore'] != true || next <= cursor) return;
      cursor = next;
    }
  }

  Future<int> _cursor() async =>
      (await db
              .customSelect('SELECT cursor FROM kashi_sync_state WHERE id = 1')
              .getSingle())
          .read<int>('cursor');

  /// Entity ids with unsent local changes: pulled rows for these are skipped until the push lands.
  Future<Map<String, Set<String>>> _pendingIds() async {
    final rows = await db
        .customSelect(
          "SELECT entity, entity_id FROM kashi_outbox WHERE status = 'pending'",
        )
        .get();
    final out = <String, Set<String>>{};
    for (final r in rows) {
      out
          .putIfAbsent(r.read<String>('entity'), () => {})
          .add(r.read<String>('entity_id'));
    }
    return out;
  }

  /// Changes the server rejected permanently or that ran out of retries.
  Future<List<OutboxEntry>> needsAttention() async {
    await init();
    final rows = await db
        .customSelect(
          "SELECT * FROM kashi_outbox WHERE status = 'needs_attention' ORDER BY created_at",
        )
        .get();
    return [
      for (final r in rows)
        OutboxEntry(
          opId: r.read('op_id'),
          type: r.read('type'),
          entity: r.read('entity'),
          entityId: r.read('entity_id'),
          payload: (jsonDecode(r.read<String>('payload')) as Map)
              .cast<String, dynamic>(),
          attempts: r.read('attempts'),
          lastError: r.readNullable('last_error'),
        ),
    ];
  }

  /// Put a needs-attention change back in the queue (e.g. after the user fixed the data).
  Future<void> retry(String opId) async {
    await db.customStatement(
      "UPDATE kashi_outbox SET status = 'pending', attempts = 0, next_attempt_at = 0 WHERE op_id = ?",
      [opId],
    );
    await _refreshCounts();
  }

  /// Drop a change the user no longer wants. The next pull restores the server's version.
  Future<void> discard(String opId) async {
    await db.customStatement('DELETE FROM kashi_outbox WHERE op_id = ?', [
      opId,
    ]);
    await _refreshCounts();
  }

  /// Sign-out: forget the cursor, the outbox and every synced row.
  Future<void> clearAll() async {
    await stop();
    await init();
    await db.transaction(() async {
      await db.customStatement('DELETE FROM kashi_outbox');
      await db.customStatement(
        'UPDATE kashi_sync_state SET cursor = 0, last_sync_at = NULL WHERE id = 1',
      );
      for (final e in entities.values) {
        await e.clear();
      }
    });
    _emit(const SyncStatus());
  }

  Future<void> _refreshCounts({
    SyncPhase? phase,
    DateTime? lastSyncAt,
    String? message,
  }) async {
    await init();
    final row = await db
        .customSelect(
          "SELECT sum(status = 'pending') AS pending, sum(status = 'needs_attention') AS attention FROM kashi_outbox",
        )
        .getSingle();
    _emit(
      _current.copyWith(
        phase: phase,
        pending: row.readNullable<int>('pending') ?? 0,
        needsAttention: row.readNullable<int>('attention') ?? 0,
        lastSyncAt: lastSyncAt,
        message: message,
        clearMessage: message == null && phase == SyncPhase.idle,
      ),
    );
  }

  void _emit(SyncStatus s) {
    _current = s;
    if (!_status.isClosed) _status.add(s);
  }

  Future<void> dispose() async {
    await stop();
    await _status.close();
  }
}
