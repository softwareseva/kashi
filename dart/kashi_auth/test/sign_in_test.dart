import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kashi_auth/kashi_auth.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_ui/kashi_ui.dart';

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

class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);
  final ResponseBody Function(RequestOptions) handler;
  final List<RequestOptions> requests = [];
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<List<int>>? s,
    Future<void>? c,
  ) async {
    requests.add(o);
    return handler(o);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody json(int status, Object body) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

void main() {
  testWidgets(
    'OTP sign-in: send code, show field errors, then sign in and store the session',
    (tester) async {
      final storage = MemoryStorage();
      var verifyCalls = 0;
      final adapter = FakeAdapter((o) {
        switch (o.path) {
          case '/auth/config':
            return json(200, {
              'data': {
                'providers': {
                  'password': false,
                  'otp': {'channel': 'phone'},
                  'google': true,
                  'apple': false,
                  'passkeys': false,
                },
              },
            });
          case '/auth/otp/request':
            return json(200, {
              'data': {'sent': true},
            });
          case '/auth/otp/verify':
            verifyCalls++;
            final body = o.data as Map<String, dynamic>;
            expect(body['transport'], 'token');
            if (body['code'] != '123456') {
              return json(401, {
                'code': 'INVALID_CODE',
                'message': 'bad',
                'requestId': 'r',
              });
            }
            return json(200, {
              'data': {
                'user': {
                  'id': 'usr_1',
                  'name': 'Asha',
                  'roles': ['user'],
                },
                'accessToken': 'a',
                'refreshToken': 'refresh-token-xxxxxxxxxxxx',
                'expiresIn': 900,
              },
            });
        }
        return json(404, {
          'code': 'NOT_FOUND',
          'message': 'nope',
          'requestId': 'r',
        });
      });
      final tokens = TokenStore(storage: storage);
      final client = KashiApiClient(
        baseUrl: 'https://api.test/v1',
        tokens: tokens,
      )..dio.httpClientAdapter = adapter;
      final container = ProviderContainer(
        overrides: [
          kashiConfigProvider.overrideWithValue(
            const KashiConfig(baseUrl: 'https://api.test/v1'),
          ),
          tokenStoreProvider.overrideWithValue(tokens),
          apiClientProvider.overrideWithValue(client),
        ],
      );
      addTearDown(container.dispose);
      container.read(
        authControllerProvider,
      ); // the router reads it at startup in a real app

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: CupertinoApp(
            theme: kashiCupertinoTheme(),
            home: const CupertinoPageScaffold(
              child: SafeArea(child: SingleChildScrollView(child: KSignIn())),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        container.read(authControllerProvider).status,
        AuthStatus.signedOut,
      );
      expect(
        find.text('Continue with Google'),
        findsNothing,
        reason: 'no adapter supplied',
      );

      await tester.enterText(
        find.byType(CupertinoTextField).first,
        '9876543210',
      );
      await tester.tap(find.text('Send code'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Enter the code sent to 9876543210'),
        findsOneWidget,
      );

      await tester.enterText(find.byType(CupertinoTextField).first, '000000');
      await tester.tap(find.text('Verify'));
      await tester.pumpAndSettle();
      expect(find.textContaining('invalid or has expired'), findsOneWidget);

      await tester.enterText(find.byType(CupertinoTextField).first, '123456');
      await tester.tap(find.text('Verify'));
      await tester.pumpAndSettle();
      expect(verifyCalls, 2);
      final state = container.read(authControllerProvider);
      expect(state.status, AuthStatus.signedIn);
      expect(state.user?.name, 'Asha');
      expect(
        storage.values['kashi.refresh_token'],
        'refresh-token-xxxxxxxxxxxx',
      );
    },
  );

  testWidgets(
    'shows Google only when the server enables it and the app supplies an adapter',
    (tester) async {
      final adapter = FakeAdapter(
        (o) => json(200, {
          'data': {
            'providers': {
              'password': false,
              'otp': null,
              'google': true,
              'apple': true,
              'passkeys': false,
            },
          },
        }),
      );
      final tokens = TokenStore(storage: MemoryStorage());
      final client = KashiApiClient(
        baseUrl: 'https://api.test/v1',
        tokens: tokens,
      )..dio.httpClientAdapter = adapter;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            kashiConfigProvider.overrideWithValue(
              const KashiConfig(baseUrl: 'x'),
            ),
            tokenStoreProvider.overrideWithValue(tokens),
            apiClientProvider.overrideWithValue(client),
          ],
          child: CupertinoApp(
            home: CupertinoPageScaffold(
              child: KSignIn(google: () async => null),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Continue with Google'), findsOneWidget);
      expect(find.text('Continue with Apple'), findsNothing);
      await tester.tap(find.text('Continue with Google'));
      await tester.pumpAndSettle();
      expect(find.byType(KAlert), findsNothing, reason: 'cancelling is silent');
    },
  );

  testWidgets(
    'shows a peer button per trusted site and signs in with the redirected code',
    (tester) async {
      final adapter = FakeAdapter((o) {
        switch (o.path) {
          case '/auth/config':
            return json(200, {
              'data': {
                'providers': {
                  'password': false,
                  'otp': null,
                  'passkeys': false,
                  'peer': [
                    {'key': '0', 'label': 'vvmvp'},
                  ],
                },
              },
            });
          case '/auth/peer/token':
            final body = o.data as Map<String, dynamic>;
            expect(body['key'], '0');
            expect(body['code'], 'the-code');
            return json(200, {
              'data': {
                'user': {
                  'id': 'usr_2',
                  'name': 'Riya',
                  'roles': ['user'],
                },
                'accessToken': 'a',
                'refreshToken': 'refresh-token-yyyyyyyyyyyy',
                'expiresIn': 900,
              },
            });
        }
        return json(404, {
          'code': 'NOT_FOUND',
          'message': 'nope',
          'requestId': 'r',
        });
      });
      final tokens = TokenStore(storage: MemoryStorage());
      final client = KashiApiClient(
        baseUrl: 'https://api.test/v1',
        tokens: tokens,
      )..dio.httpClientAdapter = adapter;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            kashiConfigProvider.overrideWithValue(
              const KashiConfig(baseUrl: 'x'),
            ),
            tokenStoreProvider.overrideWithValue(tokens),
            apiClientProvider.overrideWithValue(client),
          ],
          child: CupertinoApp(
            home: CupertinoPageScaffold(
              child: KSignIn(
                peerBrowser: (authorizeUrl, redirectPrefix) async =>
                    redirectPrefix.replace(
                      queryParameters: {'code': 'the-code'},
                    ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Continue with vvmvp'), findsOneWidget);
      await tester.tap(find.text('Continue with vvmvp'));
      await tester.pumpAndSettle();
      expect(find.byType(KAlert), findsNothing);
    },
  );
}
