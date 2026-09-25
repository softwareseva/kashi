/// Dio client for kashi APIs: bearer auth, single-flight refresh, envelope unwrapping into [KashiFailure].
library;

import 'dart:async';

import 'package:dio/dio.dart';

import 'failure.dart';
import 'models.dart';
import 'token_store.dart';

class KashiApiClient {
  /// [baseUrl] includes the version prefix, e.g. `https://api.example.com/v1`.
  /// [authPath] is where `authRouter` is mounted relative to [baseUrl].
  KashiApiClient({
    required String baseUrl,
    required this.tokens,
    this.authPath = '/auth',
    Dio? dio,
    Map<String, String> headers = const {},
    Duration timeout = const Duration(seconds: 20),
  }) : dio =
           dio ??
           Dio(
             BaseOptions(
               baseUrl: baseUrl.replaceAll(RegExp(r'/+$'), ''),
               connectTimeout: timeout,
               receiveTimeout: timeout,
               sendTimeout: timeout,
               headers: {'accept': 'application/json', ...headers},
             ),
           ) {
    this.dio.interceptors.add(
      InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );
  }

  final Dio dio;
  final TokenStore tokens;
  final String authPath;

  /// Emits when a refresh fails; the auth controller listens and signs out.
  final _expired = StreamController<void>.broadcast();
  Stream<void> get sessionExpired => _expired.stream;

  Future<TokenSession>? _refreshing;

  String get baseUrl => dio.options.baseUrl;
  set baseUrl(String value) =>
      dio.options.baseUrl = value.replaceAll(RegExp(r'/+$'), '');

  bool _isTokenPath(String path) =>
      path == '$authPath/token/refresh' || path == '$authPath/token/revoke';

  void _onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = tokens.accessToken;
    if (token != null &&
        options.extra['skipAuth'] != true &&
        !_isTokenPath(options.path)) {
      options.headers['authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final request = error.requestOptions;
    final refreshable =
        error.response?.statusCode == 401 &&
        request.extra['retried'] != true &&
        request.extra['skipAuth'] != true &&
        !_isTokenPath(request.path);
    if (!refreshable) return handler.next(error);
    try {
      await refresh();
    } on KashiFailure {
      return handler.next(error);
    }
    try {
      request.extra['retried'] = true;
      request.headers['authorization'] = 'Bearer ${tokens.accessToken}';
      handler.resolve(await dio.fetch<dynamic>(request));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  /// Exchange the stored refresh token for a new pair. Concurrent callers share one request so the
  /// rotating token is never presented twice (which the server treats as theft).
  Future<TokenSession> refresh() =>
      _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);

  Future<TokenSession> _doRefresh() async {
    final refreshToken = await tokens.readRefreshToken();
    if (refreshToken == null) throw const SessionExpiredFailure();
    try {
      final session = TokenSession.fromJson(
        await post<Map<String, dynamic>>(
          '$authPath/token/refresh',
          body: {'refreshToken': refreshToken},
          skipAuth: true,
        ),
      );
      await tokens.save(session);
      return session;
    } on ApiFailure catch (f) {
      if (f.status == 401) {
        await tokens.clear();
        _expired.add(null);
        throw const SessionExpiredFailure();
      }
      rethrow;
    }
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _send<T>(() => dio.get<dynamic>(path, queryParameters: _clean(query)));
  Future<T> post<T>(String path, {Object? body, bool skipAuth = false}) =>
      _send<T>(
        () => dio.post<dynamic>(
          path,
          data: body,
          options: Options(extra: {'skipAuth': skipAuth}),
        ),
      );
  Future<T> put<T>(String path, {Object? body}) =>
      _send<T>(() => dio.put<dynamic>(path, data: body));
  Future<T> patch<T>(String path, {Object? body}) =>
      _send<T>(() => dio.patch<dynamic>(path, data: body));
  Future<T> delete<T>(String path, {Object? body}) =>
      _send<T>(() => dio.delete<dynamic>(path, data: body));

  /// Keyset list helper: `client.page('/notes', query, Note.fromJson)`.
  Future<KPage<T>> page<T>(
    String path,
    Map<String, dynamic> query,
    T Function(Map<String, dynamic>) item,
  ) async =>
      KPage.fromJson(await get<Map<String, dynamic>>(path, query: query), item);

  Map<String, dynamic>? _clean(Map<String, dynamic>? q) => q == null
      ? null
      : (Map.of(q)..removeWhere((_, v) => v == null || v == ''));

  Future<T> _send<T>(Future<Response<dynamic>> Function() call) async {
    try {
      final response = await call();
      if (response.statusCode == 204) return null as T;
      final body = response.data;
      if (body is Map<String, dynamic> && body.containsKey('data')) {
        return body['data'] as T;
      }
      throw const UnexpectedFailure(
        'The server response was not in the expected format.',
      );
    } on DioException catch (e) {
      throw failureFromDio(e);
    }
  }

  void dispose() => _expired.close();
}

/// Convert any Dio error into a [KashiFailure].
KashiFailure failureFromDio(DioException e) {
  if (e.error is KashiFailure) return e.error! as KashiFailure;
  final body = e.response?.data;
  if (body is Map<String, dynamic> && body['code'] is String) {
    final fields = <String, List<String>>{};
    final raw = body['fields'];
    if (raw is Map) {
      raw.forEach(
        (k, v) => fields['$k'] = (v as List).map((x) => '$x').toList(),
      );
    }
    return ApiFailure(
      body['code'] as String,
      (body['message'] as String?) ?? 'Request failed.',
      status: e.response?.statusCode ?? 0,
      fields: fields,
      requestId: body['requestId'] as String?,
    );
  }
  if (e.response != null) {
    return ApiFailure(
      'HTTP_${e.response!.statusCode}',
      'Request failed (${e.response!.statusCode}).',
      status: e.response!.statusCode ?? 0,
    );
  }
  return const NetworkFailure();
}
