import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kashi_core/kashi_core.dart';

/// In-memory stand-in for the keychain.
class MemoryStorage extends FlutterSecureStorage {
  MemoryStorage();
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

/// Scripted HTTP responses keyed by path; records requests.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);
  final ResponseBody Function(RequestOptions) handler;
  final List<RequestOptions> requests = [];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    await Future<void>.delayed(const Duration(milliseconds: 5));
    return handler(options);
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

const user = {
  'id': 'usr_1',
  'name': 'Asha',
  'roles': ['user'],
};
Map<String, Object> pair(String n) => {
  'data': {
    'user': user,
    'accessToken': 'access-$n',
    'refreshToken': 'refresh-$n-xxxxxxxxxxxxxxxxxxxx',
    'expiresIn': 900,
  },
};

KashiApiClient client(FakeAdapter adapter, TokenStore tokens) {
  final c = KashiApiClient(baseUrl: 'https://api.test/v1', tokens: tokens);
  c.dio.httpClientAdapter = adapter;
  return c;
}

void main() {
  test(
    'unwraps data and maps the error envelope to ApiFailure with fields',
    () async {
      final adapter = FakeAdapter(
        (o) => o.path == '/notes/1'
            ? json(200, {
                'data': {'id': '1'},
              })
            : json(422, {
                'code': 'VALIDATION_ERROR',
                'message': 'Invalid',
                'requestId': 'r1',
                'fields': {
                  'title': ['Required'],
                },
              }),
      );
      final api = client(adapter, TokenStore(storage: MemoryStorage()));
      expect(await api.get<Map<String, dynamic>>('/notes/1'), {'id': '1'});
      final failure = await api
          .post<dynamic>('/notes', body: {})
          .then<Object?>((_) => null, onError: (Object e) => e);
      expect(
        failure,
        isA<ApiFailure>()
            .having((f) => f.field('title'), 'title', 'Required')
            .having((f) => f.requestId, 'requestId', 'r1'),
      );
    },
  );

  test(
    'concurrent 401s share one refresh and retry with the new token',
    () async {
      final storage = MemoryStorage();
      final tokens = TokenStore(storage: storage)..accessToken = 'stale';
      await storage.write(
        key: 'kashi.refresh_token',
        value: 'refresh-0-xxxxxxxxxxxxxxxxxxxx',
      );
      var refreshes = 0;
      final adapter = FakeAdapter((o) {
        if (o.path == '/auth/token/refresh') {
          refreshes++;
          return json(200, pair('1'));
        }
        return o.headers['authorization'] == 'Bearer access-1'
            ? json(200, {'data': o.path})
            : json(401, {
                'code': 'UNAUTHORIZED',
                'message': 'x',
                'requestId': 'r',
              });
      });
      final api = client(adapter, tokens);
      final results = await Future.wait([
        api.get<String>('/a'),
        api.get<String>('/b'),
        api.get<String>('/c'),
      ]);
      expect(results, ['/a', '/b', '/c']);
      expect(refreshes, 1);
      expect(storage.values['kashi.refresh_token'], startsWith('refresh-1'));
      final refreshCall = adapter.requests.firstWhere(
        (r) => r.path == '/auth/token/refresh',
      );
      expect(refreshCall.headers['authorization'], isNull);
    },
  );

  test(
    'a failed refresh clears the session and emits sessionExpired',
    () async {
      final storage = MemoryStorage();
      await storage.write(key: 'kashi.refresh_token', value: 'old');
      final adapter = FakeAdapter(
        (o) => json(401, {
          'code': o.path.endsWith('refresh') ? 'TOKEN_REUSE' : 'UNAUTHORIZED',
          'message': 'x',
          'requestId': 'r',
        }),
      );
      final api = client(
        adapter,
        TokenStore(storage: storage)..accessToken = 'stale',
      );
      var expired = false;
      api.sessionExpired.listen((_) => expired = true);
      await expectLater(api.get<dynamic>('/a'), throwsA(isA<ApiFailure>()));
      await Future<void>.delayed(Duration.zero);
      expect(expired, isTrue);
      expect(storage.values, isEmpty);
    },
  );

  test('no response becomes NetworkFailure', () async {
    final adapter = FakeAdapter(
      (o) => throw DioException.connectionError(
        requestOptions: o,
        reason: 'offline',
      ),
    );
    final api = client(adapter, TokenStore(storage: MemoryStorage()));
    await expectLater(api.get<dynamic>('/a'), throwsA(isA<NetworkFailure>()));
  });

  test('pages parse and ids sort by time', () async {
    final page = KPage.fromJson({
      'items': [
        {'id': 'a'},
      ],
      'next': 'n',
      'previous': null,
    }, (j) => j['id'] as String);
    expect(page.items, ['a']);
    expect(page.next, 'n');
    final a = newId('note');
    await Future<void>.delayed(const Duration(milliseconds: 2));
    expect(a.compareTo(newId('note')), lessThan(0));
    expect(a, matches(RegExp(r'^note_[0-9a-z]{9}[0-9a-f]{12}$')));
  });
}
