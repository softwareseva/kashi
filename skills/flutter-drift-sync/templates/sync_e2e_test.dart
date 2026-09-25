/// End-to-end: the Dart packages against a running example API.
/// Run with: KASHI_E2E_API=http://localhost:8797/v1 flutter test test/e2e_test.dart
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kashi_auth/kashi_auth.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:drift/native.dart';
import 'package:kashi_example_app/data/database.dart';
import 'package:kashi_example_app/data/sync.dart';
import 'package:kashi_example_app/notes.dart';

class MemoryStorage extends FlutterSecureStorage {
  final Map<String, String> values = {};
  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async => value == null ? values.remove(key) : values[key] = value;
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
  @override
  Future<Map<String, String>> readAll({
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async => Map.of(values);
  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async => values.remove(key);
}

final api = Platform.environment['KASHI_E2E_API'];

/// Reads the latest code from the local dev_outbox with wrangler.
Future<String> latestCode(String destination) async {
  final r = await Process.run('npx', [
    'wrangler',
    'd1',
    'execute',
    'kashi-example',
    '--local',
    '--json',
    '--command',
    "SELECT body FROM dev_outbox WHERE destination = '$destination' ORDER BY id DESC LIMIT 1",
  ], workingDirectory: '../api');
  final rows =
      (jsonDecode(r.stdout as String) as List).first['results'] as List;
  return rows.first['body'] as String;
}

void main() {
  test(
    'OTP sign-in, keyset paging, and transparent refresh against the live API',
    () async {
      final storage = MemoryStorage();
      final container = ProviderContainer(
        overrides: [
          kashiConfigProvider.overrideWithValue(
            KashiConfig(baseUrl: api!, deviceName: 'e2e'),
          ),
          tokenStoreProvider.overrideWithValue(TokenStore(storage: storage)),
        ],
      );
      addTearDown(container.dispose);
      container.read(authControllerProvider);
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(
        container.read(authControllerProvider).status,
        AuthStatus.signedOut,
      );

      final auth = container.read(kashiAuthApiProvider);
      expect((await auth.config()).otpChannel, 'phone');
      const phone = '9000012345';
      await auth.requestOtp(phone);
      final code = await latestCode('+919000012345');
      final failure = await container
          .read(authControllerProvider.notifier)
          .signInWith(() => auth.verifyOtp(phone, code, name: 'E2E'));
      expect(failure, isNull);
      final state = container.read(authControllerProvider);
      expect(state.status, AuthStatus.signedIn);
      expect(state.user?.phone, '+919000012345');
      expect(storage.values['kashi.refresh_token'], isNotNull);

      final keepAlive = container.listen(notesDirectoryProvider, (_, _) {});
      addTearDown(keepAlive.close);
      final notes = keepAlive.read();
      await notes.refresh();
      expect(notes.failure, isNull);
      expect(notes.items.length, 25);
      await notes.loadMore();
      expect(notes.items.length, greaterThan(25));
      expect(
        notes.items.map((n) => n.id).toSet().length,
        notes.items.length,
        reason: 'no duplicates across pages',
      );

      // Corrupt the access token: the next call must refresh once and succeed.
      final tokens = container.read(tokenStoreProvider);
      final oldRefresh = storage.values['kashi.refresh_token'];
      tokens.accessToken = 'garbage';
      final me = await container
          .read(apiClientProvider)
          .get<Map<String, dynamic>>('/auth/me');
      expect((me['user'] as Map)['name'], 'E2E');
      expect(
        storage.values['kashi.refresh_token'],
        isNot(oldRefresh),
        reason: 'refresh token rotated',
      );

      await container.read(authControllerProvider.notifier).signOut();
      expect(
        container.read(authControllerProvider).status,
        AuthStatus.signedOut,
      );
      expect(storage.values, isEmpty);
    },
    skip: api == null ? 'set KASHI_E2E_API to run against a live API' : false,
    timeout: const Timeout(Duration(minutes: 2)),
  );

  test(
    'offline writes reach the server, web edits come back, deletes propagate',
    () async {
      final storage = MemoryStorage();
      final container = ProviderContainer(
        overrides: [
          kashiConfigProvider.overrideWithValue(
            KashiConfig(baseUrl: api!, deviceName: 'e2e'),
          ),
          tokenStoreProvider.overrideWithValue(TokenStore(storage: storage)),
          databaseProvider.overrideWith((ref) {
            final db = AppDatabase(NativeDatabase.memory());
            ref.onDispose(db.close);
            return db;
          }),
        ],
      );
      addTearDown(container.dispose);
      final auth = container.read(kashiAuthApiProvider);
      const phone = '9000012346';
      await auth.requestOtp(phone);
      expect(
        await container
            .read(authControllerProvider.notifier)
            .signInWith(
              () async =>
                  auth.verifyOtp(phone, await latestCode('+919000012346')),
            ),
        isNull,
      );

      final local = container.read(localNotesProvider);
      final engine = container.read(syncEngineProvider);
      final client = container.read(apiClientProvider);
      final db = container.read(databaseProvider);

      final id = await local.save(
        title: 'Written offline ${DateTime.now().microsecondsSinceEpoch}',
      );
      var status = await engine.sync();
      expect(status.pending, 0, reason: status.message);
      final onServer = await client.get<Map<String, dynamic>>('/notes/$id');
      expect(onServer['title'], startsWith('Written offline'));

      final web = await client.post<Map<String, dynamic>>(
        '/notes',
        body: {'title': 'Typed on the web'},
      );
      await engine.sync();
      final localIds = (await db.select(db.notes).get())
          .map((n) => n.id)
          .toSet();
      expect(localIds, containsAll([id, web['id']]));

      await local.remove(id);
      status = await engine.sync();
      expect(status.pending, 0);
      await expectLater(
        client.get<dynamic>('/notes/$id'),
        throwsA(isA<ApiFailure>().having((f) => f.status, 'status', 404)),
      );
      expect(
        (await db.select(db.notes).get()).map((n) => n.id),
        isNot(contains(id)),
      );
    },
    skip: api == null ? 'set KASHI_E2E_API to run against a live API' : false,
    timeout: const Timeout(Duration(minutes: 2)),
  );
}
