import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kashi_core/kashi_core.dart';

import 'api_client_test.dart'
    show FakeAdapter, MemoryStorage, client, json, user;

/// Restores with a stored session while the refresh endpoint answers [status]/[code].
Future<AuthState> restoreWith(
  int status,
  String code, {
  bool storedUser = true,
}) async {
  final storage = MemoryStorage();
  await storage.write(key: 'kashi.refresh_token', value: 'stored');
  if (storedUser) {
    await storage.write(key: 'kashi.user', value: jsonEncode(user));
  }
  final tokens = TokenStore(storage: storage);
  final api = client(
    FakeAdapter(
      (o) => json(status, {'code': code, 'message': 'x', 'requestId': 'r'}),
    ),
    tokens,
  );
  final container = ProviderContainer(
    overrides: [
      kashiConfigProvider.overrideWithValue(
        const KashiConfig(baseUrl: 'https://api.test/v1'),
      ),
      tokenStoreProvider.overrideWithValue(tokens),
      apiClientProvider.overrideWithValue(api),
    ],
  );
  addTearDown(container.dispose);
  container.read(authControllerProvider);
  await container.read(authControllerProvider.notifier).restore();
  return container.read(authControllerProvider);
}

void main() {
  test(
    'a server error at launch keeps the stored user signed in, offline',
    () async {
      final state = await restoreWith(503, 'INTERNAL');
      expect(state.status, AuthStatus.signedIn);
      expect(state.offline, isTrue);
      expect(state.user?.id, 'usr_1');
    },
  );

  test(
    'a rate limit at launch keeps the stored user signed in, offline',
    () async {
      final state = await restoreWith(429, 'RATE_LIMITED');
      expect(state.status, AuthStatus.signedIn);
      expect(state.offline, isTrue);
    },
  );

  test('a server error with no stored user signs out', () async {
    final state = await restoreWith(503, 'INTERNAL', storedUser: false);
    expect(state.status, AuthStatus.signedOut);
  });

  test('a rejected refresh token signs out', () async {
    final state = await restoreWith(401, 'TOKEN_REUSE');
    expect(state.status, AuthStatus.signedOut);
  });
}
